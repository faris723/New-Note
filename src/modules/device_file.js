/**
 * Device File Storage & Anti-Browser-Clear Vault
 *
 * Provides physical filesystem persistence using the File System Access API.
 * When linked to a real file on the user's device (e.g., 'catatan_pintar_vault.json'
 * in Documents/Downloads), data is saved directly to physical disk.
 *
 * Clearing browser cookies, cache, or site data CANNOT delete this physical file!
 */

const VAULT_FILE_NAME = 'catatan_pintar_vault.json';

let activeFileHandle = null;
let isAutoSyncEnabled = false;

// Check if browser supports File System Access API
export function isFileSystemAccessSupported() {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window && 'showOpenFilePicker' in window;
}

/**
 * Link a real physical file on device storage
 */
export async function linkDeviceVaultFile() {
  if (!isFileSystemAccessSupported()) {
    throw new Error('Browser Anda belum mendukung File System Access API secara langsung. Gunakan opsi Unduh Cadangan Fisik untuk menyimpan ke memori perangkat.');
  }

  try {
    const options = {
      suggestedName: VAULT_FILE_NAME,
      types: [
        {
          description: 'Berkas Brankas Catatan Pintar (*.json)',
          accept: { 'application/json': ['.json'] }
        }
      ]
    };

    activeFileHandle = await window.showSaveFilePicker(options);
    isAutoSyncEnabled = true;

    // Verify read/write permissions
    const permission = await verifyPermission(activeFileHandle, true);
    if (!permission) {
      throw new Error('Izin akses berkas perangkat tidak diberikan.');
    }

    return {
      success: true,
      name: activeFileHandle.name || VAULT_FILE_NAME
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, aborted: true };
    }
    throw err;
  }
}

/**
 * Open and load notes from an existing physical vault file
 */
export async function openDeviceVaultFile() {
  if (!isFileSystemAccessSupported()) {
    throw new Error('Browser Anda belum mendukung File System Access API.');
  }

  try {
    const [fileHandle] = await window.showOpenFilePicker({
      types: [
        {
          description: 'Berkas Brankas Catatan Pintar (*.json)',
          accept: { 'application/json': ['.json'] }
        }
      ],
      multiple: false
    });

    if (!fileHandle) return null;

    activeFileHandle = fileHandle;
    isAutoSyncEnabled = true;

    const file = await fileHandle.getFile();
    const text = await file.text();
    const parsed = JSON.parse(text);

    return {
      success: true,
      data: parsed,
      fileName: fileHandle.name
    };
  } catch (err) {
    if (err.name === 'AbortError') return null;
    throw err;
  }
}

/**
 * Write data to the linked physical device file
 */
export async function writeToDeviceVault(data) {
  if (!activeFileHandle || !isAutoSyncEnabled) return false;

  try {
    const hasPermission = await verifyPermission(activeFileHandle, true);
    if (!hasPermission) return false;

    const writable = await activeFileHandle.createWritable();
    const payload = {
      app: 'Catatan Pintar — Offline',
      version: 2,
      savedToPhysicalDiskAt: new Date().toISOString(),
      antiBrowserWipeProtected: true,
      notes: data.notes || [],
      categories: data.categories || []
    };

    await writable.write(JSON.stringify(payload, null, 2));
    await writable.close();
    return true;
  } catch (e) {
    console.warn('Gagal menulis ke berkas perangkat fisik:', e);
    return false;
  }
}

export function hasActiveFileHandle() {
  return Boolean(activeFileHandle && isAutoSyncEnabled);
}

export function getActiveFileName() {
  return activeFileHandle ? (activeFileHandle.name || VAULT_FILE_NAME) : null;
}

export function unlinkDeviceVault() {
  activeFileHandle = null;
  isAutoSyncEnabled = false;
}

async function verifyPermission(fileHandle, readWrite = false) {
  const options = {};
  if (readWrite) {
    options.mode = 'readwrite';
  }
  if ((await fileHandle.queryPermission(options)) === 'granted') {
    return true;
  }
  if ((await fileHandle.requestPermission(options)) === 'granted') {
    return true;
  }
  return false;
}
