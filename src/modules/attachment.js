/**
 * Attachment & Memory Management Service
 * Handles Object URL lifecycles (prevents memory leaks),
 * file type classification, and HTML5 Canvas-based image compression.
 */

import { SecurityService } from './security.js';

export const AttachmentService = {
  // Registry of created Object URLs for active revocation
  activeBlobUrls: new Set(),

  /**
   * Create tracked Object URL to ensure subsequent revocation.
   */
  createManagedBlobUrl(blob) {
    const url = URL.createObjectURL(blob);
    this.activeBlobUrls.add(url);
    return url;
  },

  /**
   * Safely revoke a tracked Object URL and remove from registry.
   */
  revokeManagedBlobUrl(url) {
    if (url && this.activeBlobUrls.has(url)) {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        console.warn('Revoke blob URL failed:', e);
      }
      this.activeBlobUrls.delete(url);
    }
  },

  /**
   * Revoke all currently tracked Object URLs (on modal close or page unload).
   */
  revokeAllBlobUrls() {
    this.activeBlobUrls.forEach(url => {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {}
    });
    this.activeBlobUrls.clear();
  },

  formatSize(bytes) {
    if (!bytes || bytes < 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  },

  fileExt(name) {
    const m = /\.([a-z0-9]+)$/i.exec(name || '');
    return m ? m[1].toLowerCase() : '';
  },

  classifyAttachment(att) {
    const ext = (att.ext || this.fileExt(att.name) || '').toLowerCase();
    const mime = (att.mime || '').toLowerCase();
    if (att.kind === 'voice-audio') return 'audio';
    if (att.kind === 'sketch' || mime.startsWith('image/')) return 'image';
    if (ext === 'pdf' || mime === 'application/pdf') return 'pdf';
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return 'doc';
    if (mime.startsWith('text/') || ['txt', 'md', 'json', 'csv', 'log', 'js', 'ts', 'html'].includes(ext)) return 'text';
    if (mime.startsWith('audio/')) return 'audio';
    if (mime.startsWith('video/')) return 'video';
    return 'other';
  },

  blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Gagal membaca berkas'));
      reader.readAsDataURL(blob);
    });
  },

  dataURLToBlob(dataURL) {
    return new Promise((resolve, reject) => {
      try {
        if (!dataURL || typeof dataURL !== 'string') {
          return reject(new Error('DataURL tidak valid'));
        }
        const comma = dataURL.indexOf(',');
        if (comma === -1) return reject(new Error('Format DataURL tidak valid'));
        const meta = dataURL.slice(0, comma);
        const mime = (meta.match(/:(.*?);/) || [])[1] || 'application/octet-stream';
        const base64 = dataURL.slice(comma + 1);
        const isBase64 = /;base64/i.test(meta);
        const binary = isBase64 ? atob(base64) : decodeURIComponent(base64);
        const len = binary.length;
        const u8 = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          u8[i] = binary.charCodeAt(i) & 0xff;
        }
        resolve(new Blob([u8], { type: mime }));
      } catch (e) {
        reject(e);
      }
    });
  },

  dataURLToArrayBuffer(dataURL) {
    return new Promise((resolve, reject) => {
      try {
        if (!dataURL || typeof dataURL !== 'string') {
          return reject(new Error('DataURL tidak valid'));
        }
        const comma = dataURL.indexOf(',');
        if (comma === -1) return reject(new Error('Format DataURL tidak valid'));
        const meta = dataURL.slice(0, comma);
        const base64 = dataURL.slice(comma + 1);
        const isBase64 = /;base64/i.test(meta);
        const binary = isBase64 ? atob(base64) : decodeURIComponent(base64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binary.charCodeAt(i) & 0xff;
        }
        resolve(bytes.buffer);
      } catch (e) {
        reject(e);
      }
    });
  },

  decodeBase64Text(dataURL) {
    try {
      const comma = dataURL.indexOf(',');
      const base64 = dataURL.slice(comma + 1);
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new TextDecoder('utf-8').decode(bytes);
    } catch (e) {
      return '';
    }
  },

  /**
   * Compresses image via HTML5 Canvas to prevent storage exhaustion.
   * High-resolution camera photos (2-8 MB) compress down to 60-140 KB.
   */
  compressImage(file, maxDimension = 1200, quality = 0.78) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
        return reject(new Error('Not a canvas-compressible image'));
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const outputMime = file.type === 'image/png' && file.size < 300 * 1024 ? 'image/png' : 'image/jpeg';
          const compressedDataUrl = canvas.toDataURL(outputMime, quality);

          const head = compressedDataUrl.indexOf(',') + 1;
          const approxSize = Math.round((compressedDataUrl.length - head) * 0.75);

          resolve({
            dataURL: compressedDataUrl,
            size: approxSize,
            mime: outputMime,
            ext: outputMime === 'image/png' ? 'png' : 'jpg'
          });
        };
        img.onerror = () => reject(new Error('Gagal memproses gambar'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Gagal membaca gambar'));
      reader.readAsDataURL(file);
    });
  },

  downloadBlob(blob, filename) {
    return this.saveOrDownloadBlob(blob, filename);
  },

  /**
   * Universal file saver supporting:
   * 1. Modern File System Access API (Desktop) with Streams API direct piping
   * 2. Mobile / Android fallback via standard Blob Object URL with automatic memory cleanup
   */
  async saveOrDownloadBlob(blob, filename, mimeType = 'application/octet-stream') {
    const safeName = SecurityService.sanitizeFileName(filename);

    // 1. File System Access API (Desktop Chrome, Edge, Opera)
    if ('showSaveFilePicker' in window) {
      try {
        const ext = safeName.includes('.') ? '.' + safeName.split('.').pop() : '';
        const pickerTypes = [{
          description: 'Berkas Catatan Pintar',
          accept: { [mimeType || 'application/octet-stream']: [ext || '.bin'] }
        }];

        const handle = await window.showSaveFilePicker({
          suggestedName: safeName,
          types: pickerTypes
        });

        const writable = await handle.createWritable();

        // Stream pure binary data directly to disk using Streams API
        if (blob.stream && typeof blob.stream === 'function') {
          await blob.stream().pipeTo(writable);
        } else {
          await writable.write(blob);
          await writable.close();
        }

        return { success: true, method: 'filesystem-access' };
      } catch (err) {
        // If user cancelled, don't trigger error or fallback
        if (err.name === 'AbortError') {
          return { success: false, cancelled: true };
        }
        console.warn('showSaveFilePicker fallback to Blob download:', err);
      }
    }

    // 2. Mobile / Android & Iframe Fallback: Standard Blob URL Download
    try {
      const url = this.createManagedBlobUrl(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = safeName;
      a.rel = 'noopener';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Clean up Object URL after download triggers to prevent Android RAM heap bloat
      setTimeout(() => {
        this.revokeManagedBlobUrl(url);
      }, 3500);

      return { success: true, method: 'blob-download' };
    } catch (e) {
      console.error('Download error:', e);
      throw new Error('Gagal mengunduh berkas: ' + e.message);
    }
  }
};

window.addEventListener('beforeunload', () => {
  AttachmentService.revokeAllBlobUrls();
});
