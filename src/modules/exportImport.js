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


function crc32(bytes) {
  let crc = 0xffffffff;
  for (const b of bytes) {
    crc ^= b;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeStoredZip(entries) {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const entry of entries) {
    const name = enc.encode(String(entry.name));
    const data = entry.data instanceof Uint8Array ? entry.data : enc.encode(String(entry.data ?? ''));
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length);
    const v = new DataView(local.buffer);
    v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0x0800, true);
    v.setUint16(8, 0, true); v.setUint16(10, 0, true); v.setUint16(12, 0, true);
    v.setUint32(14, crc, true); v.setUint32(18, data.length, true); v.setUint32(22, data.length, true);
    v.setUint16(26, name.length, true); v.setUint16(28, 0, true); local.set(name, 30);
    chunks.push(local, data);
    const c = new Uint8Array(46 + name.length); const cv = new DataView(c.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true); cv.setUint16(12, 0, true); cv.setUint16(14, 0, true); cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true); cv.setUint16(28, name.length, true);
    cv.setUint16(30, 0, true); cv.setUint16(32, 0, true); cv.setUint16(34, 0, true); cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true); cv.setUint32(42, offset, true); c.set(name, 46); central.push(c);
    offset += local.length + data.length;
  }
  const centralSize = central.reduce((n, x) => n + x.length, 0);
  const eocd = new Uint8Array(22); const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, entries.length, true); ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true); ev.setUint32(16, offset, true); chunks.push(...central, eocd);
  return new Blob(chunks, { type: 'application/zip' });
}

function xmlEscape(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function buildSimpleDocx(html) {
  const doc = new DOMParser().parseFromString(SecurityService.sanitizeHTML(html), 'text/html');
  const run = (node, props = {}) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = xmlEscape(node.nodeValue || '');
      if (!t) return '';
      return `<w:r>${props.bold || props.italic || props.underline ? `<w:rPr>${props.bold ? '<w:b/>' : ''}${props.italic ? '<w:i/>' : ''}${props.underline ? '<w:u w:val="single"/>' : ''}</w:rPr>` : ''}<w:t xml:space="preserve">${t}</w:t></w:r>`;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const tag = node.tagName.toLowerCase(); const next = { ...props };
    if (tag === 'b' || tag === 'strong') next.bold = true;
    if (tag === 'i' || tag === 'em') next.italic = true;
    if (tag === 'u') next.underline = true;
    if (tag === 'br') return '<w:r><w:br/></w:r>';
    return [...node.childNodes].map(ch => run(ch, next)).join('');
  };
  const blocks = [];
  [...doc.body.childNodes].forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) { if (node.textContent?.trim()) blocks.push(`<w:p>${run(node)}</w:p>`); return; }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName.toLowerCase();
    if (tag === 'table') {
      const rows = [...node.querySelectorAll('tr')];
      blocks.push(`<w:tbl><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/><w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/></w:tblBorders></w:tblPr>${rows.map(tr => `<w:tr>${[...tr.children].map(td => `<w:tc><w:p>${run(td)}</w:p></w:tc>`).join('')}</w:tr>`).join('')}</w:tbl>`);
    } else if (['p','div','li','blockquote','pre','h1','h2','h3'].includes(tag)) {
      const style = /^h([1-3])$/.test(tag) ? `<w:pPr><w:pStyle w:val="Heading${tag.slice(1)}"/></w:pPr>` : '';
      blocks.push(`<w:p>${style}${run(node) || '<w:r><w:t></w:t></w:r>'}</w:p>`);
    } else {
      blocks.push(`<w:p>${run(node)}</w:p>`);
    }
  });
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${blocks.join('') || '<w:p><w:r><w:t></w:t></w:r></w:p>'}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style></w:styles>`;
  const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const wrels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  return makeStoredZip([{name:'[Content_Types].xml',data:types},{name:'_rels/.rels',data:rels},{name:'word/document.xml',data:documentXml},{name:'word/styles.xml',data:styles},{name:'word/_rels/document.xml.rels',data:wrels}]);
}

function buildSimplePdf(notes) {
  const lines = [];
  for (const note of notes) {
    lines.push(String(note.title || 'Tanpa Judul').toUpperCase());
    lines.push(`Kategori: ${note.category || 'Umum'}`);
    lines.push(...SecurityService.stripHtml(note.bodyHTML || '').split(/\r?\n/));
    lines.push('');
    lines.push('------------------------------------------------------------');
    lines.push('');
  }
  const clean = (s) => String(s).replace(/[^\x20-\x7E]/g, '?').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const wrapped = [];
  for (const line of lines) {
    const text = line || ' ';
    for (let i = 0; i < text.length; i += 92) wrapped.push(text.slice(i, i + 92));
  }
  const perPage = 46; const pages = Math.max(1, Math.ceil(wrapped.length / perPage));
  const objs = []; const pageIds = []; const contentIds = [];
  const add = x => { objs.push(x); return objs.length; };
  const catalog = add(null); const pagesObj = add(null); const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  for (let p = 0; p < pages; p++) {
    const body = wrapped.slice(p * perPage, (p + 1) * perPage).map((line, i) => `BT /F1 10 Tf 50 ${790 - i * 16} Td (${clean(line)}) Tj ET`).join('\n');
    contentIds.push(add(`<< /Length ${body.length} >>\nstream\n${body}\nendstream`));
    pageIds.push(add(null));
  }
  for (let i = 0; i < pages; i++) objs[pageIds[i] - 1] = `<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${contentIds[i]} 0 R >>`;
  objs[pagesObj - 1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pages} >>`;
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  let out = '%PDF-1.4\n%CatatanPintar\n'; const offsets = [0];
  for (let i = 0; i < objs.length; i++) { offsets.push(out.length); out += `${i + 1} 0 obj\n${objs[i]}\nendobj\n`; }
  const xref = out.length; out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`; for (let i = 1; i <= objs.length; i++) out += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`; out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([new TextEncoder().encode(out)], {type:'application/pdf'});
}

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
      // 1. Full portable JSON backup file inside zip. Attachment bytes are
      // embedded in the JSON, so a ZIP remains restorable even if the original
      // device-side attachment files are no longer present.
      const zipEntries = [
        { name: 'cadangan_lengkap.json', data: JSON.stringify(backupData, null, 2) },
        { name: 'BACA_SAYA.txt', data: `Arsip Cadangan Catatan Pintar — Offline\nTanggal Ekspor: ${now.toLocaleString('id-ID')}\nJumlah Catatan: ${notes.length}\n\nFolder \"dokumen_catatan\": Teks catatan.\nFolder \"lampiran\": Berkas lampiran.` }
      ];
      for (let i = 0; i < portableNotes.length; i++) {
        const note = portableNotes[i];
        const safeTitle = SecurityService.sanitizeFileName(note.title || `catatan_${i + 1}`);
        const plainBody = SecurityService.stripHtml(note.bodyHTML || '');
        const metaHeader = `=== ${note.title || 'Tanpa Judul'} ===\nKategori: ${note.category || 'Umum'}\nDisematkan: ${note.isPinned ? 'Ya' : 'Tidak'}\nDibuat: ${new Date(note.createdAt).toLocaleString('id-ID')}\nDiperbarui: ${new Date(note.updatedAt).toLocaleString('id-ID')}\n${note.finance ? `Transaksi: ${note.finance.type} Rp ${note.finance.amount}\n` : ''}\n----------------------------------------\n\n`;
        zipEntries.push({ name: `dokumen_catatan/${String(i + 1).padStart(3, '0')}_${safeTitle}.txt`, data: metaHeader + plainBody });
        for (const att of (note.attachments || [])) {
          if (!att.dataURL) continue;
          try {
            const comma = att.dataURL.indexOf(',');
            if (comma !== -1) zipEntries.push({ name: `lampiran/${note.id}_${SecurityService.sanitizeFileName(att.name || 'lampiran')}`, data: AttachmentService.dataURLToArrayBuffer(att.dataURL).then(b => new Uint8Array(b)) });
          } catch (err) { console.warn('Gagal memaketkan lampiran:', err); }
        }
      }
      const resolvedEntries = [];
      for (const entry of zipEntries) resolvedEntries.push({ name: entry.name, data: entry.data instanceof Promise ? await entry.data : entry.data });
      const zipBlob = makeStoredZip(resolvedEntries);
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
      const blob = buildSimpleDocx(htmlDoc);
      const result = await AttachmentService.saveOrDownloadBlob(blob, `CatatanPintar_Dokumen_${dateStr}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      return { success: true, count: notes.length, result };
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
      const blob = buildSimplePdf(notes);
      const result = await AttachmentService.saveOrDownloadBlob(blob, `CatatanPintar_Dokumen_${dateStr}.pdf`, 'application/pdf');
      return { success: true, count: notes.length, result };
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
