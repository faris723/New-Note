/**
 * Export & Import Service
 * Handles full JSON backup/restoration and multi-file ZIP archiving with attachments
 * using client-side JSZip. Supports Word (.doc), TXT, and PDF formats.
 */

import { SecurityService } from './security.js';
import { AttachmentService } from './attachment.js';
import { StorageService } from './storage.js';

const MAX_IMPORT_FILE_BYTES = 100 * 1024 * 1024;
const MAX_IMPORT_NOTES = 10000;
const MAX_IMPORT_ATTACHMENTS = 20000;

async function buildPortableNotes(notes = []) {
  const portable = [];
  for (const note of (Array.isArray(notes) ? notes : [])) {
    const cloned = { ...note };
    cloned.attachments = [];

    for (const att of (Array.isArray(note.attachments) ? note.attachments : [])) {
      const out = {
        id: att.id, name: att.name, mime: att.mime, ext: att.ext,
        size: Number(att.size) || 0, kind: att.kind || 'file',
        createdAt: att.createdAt || Date.now(), dataURL: null
      };
      try {
        out.dataURL = att.dataURL || await StorageService.readMediaAttachment(att) || null;
      } catch (e) {
        console.warn('Gagal membaca lampiran untuk backup:', e);
      }
      cloned.attachments.push(out);
    }
    portable.push(cloned);
  }
  return portable;
}

export const ExportImportService = {
  /**
   * Export all or selected notes into specified format.
   */
  async exportNotes(notes, categories, format = 'json') {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const portableNotes = await buildPortableNotes(notes);
    const backupData = {
      app: 'Catatan Pintar — Offline',
      version: '2.1.0',
      exportedAt: now.toISOString(),
      notesCount: portableNotes.length,
      categories: categories.filter(c => !c.core),
      notes: portableNotes,
      backupFormat: 'portable-v1'
    };

    if (format === 'json') {
      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      await AttachmentService.saveOrDownloadBlob(blob, `CatatanPintar_Backup_${dateStr}.json`, 'application/json');
      return { success: true, count: notes.length };
    }

    if (format === 'zip') {
      if (!window.JSZip) {
        throw new Error('Pustaka JSZip belum siap. Silakan periksa koneksi internet saat memuat halaman.');
      }
      const zip = new window.JSZip();

      // 1. Full portable JSON backup file inside zip. Attachment bytes are
      // embedded in the JSON, so a ZIP remains restorable even if the original
      // device-side attachment files are no longer present.
      zip.file('cadangan_lengkap.json', JSON.stringify(backupData, null, 2));

      // 2. Readme
      zip.file('BACA_SAYA.txt', `Arsip Cadangan Catatan Pintar — Offline\nTanggal Ekspor: ${now.toLocaleString('id-ID')}\nJumlah Catatan: ${notes.length}\n\nFolder "dokumen_catatan": Berisi teks catatan yang dapat dibaca langsung.\nFolder "lampiran": Berisi foto, dokumen, rekaman suara, atau sketsa yang terlampir.`);

      // 3. Document folders
      const docFolder = zip.folder('dokumen_catatan');
      const attachFolder = zip.folder('lampiran');

      for (let i = 0; i < portableNotes.length; i++) {
        const note = portableNotes[i];
        const safeTitle = SecurityService.sanitizeFileName(note.title || `catatan_${i + 1}`);
        const plainBody = SecurityService.stripHtml(note.bodyHTML || '');
        const metaHeader = `=== ${note.title || 'Tanpa Judul'} ===\nKategori: ${note.category || 'Umum'}\nDisematkan: ${note.isPinned ? 'Ya' : 'Tidak'}\nDibuat: ${new Date(note.createdAt).toLocaleString('id-ID')}\nDiperbarui: ${new Date(note.updatedAt).toLocaleString('id-ID')}\n${note.finance ? `Transaksi: ${note.finance.type} Rp ${note.finance.amount}\n` : ''}\n----------------------------------------\n\n`;

        docFolder.file(`${String(i + 1).padStart(3, '0')}_${safeTitle}.txt`, metaHeader + plainBody);

        // Attachments
        if (note.attachments && note.attachments.length > 0) {
          for (const att of note.attachments) {
            if (att.dataURL) {
              try {
                const comma = att.dataURL.indexOf(',');
                if (comma !== -1) {
                  const base64 = att.dataURL.slice(comma + 1);
                  const attName = SecurityService.sanitizeFileName(att.name || 'lampiran');
                  attachFolder.file(`${note.id}_${attName}`, base64, { base64: true });
                }
              } catch (err) {
                console.warn('Gagal memaketkan lampiran ke zip:', err);
              }
            }
          }
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      await AttachmentService.saveOrDownloadBlob(zipBlob, `CatatanPintar_Arsip_${dateStr}.zip`, 'application/zip');
      return { success: true, count: notes.length };
    }

    if (format === 'word') {
      let htmlDoc = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset='utf-8'><title>Catatan Pintar</title>
        <style>
          body { font-family: Calibri, sans-serif; font-size: 11pt; line-height: 1.5; margin: 20mm; color: #222; }
          h1 { font-size: 18pt; color: #1a365d; border-bottom: 2px solid #cbd5e1; padding-bottom: 4px; margin-top: 24px; }
          .meta { font-size: 9pt; color: #64748b; margin-bottom: 12px; }
          .finance-tag { background: #f1f5f9; padding: 3px 8px; border-radius: 4px; font-weight: bold; }
          hr { border: none; border-top: 1px dashed #cbd5e1; margin: 30px 0; }
        </style>
        </head><body>
      `;

      notes.forEach((note, idx) => {
        const title = SecurityService.escapeHtml(note.title || 'Catatan');
        const d = new Date(note.updatedAt || note.createdAt).toLocaleString('id-ID');
        htmlDoc += `
          <h1>${title} ${note.isPinned ? '(Disematkan)' : ''}</h1>
          <div class="meta">Kategori: ${SecurityService.escapeHtml(note.category || 'Umum')} | Tanggal: ${d}</div>
          ${note.finance ? `<p class="finance-tag">Keuangan: ${note.finance.type} Rp ${Number(note.finance.amount).toLocaleString('id-ID')}</p>` : ''}
          <div>${SecurityService.sanitizeHTML(note.bodyHTML || '')}</div>
          ${idx < notes.length - 1 ? '<hr>' : ''}
        `;
      });

      htmlDoc += '</body></html>';
      const blob = new Blob([htmlDoc], { type: 'application/msword' });
      await AttachmentService.saveOrDownloadBlob(blob, `CatatanPintar_Dokumen_${dateStr}.doc`, 'application/msword');
      return { success: true, count: notes.length };
    }

    if (format === 'txt') {
      let fullText = '';
      notes.forEach((note, idx) => {
        const title = note.title || 'Tanpa Judul';
        const body = SecurityService.stripHtml(note.bodyHTML || '');
        const d = new Date(note.updatedAt || note.createdAt).toLocaleString('id-ID');
        fullText += `=================================================================\n`;
        fullText += `${idx + 1}. ${title.toUpperCase()} ${note.isPinned ? '[DISEMATKAN]' : ''}\n`;
        fullText += `Kategori: ${note.category || 'Umum'} | Tanggal: ${d}\n`;
        if (note.finance) {
          fullText += `Keuangan: ${note.finance.type} Rp ${Number(note.finance.amount).toLocaleString('id-ID')}\n`;
        }
        fullText += `-----------------------------------------------------------------\n\n`;
        fullText += `${body}\n\n\n`;
      });

      const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
      await AttachmentService.saveOrDownloadBlob(blob, `CatatanPintar_Teks_${dateStr}.txt`, 'text/plain');
      return { success: true, count: notes.length };
    }

    if (format === 'pdf') {
      window.print();
      return { success: true, count: notes.length };
    }

    return { success: false, error: 'Format ekspor tidak dikenal' };
  },

  /**
   * Parse and validate backup file from .json or .zip.
   */
  async parseBackupFile(file) {
    if (!file || typeof file.size !== 'number' || file.size > MAX_IMPORT_FILE_BYTES) {
      throw new Error('Berkas impor terlalu besar. Maksimum 100 MB.');
    }
    const isZip = file.name.endsWith('.zip') || file.type.includes('zip');

    if (isZip) {
      if (!window.JSZip) {
        throw new Error('Pustaka JSZip belum siap untuk membaca arsip .zip.');
      }
      const zip = await window.JSZip.loadAsync(file);
      const zipEntries = Object.values(zip.files || {});
      if (zipEntries.length > 20001) {
        throw new Error('Arsip ZIP berisi terlalu banyak berkas.');
      }
      const declaredExpandedBytes = zipEntries.reduce((sum, entry) => {
        const n = Number(entry?._data?.uncompressedSize);
        return Number.isFinite(n) && n > 0 ? sum + n : sum;
      }, 0);
      if (declaredExpandedBytes > MAX_IMPORT_FILE_BYTES) {
        throw new Error('Arsip ZIP terlalu besar setelah diekstrak.');
      }
      // Search for json backup inside zip
      let backupJsonFile = zip.file('cadangan_lengkap.json') || zip.file('catatan_semua.json') || zip.file('backup.json');

      if (!backupJsonFile) {
        // Look for any .json file
        const jsonFiles = zip.file(/\.json$/i);
        if (jsonFiles.length > 0) {
          backupJsonFile = jsonFiles[0];
        }
      }

      if (!backupJsonFile) {
        throw new Error('Tidak ditemukan berkas data .json di dalam arsip ZIP.');
      }

      const jsonContent = await backupJsonFile.async('string');
      return this.validateAndSanitizeParsedData(JSON.parse(jsonContent));
    } else {
      // Berkas JSON biasa, atau berkas catatan tunggal .cnote
      const text = await file.text();
      return this.parseBackupText(text);
    }
  },

  /**
   * Sama seperti parseBackupFile, tapi menerima string JSON mentah secara
   * langsung (dipakai saat membuka berkas .cnote dari luar aplikasi, misal
   * lewat tap file di file manager).
   */
  parseBackupText(text) {
    return this.validateAndSanitizeParsedData(JSON.parse(text));
  },

  /**
   * Validate schema and sanitize all imported notes to prevent stored XSS attacks.
   */
  validateAndSanitizeParsedData(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Format data tidak valid (bukan objek JSON).');
    }

    let rawNotes = [];
    if (Array.isArray(data.notes)) {
      rawNotes = data.notes;
    } else if (Array.isArray(data)) {
      rawNotes = data;
    } else if (data.id && (data.bodyHTML !== undefined || data.title !== undefined)) {
      // Berkas catatan tunggal (.cnote) hasil ekspor per-catatan —
      // bungkus jadi array 1 catatan supaya bisa lewat alur impor yang sama.
      rawNotes = [data];
    } else {
      throw new Error('Berkas tidak berisi daftar catatan yang valid.');
    }

    if (rawNotes.length > MAX_IMPORT_NOTES) {
      throw new Error(`Jumlah catatan melebihi batas ${MAX_IMPORT_NOTES}.`);
    }

    let totalAttachments = 0;
    rawNotes.forEach(n => {
      if (Array.isArray(n?.attachments)) totalAttachments += n.attachments.length;
    });
    if (totalAttachments > MAX_IMPORT_ATTACHMENTS) {
      throw new Error(`Jumlah lampiran melebihi batas ${MAX_IMPORT_ATTACHMENTS}.`);
    }

    const sanitizedNotes = [];
    rawNotes.forEach((n, idx) => {
      if (!n || typeof n !== 'object') return;

      const safeId = n.id ? String(n.id) : ('note_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
      const safeTitle = SecurityService.stripHtml(n.title || '').trim() || 'Catatan Tanpa Judul';
      const safeBody = SecurityService.sanitizeHTML(n.bodyHTML || n.body || '');
      const safeCategory = String(n.category || 'pribadi').toLowerCase();

      // Finance sanitize
      let safeFinance = null;
      if (n.finance && typeof n.finance === 'object') {
        safeFinance = {
          type: ['income', 'expense', 'debt'].includes(n.finance.type) ? n.finance.type : 'expense',
          amount: Math.max(0, Number(n.finance.amount) || 0),
          debtTo: SecurityService.stripHtml(n.finance.debtTo || ''),
          debtPurpose: SecurityService.stripHtml(n.finance.debtPurpose || ''),
          debtPaid: Boolean(n.finance.debtPaid)
        };
      }

      // Reminder sanitize
      let safeReminder = null;
      if (n.reminder && n.reminder.datetime) {
        safeReminder = {
          datetime: String(n.reminder.datetime),
          notified: Boolean(n.reminder.notified)
        };
      }

      // Attachments sanitize
      const safeAttachments = [];
      if (Array.isArray(n.attachments)) {
        n.attachments.forEach(att => {
          if (!att || typeof att !== 'object') return;
          safeAttachments.push({
            id: att.id ? String(att.id) : ('att_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)),
            name: SecurityService.sanitizeFileName(att.name || 'lampiran'),
            mime: String(att.mime || 'application/octet-stream'),
            ext: String(att.ext || AttachmentService.fileExt(att.name) || 'bin'),
            size: Math.max(0, Math.min(Number(att.size) || 0, MAX_IMPORT_FILE_BYTES)),
            dataURL: (typeof att.dataURL === 'string' && att.dataURL.length <= 140 * 1024 * 1024) ? att.dataURL : null,
            kind: ['file', 'voice-audio', 'sketch'].includes(att.kind) ? att.kind : 'file'
          });
        });
      }

      sanitizedNotes.push({
        id: safeId,
        title: safeTitle,
        bodyHTML: safeBody,
        category: safeCategory,
        isPinned: Boolean(n.isPinned),
        finance: safeFinance,
        reminder: safeReminder,
        attachments: safeAttachments,
        createdAt: Number(n.createdAt) || Date.now(),
        updatedAt: Number(n.updatedAt) || Date.now()
      });
    });

    const categories = Array.isArray(data.categories) ? data.categories : [];

    return {
      notes: sanitizedNotes,
      categories,
      count: sanitizedNotes.length
    };
  }
};
