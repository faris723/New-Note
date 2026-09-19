/**
 * FileOpenService
 * ----------------------------------------------------------------------
 * Menangani pembukaan berkas catatan (.cnote) langsung dari luar aplikasi —
 * misalnya saat pengguna mengetuk (tap) berkas .cnote di file manager
 * Android, atau membuka aplikasi lewat menu "Buka dengan...".
 *
 * Memanfaatkan Capacitor App plugin (event 'appUrlOpen' & getLaunchUrl())
 * yang didaftarkan lewat intent-filter ACTION_VIEW di AndroidManifest.xml.
 *
 * Hanya aktif di dalam APK terpasang (Capacitor native), tidak berjalan
 * sama sekali di tab browser / mode PWA.
 */

function isRunningInsideApk() {
  try {
    return !!(
      window.Capacitor &&
      typeof window.Capacitor.isNativePlatform === 'function' &&
      window.Capacitor.isNativePlatform()
    );
  } catch (e) {
    return false;
  }
}

function getCapacitorApp() {
  return (typeof window !== 'undefined' && window.Capacitor?.Plugins?.App)
    ? window.Capacitor.Plugins.App
    : null;
}

function getFileOpenPlugin() {
  return (typeof window !== 'undefined' && window.Capacitor?.Plugins?.FileOpen)
    ? window.Capacitor.Plugins.FileOpen
    : null;
}

function getCapacitorFilesystem() {
  return (typeof window !== 'undefined' && window.Capacitor?.Plugins?.Filesystem)
    ? window.Capacitor.Plugins.Filesystem
    : null;
}

export const FileOpenService = {
  /**
   * @param {(rawText: string) => (void|Promise<void>)} onNoteFileOpened
   *   Dipanggil dengan isi teks mentah (JSON) dari berkas .cnote yang dibuka.
   */
  async init(onNoteFileOpened) {
    if (!isRunningInsideApk()) return;

    const CapacitorApp = getCapacitorApp();
    const Filesystem = getCapacitorFilesystem();
    const FileOpen = getFileOpenPlugin();
    if (!CapacitorApp || (!Filesystem && !FileOpen)) return; // plugin belum tersedia

    const tryReadAndHandle = async (url) => {
      if (!url) return;
      try {
        // Android file managers commonly deliver content:// URIs. Capacitor
        // Filesystem.readFile expects an app filesystem path, so use the
        // native ContentResolver bridge for external document URIs.
        if (FileOpen?.readText) {
          const native = await FileOpen.readText({ uri: url });
          if (native?.text != null) { await onNoteFileOpened(native.text); return; }
        }
        if (Filesystem) {
          const path = String(url).startsWith('file://') ? String(url).replace(/^file:\/\//, '') : url;
          const res = await Filesystem.readFile({ path, encoding: 'utf8' });
          await onNoteFileOpened(res.data);
          return;
        }
        throw new Error('Tidak ada pembaca berkas native.');
      } catch (err) {
        console.warn('FileOpenService: gagal membaca berkas yang dibuka:', err);
      }
    };

    // 1. Aplikasi baru terbuka (cold start) LEWAT tap berkas .cnote
    try {
      const launch = await CapacitorApp.getLaunchUrl();
      if (launch && launch.url) {
        await tryReadAndHandle(launch.url);
      }
    } catch (e) {
      // getLaunchUrl mungkin tidak tersedia di versi plugin lama — abaikan.
    }

    // 2. Aplikasi sudah terbuka (warm start), lalu pengguna tap berkas .cnote lain
    try {
      CapacitorApp.addListener('appUrlOpen', (data) => {
        tryReadAndHandle(data && data.url);
      });
    } catch (e) {
      console.warn('FileOpenService: gagal memasang listener appUrlOpen:', e);
    }
  }
};
