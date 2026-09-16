/**
 * In-App Update Checker
 * ----------------------------------------------------------------------
 * Mengecek rilis terbaru di GitHub Releases dan menawarkan tautan unduhan
 * APK langsung dari dalam aplikasi.
 *
 * Pengecekan HANYA berjalan ketika aplikasi dibuka sebagai APK terpasang
 * (lewat Capacitor), tidak pernah berjalan di tab browser / mode PWA biasa,
 * supaya tidak mengganggu pengguna web dengan link download APK.
 */

// --- KONFIGURASI: sesuaikan dengan akun & nama repo GitHub Anda ---
const GITHUB_OWNER = 'faris723';
const GITHUB_REPO = 'New-Note';
// -------------------------------------------------------------------

const RELEASES_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
const DISMISSED_KEY = 'cp_update_dismissed_version';

/** Ubah "v1.2.3" atau "1.2.3" jadi [1,2,3] */
function parseVersion(v) {
  return String(v || '0')
    .replace(/^v/i, '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
}

/** true jika `remote` lebih baru daripada `local` */
function isNewer(remote, local) {
  const a = parseVersion(remote);
  const b = parseVersion(local);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

/** true hanya jika aplikasi berjalan sebagai APK (Capacitor native), bukan browser/PWA */
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

export const UpdateService = {
  currentVersion: '0.0.0',
  latestRelease: null,

  /**
   * @param {Object} elements - elemen DOM modal (lihat cacheElements di app.js)
   * @param {string} currentVersion - APP_VERSION dari src/version.js
   */
  async init(elements = {}, currentVersion) {
    if (currentVersion) this.currentVersion = currentVersion;

    if (!isRunningInsideApk()) {
      // Diam-diam berhenti di browser/PWA — fitur ini khusus untuk APK.
      return;
    }

    const {
      updateModalOverlay,
      closeUpdateModalBtn,
      closeUpdateModalLaterBtn,
      updateModalBody,
      updateDownloadBtn,
      updateVersionText
    } = elements;

    try {
      const res = await fetch(RELEASES_API_URL, {
        headers: { Accept: 'application/vnd.github+json' }
      });

      // Repo belum punya Release sama sekali, atau kena rate-limit —
      // diamkan saja, jangan ganggu pengguna dengan error.
      if (!res.ok) return;

      const release = await res.json();
      const remoteVersion = (release.tag_name || '').replace(/^v/i, '');
      if (!remoteVersion || !isNewer(remoteVersion, this.currentVersion)) return;

      // Jangan tampilkan lagi kalau pengguna sudah menekan "Nanti Saja"
      // untuk versi rilis yang sama persis.
      const dismissed = localStorage.getItem(DISMISSED_KEY);
      if (dismissed === remoteVersion) return;

      this.latestRelease = release;

      const apkAsset = (release.assets || []).find(
        (a) => a.name && a.name.toLowerCase().endsWith('.apk')
      );
      const downloadUrl = apkAsset ? apkAsset.browser_download_url : release.html_url;

      if (updateVersionText) {
        updateVersionText.textContent = `Versi ${remoteVersion} tersedia (versi Anda saat ini: ${this.currentVersion})`;
      }

      if (updateModalBody) {
        const notes = (release.body || '').trim();
        // .textContent (bukan innerHTML) supaya aman dari HTML/script asing
        updateModalBody.textContent = notes || 'Pembaruan tersedia dengan perbaikan dan peningkatan.';
      }

      if (updateDownloadBtn) {
        updateDownloadBtn.onclick = () => {
          window.open(downloadUrl, '_blank');
        };
      }

      if (closeUpdateModalBtn) {
        closeUpdateModalBtn.onclick = () => {
          if (updateModalOverlay) updateModalOverlay.classList.remove('open');
        };
      }

      if (closeUpdateModalLaterBtn) {
        closeUpdateModalLaterBtn.onclick = () => {
          localStorage.setItem(DISMISSED_KEY, remoteVersion);
          if (updateModalOverlay) updateModalOverlay.classList.remove('open');
        };
      }

      if (updateModalOverlay) {
        updateModalOverlay.classList.add('open');
      }
    } catch (err) {
      console.warn('UpdateService check notice:', err);
    }
  }
};
