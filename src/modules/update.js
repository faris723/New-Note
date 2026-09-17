/**
 * In-App Update Checker
 * ----------------------------------------------------------------------
 * Mengecek rilis terbaru di GitHub Releases dan menawarkan APK dari
 * RELEASE TERSEBUT secara deterministik.
 *
 * Penting: jangan memakai URL "latest/download/..." atau memilih APK
 * pertama secara acak. URL asset GitHub harus berasal dari release yang
 * baru saja diperiksa, sehingga APK 1.0.2 tidak tertukar dengan asset lama.
 */

const GITHUB_OWNER = 'faris723';
const GITHUB_REPO = 'New-Note';
const RELEASES_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
const DISMISSED_KEY = 'cp_update_dismissed_version';

function parseVersion(v) {
  return String(v || '0')
    .replace(/^v/i, '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
}

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

/**
 * Pilih asset APK dari release yang sama persis dengan tag yang baru dicek.
 * app-release.apk diprioritaskan karena workflow release menghasilkan file itu.
 * app-debug.apk tetap didukung sebagai fallback untuk release lama.
 */
function findReleaseApk(release) {
  const assets = Array.isArray(release?.assets) ? release.assets : [];
  const apkAssets = assets.filter((asset) =>
    String(asset?.name || '').toLowerCase().endsWith('.apk')
  );

  return (
    apkAssets.find((asset) => asset.name === 'app-release.apk') ||
    apkAssets.find((asset) => asset.name === 'app-debug.apk') ||
    apkAssets[0] ||
    null
  );
}

/** Buat URL changelog untuk versi yang benar, bukan URL compare yang stale. */
function buildChangelogUrl(currentVersion, remoteVersion) {
  const currentTag = `v${String(currentVersion).replace(/^v/i, '')}`;
  const remoteTag = `v${String(remoteVersion).replace(/^v/i, '')}`;
  return `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/compare/${currentTag}...${remoteTag}`;
}

export const UpdateService = {
  currentVersion: '0.0.0',
  latestRelease: null,

  async init(elements = {}, currentVersion) {
    if (currentVersion) this.currentVersion = currentVersion;

    if (!isRunningInsideApk()) return;

    const {
      updateModalOverlay,
      closeUpdateModalBtn,
      closeUpdateModalLaterBtn,
      updateModalBody,
      updateDownloadBtn,
      updateVersionText
    } = elements;

    try {
      const res = await fetch(`${RELEASES_API_URL}?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          Accept: 'application/vnd.github+json',
          'Cache-Control': 'no-cache'
        }
      });

      if (!res.ok) return;

      const release = await res.json();
      const remoteVersion = String(release.tag_name || '').replace(/^v/i, '');
      if (!remoteVersion || !isNewer(remoteVersion, this.currentVersion)) return;

      const dismissed = localStorage.getItem(DISMISSED_KEY);
      if (dismissed === remoteVersion) return;

      const apkAsset = findReleaseApk(release);
      if (!apkAsset?.browser_download_url) {
        console.warn('UpdateService: release tidak memiliki APK yang bisa diunduh.', release);
        return;
      }

      // Simpan release + asset yang benar-benar dipilih. URL ini menunjuk
      // ke asset pada tag release tertentu, bukan ke "latest" yang ambigu.
      this.latestRelease = { release, asset: apkAsset };
      const downloadUrl = apkAsset.browser_download_url;
      const changelogUrl = buildChangelogUrl(this.currentVersion, remoteVersion);

      if (updateVersionText) {
        updateVersionText.textContent =
          `Versi ${remoteVersion} tersedia (versi Anda saat ini: ${this.currentVersion})`;
      }

      if (updateModalBody) {
        const releaseNotes = String(release.body || '').trim();
        const safeNotes = releaseNotes
          .replace(/https?:\/\/github\.com\/faris723\/New-Note\/compare\/[^\s)]+/g, '')
          .trim();

        updateModalBody.textContent =
          `${safeNotes || 'Pembaruan tersedia dengan perbaikan dan peningkatan.'}\n\nFull Changelog: ${changelogUrl}`;
      }

      if (updateDownloadBtn) {
        updateDownloadBtn.onclick = () => {
          // Gunakan URL asset dari release yang baru saja diverifikasi.
          // Jangan pernah menggantinya dengan /releases/latest/download/.
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

      if (updateModalOverlay) updateModalOverlay.classList.add('open');
    } catch (err) {
      console.warn('UpdateService check notice:', err);
    }
  }
};
