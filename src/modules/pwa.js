/**
 * Progressive Web App (PWA) Manager & In-App Install Controller
 * Handles Service Worker registration, beforeinstallprompt event capture,
 * iOS Add to Home Screen guidance, and offline status indicator.
 */

export const PWAService = {
  deferredPrompt: null,
  isInstalled: false,
  isIOS: false,

  init(elements = {}) {
    const {
      installAppBtn,
      installModalOverlay,
      closeInstallModalBtn,
      closeInstallModalFootBtn,
      doInstallPromptBtn,
      offlineIndicator
    } = elements;

    // 1. Detect Standalone Display Mode (already installed on device)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator && window.navigator.standalone === true);

    this.isInstalled = isStandalone;

    // 2. Detect iOS Device
    const ua = (window.navigator && window.navigator.userAgent) ? window.navigator.userAgent.toLowerCase() : '';
    this.isIOS = /iphone|ipad|ipod/.test(ua);

    // If already installed, hide the install button or mark as installed
    if (this.isInstalled && installAppBtn) {
      installAppBtn.style.display = 'none';
    }

    // 3. Capture Chromium/Android beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevent automatic mini-infobar
      e.preventDefault();
      this.deferredPrompt = e;

      // Make install button prominently visible
      if (installAppBtn && !this.isInstalled) {
        installAppBtn.style.display = 'inline-flex';
        installAppBtn.innerHTML = '📲 Pasang Aplikasi';
      }

      if (doInstallPromptBtn) {
        doInstallPromptBtn.style.display = 'inline-flex';
      }
    });

    // 4. Listen for app installed event
    window.addEventListener('appinstalled', () => {
      this.isInstalled = true;
      this.deferredPrompt = null;
      if (installAppBtn) {
        installAppBtn.style.display = 'none';
      }
      if (installModalOverlay) {
        installModalOverlay.classList.remove('open');
      }
    });

    // 5. Connect UI Event Listeners
    if (installAppBtn) {
      installAppBtn.onclick = async () => {
        // If native prompt is ready, trigger it directly!
        if (this.deferredPrompt) {
          try {
            await this.deferredPrompt.prompt();
            const choiceResult = await this.deferredPrompt.userChoice;
            if (choiceResult && choiceResult.outcome === 'accepted') {
              this.isInstalled = true;
              this.deferredPrompt = null;
              installAppBtn.style.display = 'none';
              return;
            }
          } catch (err) {
            console.warn('Install prompt error:', err);
          }
        }

        // Otherwise, open the helpful installation guide modal
        if (installModalOverlay) {
          installModalOverlay.classList.add('open');
        }
      };
    }

    if (doInstallPromptBtn) {
      doInstallPromptBtn.onclick = async () => {
        if (this.deferredPrompt) {
          try {
            await this.deferredPrompt.prompt();
            const choiceResult = await this.deferredPrompt.userChoice;
            if (choiceResult && choiceResult.outcome === 'accepted') {
              this.isInstalled = true;
              this.deferredPrompt = null;
              if (installAppBtn) installAppBtn.style.display = 'none';
              if (installModalOverlay) installModalOverlay.classList.remove('open');
            }
          } catch (err) {
            console.warn('Install prompt error:', err);
          }
        } else if (this.isIOS) {
          alert('Untuk iPhone/iPad: Tekan ikon Bagikan (Share) di Safari, lalu pilih "Tambah ke Layar Utama".');
        } else {
          alert('Jika tombol otomatis tidak muncul, silakan klik menu titik tiga (⋮) di browser Anda dan pilih "Instal aplikasi" atau "Tambahkan ke Layar Utama".');
        }
      };
    }

    if (closeInstallModalBtn && installModalOverlay) {
      closeInstallModalBtn.onclick = () => installModalOverlay.classList.remove('open');
    }
    if (closeInstallModalFootBtn && installModalOverlay) {
      closeInstallModalFootBtn.onclick = () => installModalOverlay.classList.remove('open');
    }

    // 6. Online / Offline Connectivity Monitor
    const updateOnlineStatus = () => {
      const isOnline = navigator.onLine !== false;
      if (offlineIndicator) {
        offlineIndicator.style.display = isOnline ? 'none' : 'inline-flex';
      }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();

    // 7. Register Service Worker
    this.registerServiceWorker();
  },

  registerServiceWorker() {
    if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js', { scope: './' })
          .then((reg) => {
            console.log('Catatan Pintar Service Worker active. Scope:', reg.scope);
          })
          .catch((err) => {
            console.warn('Service Worker registration notice:', err);
          });
      });
    }
  }
};
