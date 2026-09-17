/**
 * Pemeriksa pembaruan Catatan Pintar.
 *
 * Tidak bergantung pada deteksi Capacitor supaya pengecekan juga tetap dapat
 * dipanggil dari PWA/browser. Untuk APK, tombol unduh membuka aset APK release.
 */
const GITHUB_OWNER = 'faris723';
const GITHUB_REPO = 'New-Note';
const RELEASES_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases?per_page=20`;
const RELEASE_PAGE_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
const DISMISSED_KEY = 'cp_update_dismissed_version';

function parseVersion(version) {
  return String(version || '0').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
}
function compareVersions(a, b) {
  const av = parseVersion(a); const bv = parseVersion(b);
  for (let i = 0; i < Math.max(av.length, bv.length); i++) {
    const x = av[i] || 0; const y = bv[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}
function isNewer(remote, local) { return compareVersions(remote, local) > 0; }
function findApk(release) {
  const assets = Array.isArray(release?.assets) ? release.assets : [];
  return assets.find((asset) => asset.name === 'app-release.apk')
    || assets.find((asset) => asset.name === 'app-debug.apk')
    || assets.find((asset) => String(asset.name || '').toLowerCase().endsWith('.apk'))
    || null;
}
function changelogUrl(current, remote) {
  return `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/compare/v${String(current).replace(/^v/i, '')}...v${String(remote).replace(/^v/i, '')}`;
}
function releaseNotes(release, current, remote) {
  const raw = String(release?.body || '')
    .replace(/https?:\/\/github\.com\/faris723\/New-Note\/compare\/[^\s)]+/gi, '')
    .trim();
  return `${raw ? `${raw}\n\n` : ''}Full Changelog: ${changelogUrl(current, remote)}`;
}

async function fetchReleases() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${RELEASES_API_URL}&_=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal,
      headers: { Accept: 'application/vnd.github+json', 'Cache-Control': 'no-cache' }
    });
    if (!response.ok) throw new Error(`GitHub HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export const UpdateService = {
  currentVersion: '0.0.0',
  latestRelease: null,
  elements: null,

  async check(elements = this.elements || {}, currentVersion = this.currentVersion, { silent = false } = {}) {
    this.elements = elements || this.elements || {};
    if (currentVersion) this.currentVersion = String(currentVersion).replace(/^v/i, '');
    const {
      updateModalOverlay, updateModalBody, updateDownloadBtn, updateVersionText,
      updateStatusText
    } = this.elements;
    if (updateStatusText) updateStatusText.textContent = 'Memeriksa versi terbaru…';

    try {
      const releases = await fetchReleases();
      const candidates = (Array.isArray(releases) ? releases : [])
        .filter((release) => !release?.draft && !release?.prerelease)
        .map((release) => ({ release, version: String(release.tag_name || '').replace(/^v/i, ''), asset: findApk(release) }))
        .filter((item) => item.version && isNewer(item.version, this.currentVersion))
        .sort((a, b) => compareVersions(b.version, a.version));

      const candidate = candidates[0];
      if (!candidate) {
        if (!silent && updateStatusText) updateStatusText.textContent = `Anda sudah menggunakan versi ${this.currentVersion}.`;
        return { available: false, currentVersion: this.currentVersion };
      }

      const remoteVersion = candidate.version;
      if (localStorage.getItem(DISMISSED_KEY) === remoteVersion && silent) {
        return { available: true, dismissed: true, version: remoteVersion };
      }

      this.latestRelease = candidate;
      if (updateVersionText) updateVersionText.textContent = `Versi ${remoteVersion} tersedia (versi Anda saat ini: ${this.currentVersion})`;
      if (updateModalBody) updateModalBody.textContent = releaseNotes(candidate.release, this.currentVersion, remoteVersion);
      if (updateStatusText) updateStatusText.textContent = `Versi terbaru yang tersedia: ${remoteVersion}`;
      if (updateDownloadBtn) {
        updateDownloadBtn.onclick = () => {
          const target = candidate.asset?.browser_download_url || candidate.release?.html_url || RELEASE_PAGE_URL;
          window.open(target, '_blank', 'noopener,noreferrer');
        };
        updateDownloadBtn.textContent = candidate.asset ? '⬇️ Unduh Sekarang' : '↗️ Buka Release';
      }
      if (updateModalOverlay) updateModalOverlay.classList.add('open');
      return { available: true, version: remoteVersion, asset: candidate.asset };
    } catch (error) {
      console.warn('UpdateService check notice:', error);
      if (!silent && updateStatusText) updateStatusText.textContent = 'Pemeriksaan pembaruan gagal. Periksa koneksi internet lalu coba lagi.';
      return { available: false, error };
    }
  },

  async init(elements = {}, currentVersion) {
    this.elements = elements;
    this.currentVersion = String(currentVersion || this.currentVersion).replace(/^v/i, '');
    const { closeUpdateModalBtn, closeUpdateModalLaterBtn, updateModalOverlay } = elements;
    if (closeUpdateModalBtn) closeUpdateModalBtn.onclick = () => updateModalOverlay?.classList.remove('open');
    if (closeUpdateModalLaterBtn) closeUpdateModalLaterBtn.onclick = () => {
      if (this.latestRelease?.version) localStorage.setItem(DISMISSED_KEY, this.latestRelease.version);
      updateModalOverlay?.classList.remove('open');
    };
    return this.check(elements, this.currentVersion, { silent: true });
  },

  async manualCheck() {
    return this.check(this.elements || {}, this.currentVersion, { silent: false });
  },

  releasePage() {
    return RELEASE_PAGE_URL;
  }
};
