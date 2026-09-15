/**
 * Storage Service & Capacitor Filesystem Architecture
 * Replaces browser localStorage with native Capacitor Filesystem module.
 * Stores core database (notes, categories, finances, debts) in 'catatan_data.json'
 * inside secure internal app directory (Directory.Data).
 * Offloads multimedia files (audio recordings, canvas sketches, photo attachments)
 * into separate physical files in 'attachments/' to maintain optimal JSON performance.
 */

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { AttachmentService } from './attachment.js';

export const DATA_FILE_NAME = 'catatan_data.json';
export const ATTACHMENTS_FOLDER = 'attachments';

const DB_NAME = 'CatatanPintarDB';
const DB_VERSION = 2;
const LS_NOTES = 'cp_notes_v1';
const LS_CATS = 'cp_categories_v1';

export const CORE_CATEGORIES = [
  { id: 'pekerjaan', name: 'Pekerjaan', color: '#3d5a6b', icon: '💼', core: true, keywords: ['rapat', 'meeting', 'proyek', 'deadline', 'kantor', 'klien', 'tugas kantor', 'laporan', 'presentasi'] },
  { id: 'keuangan',  name: 'Keuangan',  color: '#47593f', icon: '💰', core: true, keywords: ['rp', 'bayar', 'beli', 'gaji', 'tagihan', 'transfer', 'uang', 'belanja', 'hutang', 'pengeluaran', 'pemasukan', 'tabungan', 'invoice'] },
  { id: 'ide',       name: 'Ide',       color: '#b8922f', icon: '💡', core: true, keywords: ['ide', 'gagasan', 'konsep', 'rencana bisnis', 'inovasi', 'brainstorm'] },
  { id: 'pribadi',   name: 'Pribadi',   color: '#6b3f52', icon: '❤️', core: true, keywords: ['keluarga', 'teman', 'pribadi', 'curhat', 'perasaan', 'liburan', 'kesehatan'] },
  { id: 'belajar',   name: 'Belajar',   color: '#2f6b5e', icon: '📚', core: true, keywords: ['belajar', 'kuliah', 'ujian', 'materi', 'tugas kuliah', 'kursus', 'buku', 'skripsi'] }
];

let dbPromise = null;
let inMemoryCache = {
  notes: null,
  categories: null
};

/* ==========================================================================
   1. CORE CAPACITOR FILESYSTEM PERSISTENCE METHODS
   ========================================================================== */

/**
 * Asynchronous function to save all application data to native device storage
 * using Capacitor Filesystem, storing notes, categories, finances, and debts
 * in a single structured JSON file in Directory.Data.
 *
 * @param {Object} data - { notes: Array, categories: Array }
 * @returns {Promise<{success: boolean, native: boolean}>}
 */
export async function saveDataToDevice(data) {
  try {
    const payload = {
      version: 2,
      lastUpdated: Date.now(),
      categories: data.categories || inMemoryCache.categories || [],
      notes: (data.notes || inMemoryCache.notes || []).map(n => ({
        ...n,
        isPinned: Boolean(n.isPinned),
        // Ensure attachments strip heavy dataURLs from JSON
        attachments: (n.attachments || []).map(a => ({
          id: a.id,
          name: a.name,
          mime: a.mime,
          ext: a.ext,
          size: a.size,
          kind: a.kind,
          filePath: a.filePath || null,
          fileUri: a.fileUri || null,
          webviewSrc: a.webviewSrc || null,
          createdAt: a.createdAt || Date.now()
        }))
      }))
    };

    const jsonString = JSON.stringify(payload, null, 2);

    // Save to Capacitor Filesystem (Directory.Data)
    try {
      await Filesystem.writeFile({
        path: DATA_FILE_NAME,
        data: jsonString,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
        recursive: true
      });
    } catch (fsErr) {
      console.warn('Capacitor Filesystem writeFile notice:', fsErr);
    }

    // Always mirror to IndexedDB for instant retrieval and web fallback
    await syncToIndexedDB(payload.notes, payload.categories);

    return { success: true, native: Capacitor.isNativePlatform() };
  } catch (error) {
    console.error('saveDataToDevice error:', error);
    throw new Error('Gagal menyimpan data ke penyimpanan perangkat: ' + error.message);
  }
}

/**
 * Asynchronous function to load all application data from native device storage
 * using Capacitor Filesystem from Directory.Data.
 *
 * @returns {Promise<{categories: Array, notes: Array}>}
 */
export async function loadDataFromDevice() {
  try {
    // 1. Attempt reading from native/web Capacitor Filesystem
    try {
      const result = await Filesystem.readFile({
        path: DATA_FILE_NAME,
        directory: Directory.Data,
        encoding: Encoding.UTF8
      });

      if (result && result.data) {
        const parsed = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
        if (parsed && (Array.isArray(parsed.notes) || Array.isArray(parsed.categories))) {
          inMemoryCache.notes = parsed.notes || [];
          inMemoryCache.categories = parsed.categories || [];
          return {
            categories: inMemoryCache.categories,
            notes: inMemoryCache.notes
          };
        }
      }
    } catch (fsErr) {
      // File does not exist yet (e.g., fresh install) or web fallback
    }

    // 2. Fallback to IndexedDB (web preview or migration phase)
    const idbNotes = await loadNotesFromIndexedDB();
    const idbCats = await loadCategoriesFromIndexedDB();

    inMemoryCache.notes = idbNotes || [];
    inMemoryCache.categories = idbCats || [];

    return {
      categories: inMemoryCache.categories,
      notes: inMemoryCache.notes
    };
  } catch (error) {
    console.error('loadDataFromDevice error:', error);
    return { categories: [], notes: [] };
  }
}

/* ==========================================================================
   2. MULTIMEDIA FILE OFFLOADING (AUDIO, SKETCHES, BINARIES)
   ========================================================================== */

/**
 * Offloads heavy binary attachment (voice recordings, canvas sketches, photo uploads)
 * into a separate physical file on the device storage via Capacitor Filesystem.
 * Stores only file path and URI in the note data structure to prevent JSON lag.
 *
 * @param {Object} att - Attachment object with dataURL
 * @param {string} noteId - Parent note ID
 * @returns {Promise<Object>} Updated lightweight attachment metadata
 */
export async function saveMediaAttachmentToFile(att, noteId) {
  if (!att) return null;

  // If already saved to disk and has filePath without new dataURL, keep as is
  if (att.filePath && !att.dataURL) {
    return att;
  }

  // If it contains a raw base64 dataURL:
  if (att.dataURL && typeof att.dataURL === 'string') {
    const safeExt = att.ext || (att.mime ? att.mime.split('/')[1] : 'bin').split(';')[0];
    const fileName = `${att.id || ('media_' + Date.now())}.${safeExt}`;
    const relativePath = `${ATTACHMENTS_FOLDER}/${fileName}`;

    let nativeUri = null;
    let webviewSrc = null;

    try {
      // Extract raw base64 without meta header
      const commaIdx = att.dataURL.indexOf(',');
      const base64Data = commaIdx !== -1 ? att.dataURL.substring(commaIdx + 1) : att.dataURL;

      // Write physical file to Directory.Data
      await Filesystem.writeFile({
        path: relativePath,
        data: base64Data,
        directory: Directory.Data,
        recursive: true
      });

      // Get real device URI
      const uriResult = await Filesystem.getUri({
        path: relativePath,
        directory: Directory.Data
      });

      nativeUri = uriResult.uri;
      if (Capacitor.isNativePlatform()) {
        webviewSrc = Capacitor.convertFileSrc(nativeUri);
      }
    } catch (fsWriteErr) {
      console.warn('Physical media write warning (using IDB fallback):', fsWriteErr);
    }

    // Save binary into IndexedDB as backup for preview
    await saveAttachmentToIndexedDB(att, noteId);

    return {
      id: att.id,
      name: att.name,
      mime: att.mime,
      ext: safeExt,
      size: att.size,
      kind: att.kind,
      filePath: relativePath,
      fileUri: nativeUri,
      webviewSrc: webviewSrc,
      // Clear dataURL to keep JSON and RAM light
      dataURL: null,
      createdAt: att.createdAt || Date.now()
    };
  }

  return att;
}

/**
 * Reads binary media file content from physical disk or IndexedDB fallback.
 *
 * @param {Object} att - Attachment metadata
 * @returns {Promise<string|null>} base64 dataURL or direct media URL
 */
export async function readMediaAttachment(att) {
  if (!att) return null;
  if (att.dataURL) return att.dataURL;

  // 1. Try reading from Capacitor Filesystem if filePath exists
  if (att.filePath) {
    try {
      const readResult = await Filesystem.readFile({
        path: att.filePath,
        directory: Directory.Data
      });

      if (readResult && readResult.data) {
        const mime = att.mime || 'application/octet-stream';
        return `data:${mime};base64,${readResult.data}`;
      }
    } catch (fsReadErr) {
      // Fallback
    }
  }

  // 2. Try IndexedDB attachment store
  if (att.id) {
    const stored = await getAttachmentFromIndexedDB(att.id);
    if (stored && stored.dataURL) {
      return stored.dataURL;
    }
  }

  return null;
}

/* ==========================================================================
   3. INDEXEDDB UNDERLYING FALLBACK & WEB COMPATIBILITY ENGINE
   ========================================================================== */

function getDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    if (!window.indexedDB) {
      return resolve(null);
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('notes')) {
        const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
        notesStore.createIndex('category', 'category', { unique: false });
        notesStore.createIndex('createdAt', 'createdAt', { unique: false });
        notesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      if (!db.objectStoreNames.contains('attachments')) {
        const attStore = db.createObjectStore('attachments', { keyPath: 'id' });
        attStore.createIndex('noteId', 'noteId', { unique: false });
        attStore.createIndex('kind', 'kind', { unique: false });
      }

      if (!db.objectStoreNames.contains('categories')) {
        db.createObjectStore('categories', { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => {
      console.error('IndexedDB open error:', event.target.error);
      resolve(null);
    };
  });

  return dbPromise;
}

async function syncToIndexedDB(notesList, customCats) {
  const db = await getDB();
  if (!db) return;

  try {
    const tx = db.transaction(['notes', 'categories'], 'readwrite');
    const notesStore = tx.objectStore('notes');
    const catsStore = tx.objectStore('categories');

    // Sync notes
    notesStore.clear();
    (notesList || []).forEach(n => notesStore.put(n));

    // Sync categories
    catsStore.clear();
    (customCats || []).filter(c => !c.core).forEach(c => catsStore.put(c));

    await new Promise(res => { tx.oncomplete = () => res(true); });
  } catch (e) {
    console.warn('syncToIndexedDB warning:', e);
  }
}

async function loadNotesFromIndexedDB() {
  const db = await getDB();
  if (!db) return [];

  return new Promise((resolve) => {
    try {
      const tx = db.transaction('notes', 'readonly');
      const req = tx.objectStore('notes').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    } catch (e) {
      resolve([]);
    }
  });
}

async function loadCategoriesFromIndexedDB() {
  const db = await getDB();
  if (!db) return [];

  return new Promise((resolve) => {
    try {
      const tx = db.transaction('categories', 'readonly');
      const req = tx.objectStore('categories').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    } catch (e) {
      resolve([]);
    }
  });
}

async function saveAttachmentToIndexedDB(att, noteId) {
  const db = await getDB();
  if (!db) return;

  try {
    const tx = db.transaction('attachments', 'readwrite');
    const attStore = tx.objectStore('attachments');
    attStore.put({
      id: att.id,
      noteId,
      name: att.name,
      mime: att.mime,
      ext: att.ext,
      size: att.size,
      dataURL: att.dataURL,
      kind: att.kind,
      createdAt: att.createdAt || Date.now()
    });
  } catch (e) {}
}

async function getAttachmentFromIndexedDB(id) {
  const db = await getDB();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction('attachments', 'readonly');
      const req = tx.objectStore('attachments').get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

/* ==========================================================================
   4. STORAGE SERVICE FACADE (ZERO LOCALSTORAGE DEPENDENCY)
   ========================================================================== */

export const StorageService = {
  /**
   * Migrate legacy data from localStorage into Capacitor Filesystem on first launch.
   */
  async autoMigrateLegacyData() {
    try {
      const rawNotes = localStorage.getItem(LS_NOTES);
      const rawCats = localStorage.getItem(LS_CATS);

      let migratedSomething = false;
      let existingData = await loadDataFromDevice();

      let notes = existingData.notes || [];
      let categories = existingData.categories || [];

      if (rawNotes) {
        try {
          const legacyNotes = JSON.parse(rawNotes);
          if (Array.isArray(legacyNotes) && legacyNotes.length > 0 && notes.length === 0) {
            console.log(`Migrating ${legacyNotes.length} legacy notes from localStorage to Capacitor Filesystem...`);
            notes = legacyNotes;
            migratedSomething = true;
          }
        } catch (e) {}
      }

      if (rawCats) {
        try {
          const legacyCats = JSON.parse(rawCats);
          if (Array.isArray(legacyCats) && legacyCats.length > 0 && categories.length === 0) {
            categories = legacyCats;
            migratedSomething = true;
          }
        } catch (e) {}
      }

      if (migratedSomething) {
        // Save to native device storage
        await saveDataToDevice({ notes, categories });
        // Completely clear old localStorage keys to release browser memory
        localStorage.removeItem(LS_NOTES);
        localStorage.removeItem(LS_CATS);
        console.log('Legacy localStorage migration completed. localStorage keys purged.');
      }
    } catch (e) {
      console.warn('autoMigrateLegacyData notice:', e);
    }
  },

  /**
   * Retrieve storage estimate in real-time.
   */
  async getStorageUsage() {
    let totalBytes = 0;
    let maxBytes = 100 * 1024 * 1024; // 100MB base allocation

    try {
      // 1. Check navigator storage estimate
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        if (est.usage !== undefined) totalBytes = est.usage;
        if (est.quota !== undefined) maxBytes = est.quota;
      } else {
        // Estimate from in-memory cache
        const notesStr = JSON.stringify(inMemoryCache.notes || []);
        totalBytes = notesStr.length * 2;
      }
    } catch (e) {
      console.warn('Storage calculation estimate:', e);
    }

    const percentage = Math.min(100, Math.round((totalBytes / maxBytes) * 100)) || 0;
    return {
      totalBytes,
      maxBytes,
      percentage,
      formattedUsed: AttachmentService.formatSize(totalBytes),
      formattedMax: AttachmentService.formatSize(maxBytes)
    };
  },

  /**
   * Load all notes asynchronously from device storage.
   */
  async loadNotes() {
    const data = await loadDataFromDevice();
    inMemoryCache.notes = data.notes || [];
    return inMemoryCache.notes;
  },

  /**
   * Save a single note: offloads attachments to physical files and persists JSON to device.
   */
  async saveNote(note) {
    if (!note || !note.id) return { success: false };

    // Process attachments to offload heavy binaries to physical files
    const processedAttachments = [];
    if (Array.isArray(note.attachments)) {
      for (const att of note.attachments) {
        const processed = await saveMediaAttachmentToFile(att, note.id);
        if (processed) processedAttachments.push(processed);
      }
    }

    const noteToSave = {
      ...note,
      isPinned: Boolean(note.isPinned),
      attachments: processedAttachments,
      updatedAt: note.updatedAt || Date.now()
    };

    // Update in-memory cache
    if (!inMemoryCache.notes) {
      inMemoryCache.notes = await this.loadNotes();
    }

    const idx = inMemoryCache.notes.findIndex(n => n.id === noteToSave.id);
    if (idx >= 0) {
      inMemoryCache.notes[idx] = noteToSave;
    } else {
      inMemoryCache.notes.unshift(noteToSave);
    }

    // Persist full state to device storage
    await saveDataToDevice({
      notes: inMemoryCache.notes,
      categories: inMemoryCache.categories || []
    });

    return { success: true };
  },

  /**
   * Delete note and any physical files associated with it.
   */
  async deleteNote(id) {
    if (!inMemoryCache.notes) {
      inMemoryCache.notes = await this.loadNotes();
    }

    const noteToDelete = inMemoryCache.notes.find(n => n.id === id);

    // If note has attachments stored as physical files, remove them
    if (noteToDelete && Array.isArray(noteToDelete.attachments)) {
      for (const att of noteToDelete.attachments) {
        if (att.filePath) {
          try {
            await Filesystem.deleteFile({
              path: att.filePath,
              directory: Directory.Data
            });
          } catch (e) {
            console.warn('Attachment file delete warning:', e);
          }
        }
      }
    }

    inMemoryCache.notes = inMemoryCache.notes.filter(n => n.id !== id);

    // Persist updated list to device storage
    await saveDataToDevice({
      notes: inMemoryCache.notes,
      categories: inMemoryCache.categories || []
    });

    return { success: true };
  },

  /**
   * Retrieve attachment content (with file reading if needed).
   */
  async getAttachment(id, noteId = null) {
    if (!id) return null;

    // Search in current in-memory notes
    if (inMemoryCache.notes) {
      for (const note of inMemoryCache.notes) {
        if (Array.isArray(note.attachments)) {
          const found = note.attachments.find(a => a.id === id);
          if (found) {
            if (!found.dataURL) {
              const fullDataUrl = await readMediaAttachment(found);
              return { ...found, dataURL: fullDataUrl };
            }
            return found;
          }
        }
      }
    }

    // Fallback to IndexedDB
    return getAttachmentFromIndexedDB(id);
  },

  /**
   * Helper to read media attachment
   */
  readMediaAttachment(att) {
    return readMediaAttachment(att);
  },

  /**
   * Load categories from device storage.
   */
  async loadCategories() {
    const data = await loadDataFromDevice();
    const custom = data.categories || [];
    inMemoryCache.categories = custom;
    return CORE_CATEGORIES.concat(custom);
  },

  /**
   * Save custom categories to device storage.
   */
  async saveCategories(categoriesArray) {
    const custom = (categoriesArray || []).filter(c => !c.core);
    inMemoryCache.categories = custom;

    await saveDataToDevice({
      notes: inMemoryCache.notes || [],
      categories: custom
    });

    return { success: true };
  }
};
