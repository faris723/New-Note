/**
 * Storage Service & Capacitor Filesystem Architecture
 * Replaces browser localStorage with native Capacitor Filesystem module.
 * Stores core database (notes, categories, finances, debts) in 'catatan_data.json'
 * inside the app's public external folder (Directory.External), so it's visible
 * and browsable via a normal Android file manager at:
 * Android/data/<package_id>/files/
 * Offloads multimedia files (audio recordings, canvas sketches, photo attachments)
 * into separate physical files in 'attachments/' to maintain optimal JSON performance.
 */

// Native Capacitor & Capacitor Filesystem resolver
// Supports Android native apps (via window.Capacitor),
// Vite bundler environments, and direct static browser hosting (e.g. GitHub Pages)
const Capacitor = (typeof window !== 'undefined' && window.Capacitor) ? window.Capacitor : {
  isNativePlatform: () => false,
  convertFileSrc: (uri) => uri
};

const Directory = {
  Documents: 'DOCUMENTS',
  Data: 'DATA',
  Cache: 'CACHE',
  External: 'EXTERNAL',
  ExternalStorage: 'EXTERNAL_STORAGE'
};

const Encoding = {
  UTF8: 'utf8',
  ASCII: 'ascii',
  UTF16: 'utf16'
};

// --- Konfigurasi Berkas Per-Catatan (.cnote) ---
// Setiap catatan disimpan sebagai berkas individual di folder "Catatan/"
// (di dalam Directory.External), agar terlihat & bisa dibuka satu per satu
// lewat file manager, dan bisa dibuka kembali oleh aplikasi ini.
const NOTES_SUBFOLDER = 'Catatan';
const NOTE_FILE_EXTENSION = '.cnote';
const NOTES_MANIFEST_FILE = `${NOTES_SUBFOLDER}/.manifest.json`;

/** Bersihkan judul catatan supaya aman dipakai sebagai nama berkas */
function sanitizeFileName(name) {
  const cleaned = String(name || 'Tanpa Judul')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 60);
  return cleaned || 'Tanpa Judul';
}

/**
 * Cari nama kategori (dipakai sebagai nama folder) dari id kategori.
 * Menggabungkan kategori inti (CORE_CATEGORIES) + kategori kustom pengguna.
 */
function resolveCategoryFolderName(categoryId, customCategories = []) {
  const all = [...CORE_CATEGORIES, ...(Array.isArray(customCategories) ? customCategories : [])];
  const found = all.find((c) => c.id === categoryId);
  const label = found ? found.name : (categoryId || 'Lainnya');
  return sanitizeFileName(label);
}

/**
 * Baca daftar pemetaan noteId -> namaBerkas.cnote yang tersimpan sebelumnya,
 * supaya kalau judul catatan berubah, berkas lama dengan nama sebelumnya
 * bisa dihapus (tidak menumpuk berkas usang).
 */
async function loadNotesManifest() {
  try {
    const res = await Filesystem.readFile({
      path: NOTES_MANIFEST_FILE,
      directory: Directory.External,
      encoding: Encoding.UTF8
    });
    return JSON.parse(res.data) || {};
  } catch (e) {
    return {};
  }
}

async function saveNotesManifest(manifest) {
  try {
    await Filesystem.writeFile({
      path: NOTES_MANIFEST_FILE,
      data: JSON.stringify(manifest, null, 2),
      directory: Directory.External,
      encoding: Encoding.UTF8,
      recursive: true
    });
  } catch (e) {
    console.warn('Gagal menyimpan manifest berkas per-catatan:', e);
  }
}

/**
 * Menulis SETIAP catatan sebagai berkas individual (.cnote) di folder
 * "Catatan/" (Directory.External), agar bisa dilihat & dibuka satu per satu
 * lewat file manager, terpisah dari berkas gabungan (catatan_data_app.json).
 *
 * Berkas .cnote hanya khusus untuk isi tulisan (judul, teks, kategori, dsb).
 * Lampiran foto/audio/sketsa TETAP disimpan terpisah di folder attachments/
 * seperti sebelumnya, supaya berkas .cnote tetap ringan & mudah dibaca.
 */
export async function syncIndividualNoteFiles(notes = [], customCategories = []) {
  if (!Capacitor.isNativePlatform()) return; // fitur khusus APK, tidak berlaku di web

  try {
    const manifest = await loadNotesManifest(); // noteId -> "NamaKategori/Judul (id).cnote"
    const stillExistingIds = new Set();

    for (const note of notes) {
      if (!note || !note.id) continue;
      stillExistingIds.add(note.id);

      const folderName = resolveCategoryFolderName(note.category, customCategories);
      const baseTitle = sanitizeFileName(note.title);
      const shortId = String(note.id).slice(-6);
      const fileName = `${baseTitle} (${shortId})${NOTE_FILE_EXTENSION}`;
      const relativePath = `${folderName}/${fileName}`;
      const filePath = `${NOTES_SUBFOLDER}/${relativePath}`;

      // Kalau judul ATAU kategori berubah dari sebelumnya, path berkas juga
      // berubah — hapus dulu berkas lama (di folder kategori lama) supaya
      // tidak ada berkas duplikat/usang yang menumpuk.
      const previousRelativePath = manifest[note.id];
      if (previousRelativePath && previousRelativePath !== relativePath) {
        try {
          await Filesystem.deleteFile({
            path: `${NOTES_SUBFOLDER}/${previousRelativePath}`,
            directory: Directory.External
          });
        } catch (delErr) {
          // Berkas lama mungkin memang sudah tidak ada, abaikan.
        }
      }

      const noteExport = {
        app: 'Catatan Pintar',
        formatVersion: 1,
        id: note.id,
        title: note.title || 'Tanpa Judul',
        bodyHTML: note.bodyHTML || '',
        category: note.category || 'pribadi',
        isPinned: Boolean(note.isPinned),
        finance: note.finance || null,
        reminder: note.reminder || null,
        createdAt: note.createdAt || Date.now(),
        updatedAt: note.updatedAt || Date.now()
      };

      await Filesystem.writeFile({
        path: filePath,
        data: JSON.stringify(noteExport, null, 2),
        directory: Directory.External,
        encoding: Encoding.UTF8,
        recursive: true
      });

      manifest[note.id] = relativePath;
    }

    // Hapus berkas .cnote untuk catatan yang sudah dihapus dari aplikasi
    for (const noteId of Object.keys(manifest)) {
      if (!stillExistingIds.has(noteId)) {
        try {
          await Filesystem.deleteFile({
            path: `${NOTES_SUBFOLDER}/${manifest[noteId]}`,
            directory: Directory.External
          });
        } catch (e) {
          // Sudah tidak ada, abaikan.
        }
        delete manifest[noteId];
      }
    }

    await saveNotesManifest(manifest);
  } catch (err) {
    console.warn('syncIndividualNoteFiles warning:', err);
  }
}

const Filesystem = (typeof window !== 'undefined' && window.Capacitor?.Plugins?.Filesystem)
  ? window.Capacitor.Plugins.Filesystem
  : {
      writeFile: async () => { throw new Error('Filesystem using IndexedDB fallback on web'); },
      readFile: async () => { throw new Error('Filesystem using IndexedDB fallback on web'); },
      getUri: async ({ path }) => ({ uri: path }),
      deleteFile: async () => {}
    };

import { AttachmentService } from './attachment.js';
import {
  isFileSystemAccessSupported,
  linkDeviceVaultFile,
  openDeviceVaultFile,
  writeToDeviceVault,
  hasActiveFileHandle,
  getActiveFileName,
  unlinkDeviceVault
} from './device_file.js';

export const CORE_CATEGORIES = [
  { id: 'pekerjaan', name: 'Pekerjaan', color: '#3d5a6b', icon: '💼', core: true, keywords: ['rapat', 'meeting', 'proyek', 'deadline', 'kantor', 'klien', 'tugas kantor', 'laporan', 'presentasi'] },
  { id: 'keuangan',  name: 'Keuangan',  color: '#47593f', icon: '💰', core: true, keywords: ['rp', 'bayar', 'beli', 'gaji', 'tagihan', 'transfer', 'uang', 'belanja', 'hutang', 'pengeluaran', 'pemasukan', 'tabungan', 'invoice'] },
  { id: 'ide',       name: 'Ide',       color: '#b8922f', icon: '💡', core: true, keywords: ['ide', 'gagasan', 'konsep', 'rencana bisnis', 'inovasi', 'brainstorm'] },
  { id: 'pribadi',   name: 'Pribadi',   color: '#6b3f52', icon: '❤️', core: true, keywords: ['keluarga', 'teman', 'pribadi', 'curhat', 'perasaan', 'liburan', 'kesehatan'] },
  { id: 'belajar',   name: 'Belajar',   color: '#2f6b5e', icon: '📚', core: true, keywords: ['belajar', 'kuliah', 'ujian', 'materi', 'tugas kuliah', 'kursus', 'buku', 'skripsi'] }
];

const DB_VERSION = 2;

/**
 * Detect current execution environment:
 * - 'app': Standalone PWA, Native Capacitor Android, or launched with ?source=pwa / ?mode=app
 * - 'browser': Standard web browser tab (Chrome/Safari tab)
 */
export function getStorageEnvironment() {
  if (typeof window === 'undefined') return 'browser';

  // 1. URL search parameter override (e.g., launched from PWA manifest or explicit link)
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const sourceParam = urlParams.get('source') || urlParams.get('mode');
    if (sourceParam === 'pwa' || sourceParam === 'app') {
      return 'app';
    }
    if (sourceParam === 'browser' || sourceParam === 'web') {
      return 'browser';
    }
  } catch (e) {}

  // 2. User-selected override in session or local storage
  try {
    const override = sessionStorage.getItem('cp_active_env') || localStorage.getItem('cp_active_env');
    if (override === 'app' || override === 'browser') {
      return override;
    }
  } catch (e) {}

  // 3. Standalone PWA detection or Native Capacitor app detection
  const isStandalone =
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    (window.navigator && window.navigator.standalone === true) ||
    (typeof document !== 'undefined' && document.referrer && document.referrer.includes('android-app://')) ||
    (typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

  return isStandalone ? 'app' : 'browser';
}

/**
 * Get storage configuration (database name, file name, attachments folder)
 * based on the active environment so App and Browser data are COMPLETELY ISOLATED.
 */
export function getStorageConfig(envOverride = null) {
  const env = envOverride || getStorageEnvironment();
  const isApp = env === 'app';
  return {
    environment: env,
    isApp,
    label: isApp ? 'Mode Aplikasi' : 'Mode Browser',
    fullLabel: isApp ? 'Mode Aplikasi (Data Terisolasi)' : 'Mode Browser (Data Web Terpisah)',
    icon: isApp ? '📱' : '🌐',
    dbName: isApp ? 'CatatanPintar_App_DB' : 'CatatanPintar_Browser_DB',
    dataFileName: isApp ? 'catatan_data_app.json' : 'catatan_data_browser.json',
    attachmentsFolder: isApp ? 'attachments_app' : 'attachments_browser',
    lsNotesKey: isApp ? 'cp_app_notes_v1' : 'cp_browser_notes_v1',
    lsCatsKey: isApp ? 'cp_app_categories_v1' : 'cp_browser_categories_v1'
  };
}

export const DATA_FILE_NAME = getStorageConfig().dataFileName;
export const ATTACHMENTS_FOLDER = getStorageConfig().attachmentsFolder;

/**
 * Request Persistent Storage from the browser engine (Chromium / WebKit).
 * Prevents browser cache clearance or storage pressure from wiping IndexedDB data.
 */
export async function requestPersistentStorage() {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persist();
      console.log('Persistent Storage status:', isPersisted);
      return isPersisted;
    } catch (e) {
      console.warn('Persistent storage request error:', e);
    }
  }
  return false;
}

const dbPromiseCache = {
  app: null,
  browser: null
};

let inMemoryCache = {
  notes: null,
  categories: null
};

export function setStorageEnvironment(env) {
  if (env !== 'app' && env !== 'browser') return;
  try {
    sessionStorage.setItem('cp_active_env', env);
    localStorage.setItem('cp_active_env', env);
  } catch (e) {}
  dbPromiseCache.app = null;
  dbPromiseCache.browser = null;
  inMemoryCache.notes = null;
  inMemoryCache.categories = null;
}

/* ==========================================================================
   1. CORE CAPACITOR FILESYSTEM PERSISTENCE METHODS
   ========================================================================== */

/**
 * Asynchronous function to save all application data to native device storage
 * using Capacitor Filesystem, storing notes, categories, finances, and debts
 * in a single structured JSON file in Directory.External.
 *
 * @param {Object} data - { notes: Array, categories: Array }
 * @returns {Promise<{success: boolean, native: boolean}>}
 */
export async function saveDataToDevice(data) {
  try {
    const config = getStorageConfig();
    const payload = {
      version: 2,
      environment: config.environment,
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

    // Save to Capacitor Filesystem (Directory.External — visible in file manager)
    try {
      await Filesystem.writeFile({
        path: config.dataFileName,
        data: jsonString,
        directory: Directory.External,
        encoding: Encoding.UTF8,
        recursive: true
      });
    } catch (fsErr) {
      // Running on web fallback (IndexedDB)
    }

    // Tulis juga setiap catatan sebagai berkas .cnote terpisah,
    // dikelompokkan ke dalam folder per-kategori di dalam Catatan/
    try {
      await syncIndividualNoteFiles(payload.notes, payload.categories);
    } catch (perNoteErr) {
      console.warn('syncIndividualNoteFiles warning:', perNoteErr);
    }

    // Mirror to active environment's isolated IndexedDB
    await syncToIndexedDB(payload.notes, payload.categories);

    // Also persist directly to physical device file (immune to browser cookie/cache clearance)
    try {
      await writeToDeviceVault(payload);
    } catch (vaultErr) {
      console.warn('Device physical vault write notice:', vaultErr);
    }

    return { success: true, native: Capacitor.isNativePlatform() };
  } catch (error) {
    console.error('saveDataToDevice error:', error);
    throw new Error('Gagal menyimpan data ke penyimpanan perangkat: ' + error.message);
  }
}

/**
 * Asynchronous function to load all application data from native device storage
 * using Capacitor Filesystem from Directory.External (public app folder).
 *
 * @returns {Promise<{categories: Array, notes: Array}>}
 */
export async function loadDataFromDevice() {
  try {
    const config = getStorageConfig();

    // 1. Attempt reading from native/web Capacitor Filesystem
    try {
      const result = await Filesystem.readFile({
        path: config.dataFileName,
        directory: Directory.External,
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
      // File does not exist yet or web fallback
    }

    // 2. Fallback to active isolated IndexedDB
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
    const config = getStorageConfig();
    const relativePath = `${config.attachmentsFolder}/${fileName}`;

    let nativeUri = null;
    let webviewSrc = null;

    try {
      // Extract raw base64 without meta header
      const commaIdx = att.dataURL.indexOf(',');
      const base64Data = commaIdx !== -1 ? att.dataURL.substring(commaIdx + 1) : att.dataURL;

      // Write physical file to Directory.External (public app folder)
      await Filesystem.writeFile({
        path: relativePath,
        data: base64Data,
        directory: Directory.External,
        recursive: true
      });

      // Get real device URI
      const uriResult = await Filesystem.getUri({
        path: relativePath,
        directory: Directory.External
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
        directory: Directory.External
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

function getDB(envOverride = null) {
  const config = getStorageConfig(envOverride);
  const env = config.environment;

  if (dbPromiseCache[env]) {
    return dbPromiseCache[env];
  }

  dbPromiseCache[env] = new Promise((resolve) => {
    if (!window.indexedDB) {
      return resolve(null);
    }

    const request = window.indexedDB.open(config.dbName, DB_VERSION);

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
      console.error(`IndexedDB (${config.dbName}) open error:`, event.target.error);
      resolve(null);
    };
  });

  return dbPromiseCache[env];
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
  getStorageEnvironment,
  getStorageConfig,
  setStorageEnvironment,
  requestPersistentStorage,

  // Device File Vault (Anti-Browser-Clear Physical Persistence)
  isFileSystemAccessSupported,
  linkDeviceVaultFile,
  openDeviceVaultFile,
  writeToDeviceVault,
  hasActiveFileHandle,
  getActiveFileName,
  unlinkDeviceVault,

  /**
   * Migrate legacy unpartitioned data into the active isolated database on first launch.
   * Also requests Persistent Storage from the browser.
   */
  async autoMigrateLegacyData() {
    try {
      // 1. Request persistent storage from browser engine
      await requestPersistentStorage();

      const config = getStorageConfig();

      // Check if active environment already has data
      const existingData = await loadDataFromDevice();
      let notes = existingData.notes || [];
      let categories = existingData.categories || [];

      // If notes already exist in this environment, no legacy migration needed
      if (notes.length > 0) {
        return;
      }

      // 2. Check if legacy unpartitioned IndexedDB (CatatanPintarDB) has notes
      if (typeof window !== 'undefined' && window.indexedDB) {
        try {
          const legacyDB = await new Promise((resolve) => {
            const req = window.indexedDB.open('CatatanPintarDB', DB_VERSION);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
          });

          if (legacyDB && legacyDB.objectStoreNames.contains('notes')) {
            const tx = legacyDB.transaction(['notes', 'categories'], 'readonly');
            const legacyNotesReq = tx.objectStore('notes').getAll();
            const legacyCatsReq = tx.objectStore('categories').getAll();

            const [legNotes, legCats] = await Promise.all([
              new Promise(res => { legacyNotesReq.onsuccess = () => res(legacyNotesReq.result || []); }),
              new Promise(res => { legacyCatsReq.onsuccess = () => res(legacyCatsReq.result || []); })
            ]);

            if (Array.isArray(legNotes) && legNotes.length > 0) {
              console.log(`Auto-migrating ${legNotes.length} notes from legacy CatatanPintarDB to isolated ${config.dbName}...`);
              const customCats = (legCats || []).filter(c => !c.core);
              await saveDataToDevice({ notes: legNotes, categories: customCats });
              inMemoryCache.notes = legNotes;
              inMemoryCache.categories = customCats;
              legacyDB.close();
              return;
            }
            legacyDB.close();
          }
        } catch (idbErr) {
          console.warn('Legacy DB check notice:', idbErr);
        }
      }

      // 3. Fallback check for old localStorage keys
      const rawNotes = localStorage.getItem('cp_notes_v1');
      const rawCats = localStorage.getItem('cp_categories_v1');

      if (rawNotes) {
        try {
          const legacyNotes = JSON.parse(rawNotes);
          if (Array.isArray(legacyNotes) && legacyNotes.length > 0) {
            notes = legacyNotes;
          }
        } catch (e) {}
      }

      if (rawCats) {
        try {
          const legacyCats = JSON.parse(rawCats);
          if (Array.isArray(legacyCats) && legacyCats.length > 0) {
            categories = legacyCats;
          }
        } catch (e) {}
      }

      if (notes.length > 0) {
        await saveDataToDevice({ notes, categories });
        try {
          localStorage.removeItem('cp_notes_v1');
          localStorage.removeItem('cp_categories_v1');
        } catch (e) {}
      }
    } catch (e) {
      console.warn('autoMigrateLegacyData notice:', e);
    }
  },

  /**
   * Copy notes and categories between Browser and App environments
   * @param {string} fromEnv - 'browser' | 'app'
   * @param {string} toEnv - 'browser' | 'app'
   */
  async copyDataBetweenEnvironments(fromEnv, toEnv) {
    if (fromEnv === toEnv) {
      return { success: false, message: 'Ruang penyimpanan asal dan tujuan sama.' };
    }

    const sourceConfig = getStorageConfig(fromEnv);
    const targetConfig = getStorageConfig(toEnv);

    // Open source DB
    const sourceDB = await getDB(fromEnv);
    if (!sourceDB) return { success: false, message: 'Gagal mengakses ruang penyimpanan asal.' };

    const sourceNotes = await new Promise((resolve) => {
      try {
        const tx = sourceDB.transaction('notes', 'readonly');
        const req = tx.objectStore('notes').getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch (e) { resolve([]); }
    });

    const sourceCats = await new Promise((resolve) => {
      try {
        const tx = sourceDB.transaction('categories', 'readonly');
        const req = tx.objectStore('categories').getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch (e) { resolve([]); }
    });

    if (!sourceNotes || sourceNotes.length === 0) {
      return { success: false, message: `Tidak ada data catatan di ${sourceConfig.label} untuk disalin.` };
    }

    // Open target DB
    const targetDB = await getDB(toEnv);
    if (!targetDB) return { success: false, message: 'Gagal mengakses ruang penyimpanan tujuan.' };

    const tx = targetDB.transaction(['notes', 'categories'], 'readwrite');
    const targetNotesStore = tx.objectStore('notes');
    const targetCatsStore = tx.objectStore('categories');

    sourceNotes.forEach(n => targetNotesStore.put(n));
    (sourceCats || []).filter(c => !c.core).forEach(c => targetCatsStore.put(c));

    await new Promise(res => { tx.oncomplete = () => res(true); });

    // Also persist to target JSON file in Directory.External
    try {
      await Filesystem.writeFile({
        path: targetConfig.dataFileName,
        data: JSON.stringify({ version: 2, environment: toEnv, lastUpdated: Date.now(), categories: sourceCats, notes: sourceNotes }, null, 2),
        directory: Directory.External,
        encoding: Encoding.UTF8,
        recursive: true
      });
    } catch (fsErr) {}

    // If current active environment is the target, update inMemoryCache
    if (getStorageEnvironment() === toEnv) {
      inMemoryCache.notes = sourceNotes;
      inMemoryCache.categories = sourceCats;
    }

    return {
      success: true,
      count: sourceNotes.length,
      message: `Berhasil menyalin ${sourceNotes.length} catatan dari ${sourceConfig.label} ke ${targetConfig.label}.`
    };
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
  /**
   * Save the complete notes/categories collection. This method is intentionally
   * idempotent and is used by Device Vault link/restore flows.
   */
  async saveNotes(notes = [], categories = []) {
    if (!Array.isArray(notes)) {
      throw new Error('Daftar catatan tidak valid.');
    }
    const customCategories = Array.isArray(categories)
      ? categories.filter(c => c && !c.core)
      : [];

    // Process every attachment so the canonical state contains only lightweight
    // attachment metadata while the binary lives in the attachment store/file.
    const processedNotes = [];
    for (const note of notes) {
      if (!note || !note.id) continue;
      const processedAttachments = [];
      for (const att of (Array.isArray(note.attachments) ? note.attachments : [])) {
        const processed = await saveMediaAttachmentToFile(att, note.id);
        if (processed) processedAttachments.push(processed);
      }
      processedNotes.push({
        ...note,
        isPinned: Boolean(note.isPinned),
        attachments: processedAttachments,
        updatedAt: note.updatedAt || Date.now()
      });
    }

    inMemoryCache.notes = processedNotes;
    inMemoryCache.categories = customCategories;
    await saveDataToDevice({ notes: processedNotes, categories: customCategories });
    return { success: true, count: processedNotes.length };
  },

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
              directory: Directory.External
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
