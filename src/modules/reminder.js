/**
 * Reminders & Local Notifications Service
 * Web Notification API integration, synthesized Web Audio chime alert,
 * and periodic checking loop for pending note reminders.
 */

import { SecurityService } from './security.js';

export const ReminderService = {
  checkInterval: null,
  activeAlertNote: null,

  /**
   * Request system notification permission from the user.
   */
  async requestPermission() {
    if (!('Notification' in window)) {
      return 'unsupported';
    }
    try {
      const perm = await Notification.requestPermission();
      return perm;
    } catch (e) {
      return 'denied';
    }
  },

  getPermissionState() {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
  },

  /**
   * Play clean synthesized two-tone chime via Web Audio API.
   * Runs 100% offline without external audio files.
   */
  playChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // First tone (D5 - 587.33 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.25);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.5);

      // Second tone (A5 - 880 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(880, now + 0.18);
      gain2.gain.setValueAtTime(0.25, now + 0.18);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.18);
      osc2.stop(now + 0.7);
    } catch (e) {
      console.warn('Synthesized chime error:', e);
    }
  },

  /**
   * Format reminder timestamp into friendly Indonesian badge label.
   */
  formatReminderBadge(reminder) {
    if (!reminder || !reminder.datetime) return null;
    const remTime = new Date(reminder.datetime).getTime();
    const now = Date.now();
    const d = new Date(remTime);
    const dateStr = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) + ', ' +
                    d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    if (reminder.notified) {
      return { status: 'done', text: `⏰ Selesai (${dateStr})` };
    }
    if (remTime < now) {
      return { status: 'overdue', text: `⏰ Lewat (${dateStr})` };
    }
    return { status: 'upcoming', text: `⏰ ${dateStr}` };
  },

  /**
   * Start periodic checker loop.
   */
  startReminderChecker(getNotesFn, onTriggerFn) {
    if (this.checkInterval) clearInterval(this.checkInterval);

    const check = async () => {
      const notes = getNotesFn();
      const now = Date.now();

      for (const note of notes) {
        if (note && note.reminder && note.reminder.datetime && !note.reminder.notified) {
          const remTime = new Date(note.reminder.datetime).getTime();
          if (remTime <= now) {
            // Mark reminder as notified
            note.reminder.notified = true;
            this.playChime();

            // Browser notification
            if ('Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification(`⏰ Pengingat: ${note.title || 'Catatan'}`, {
                  body: SecurityService.stripHtml(note.bodyHTML).slice(0, 100) || 'Waktunya memeriksa catatan ini.',
                  icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text y="20" font-size="20">⏰</text></svg>'
                });
              } catch (err) {
                console.warn('Notification display error:', err);
              }
            }

            // Callback to show in-app modal alert and persist updated status
            onTriggerFn(note);
          }
        }
      }
    };

    // Check immediately and then every 15 seconds
    check();
    this.checkInterval = setInterval(check, 15000);
  },

  stopReminderChecker() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
};
