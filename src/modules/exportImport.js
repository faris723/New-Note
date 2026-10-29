import { Capacitor, registerPlugin } from '@capacitor/core';
import { AttachmentService } from './attachment.js';
const FileExport = registerPlugin('FileExport');

export const ExportImportService = {

    async exportNotes(dataCatatan, categoriesParam, formatParam = 'json') {
        try {
            // 1. PENDETEKSI FORMAT YANG AMAN
            let format = 'json';

            if (typeof formatParam === 'string') {
                format = formatParam.toLowerCase();
            } else if (formatParam && typeof formatParam === 'object') {
                // Mencari dari atribut data standar tanpa mengubah keseluruhan objek
                if (formatParam.detail && typeof formatParam.detail === 'string') {
                    format = formatParam.detail.toLowerCase();
                } else if (formatParam.target && formatParam.target.dataset && formatParam.target.dataset.format) {
                    format = formatParam.target.dataset.format.toLowerCase();
                } else if (formatParam.value && typeof formatParam.value === 'string') {
                    format = formatParam.value.toLowerCase();
                }
            }

            // Alias: opsi tampilan "Dokumen Word (.docx)" mengirim value="word"
            if (format === 'word' || format === 'docx') format = 'doc';

            // Validasi format akhir, fallback ke json jika tidak dikenali
            if (!['json', 'txt', 'doc', 'pdf', 'zip'].includes(format)) {
                format = 'json';
            }

            // 2. PETA ID -> NAMA KATEGORI (supaya hasil ekspor menampilkan nama asli, bukan id mentah)
            const categoryMap = {};
            if (Array.isArray(categoriesParam)) {
                categoriesParam.forEach(c => {
                    if (c && c.id) categoryMap[c.id] = c.name || c.id;
                });
            }

            console.log(`Format final yang akan diekspor: ${format}`);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            let stringData = '';
            let fileName = `Catatan_Pintar_${timestamp}.${format}`;
            let mimeType = 'text/plain';

            // 3. NORMALISASI DATA (Mencegah file kosong)
            let notesArray = [];
            if (Array.isArray(dataCatatan)) {
                notesArray = dataCatatan;
            } else if (dataCatatan && Array.isArray(dataCatatan.notes)) {
                notesArray = dataCatatan.notes;
            } else if (dataCatatan && Array.isArray(dataCatatan.data)) {
                notesArray = dataCatatan.data;
            } else if (dataCatatan && typeof dataCatatan === 'object') {
                notesArray = [dataCatatan];
            }

            // 4. ENGINE KONVERSI
            // PDF dan ZIP menghasilkan berkas BINER sungguhan (lewat jsPDF / JSZip yang
            // sudah termuat di index.html), jadi keduanya ditangani lewat jalur Blob
            // terpisah (langkah 4b) dan TIDAK melalui jalur string di bawah ini.
            if (format === 'pdf') {
                const blob = this._generatePdfBlob(notesArray, categoryMap);
                fileName = `Catatan_Pintar_${timestamp}.pdf`;
                mimeType = 'application/pdf';
                // Android memakai Save As yang sama dengan Word, tetapi data PDF
                // dikirim sebagai Base64 agar byte biner tidak rusak saat ditulis.
                if (Capacitor.isNativePlatform()) {
                    const bytes = new Uint8Array(await blob.arrayBuffer());
                    let binary = '';
                    const chunkSize = 0x8000;
                    for (let i = 0; i < bytes.length; i += chunkSize) {
                        binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunkSize, bytes.length)));
                    }
                    const result = await FileExport.exportFile({
                        fileName, data: btoa(binary), mimeType, isBase64: true
                    });
                    return { status: 'success', message: 'Ekspor berhasil.', result: { method: 'android-save-picker', location: result.uri || '' } };
                }
                const saveResult = await AttachmentService.saveOrDownloadBlob(blob, fileName, mimeType);
                if (saveResult?.cancelled) return { status: 'cancelled', cancelled: true, message: 'Ekspor dibatalkan.' };
                return { status: 'success', message: 'Ekspor berhasil.', result: saveResult };
            }
            if (format === 'zip') {
                const blob = await this._generateZipBlob(notesArray, categoryMap, timestamp);
                if (!(blob instanceof Blob) || blob.size < 22) {
                    throw new Error('Berkas ZIP gagal dibuat atau kosong.');
                }
                fileName = `Catatan_Pintar_${timestamp}.zip`;
                mimeType = 'application/zip';

                // Samakan jalur penyimpanan Android dengan ekspor PDF utama:
                // kirim ZIP sebagai Base64 ke ACTION_CREATE_DOCUMENT. Jangan gunakan
                // jalur ekspor bertahap untuk format ini karena alur itu sebelumnya
                // menjadi sumber ketidakkonsistenan pada perangkat.
                if (Capacitor.isNativePlatform()) {
                    const bytes = new Uint8Array(await blob.arrayBuffer());
                    let binary = '';
                    const chunkSize = 0x8000;
                    for (let i = 0; i < bytes.length; i += chunkSize) {
                        binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunkSize, bytes.length)));
                    }
                    const result = await FileExport.exportFile({
                        fileName, data: btoa(binary), mimeType, isBase64: true
                    });
                    if (!result || result.success === false) throw new Error('Plugin Android gagal menyimpan berkas ZIP.');
                    return { status: 'success', message: 'Ekspor berhasil.', result: { method: 'android-save-picker', location: result.uri || '' } };
                }

                const saveResult = await AttachmentService.saveOrDownloadBlob(blob, fileName, mimeType);
                if (saveResult?.cancelled) return { status: 'cancelled', cancelled: true, message: 'Ekspor dibatalkan.' };
                if (saveResult?.success === false) throw new Error('Berkas ZIP tidak berhasil disimpan.');
                return { status: 'success', message: 'Ekspor berhasil.', result: saveResult };
            }

            if (format === 'json') {
                stringData = JSON.stringify(notesArray, null, 2);
                fileName = `Catatan_Pintar_${timestamp}.json`;
                mimeType = 'application/json';
            }
            else if (format === 'txt') {
                stringData = this._convertToText(notesArray, categoryMap);
                mimeType = 'text/plain';
            }
            else if (format === 'doc') {
                stringData = this._convertToHTML(notesArray, categoryMap);
                fileName = `Catatan_Pintar_${timestamp}.doc`;
                mimeType = 'application/msword';
            }

            // 5. EKSEKUSI PENYIMPANAN (format berbasis teks: json/txt/doc)
            if (Capacitor.isNativePlatform()) {
                return await this._exportNative(stringData, fileName, mimeType);
            } else {
                return await this._exportWeb(stringData, fileName, mimeType);
            }

        } catch (error) {
            console.error("Proses ekspor gagal:", error);
            if (error.message === 'USER_CANCELLED') {
                // Dibatalkan pengguna bukan kegagalan — kembalikan status, jangan lempar error,
                // supaya UI bisa menampilkan pesan netral alih-alih pesan "Gagal ekspor" berwarna merah.
                return { status: 'cancelled', cancelled: true, message: 'Ekspor dibatalkan.' };
            }
            throw new Error('Gagal mengekspor data: ' + error.message);
        }
    },

    // --- HELPER: Pengekstrak Data Fleksibel ---
    _getNoteFields(note, categoryMap = {}) {
        const rawCategoryId = note.category || note.kategori || '';
        const categoryName = (rawCategoryId && categoryMap[rawCategoryId]) || rawCategoryId || 'Umum';
        // Field isi catatan yang sebenarnya adalah bodyHTML (berisi HTML dari editor).
        // Nama-nama lain tetap dicoba sebagai fallback untuk sumber data lama/lain.
        const rawHtml = note.bodyHTML || note.content || note.text || note.isi || note.body || note.catatan || '';
        return {
            title: note.title || note.judul || note.name || 'Tanpa Judul',
            category: categoryName,
            date: note.date || note.createdAt || note.tanggal || new Date().toLocaleDateString(),
            bodyHTML: rawHtml || '<p>(Tidak ada isi catatan)</p>',
            plainText: this._htmlToPlainText(rawHtml) || '(Tidak ada isi catatan)'
        };
    },

    // --- HELPER: HTML -> teks polos (untuk ekspor .txt) ---
    _htmlToPlainText(html) {
        if (!html) return '';
        try {
            const doc = new DOMParser().parseFromString(String(html), 'text/html');
            return (doc.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
        } catch (e) {
            return String(html).replace(/<[^>]*>/g, ' ').trim();
        }
    },

    // --- HELPER: Escape teks untuk disisipkan ke HTML ---
    _escapeHtml(str) {
        return String(str ?? '').replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));
    },

    // --- HELPER: Konversi ke Text ---
    _convertToText(notesArray, categoryMap = {}) {
        let text = "=== ARSIP CATATAN PINTAR ===\n\n";
        notesArray.forEach((n, index) => {
            const note = this._getNoteFields(n, categoryMap);
            text += `Catatan #${index + 1}\n`;
            text += `Judul    : ${note.title}\n`;
            text += `Kategori : ${note.category}\n`;
            text += `Tanggal  : ${note.date}\n`;
            text += `--------------------------------------\n`;
            text += `${note.plainText}\n`;
            text += `======================================\n\n`;
        });
        return text;
    },

    // --- HELPER: Konversi ke HTML (Untuk Doc dan PDF fallback) ---
    _convertToHTML(notesArray, categoryMap = {}) {
        let html = `<!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Arsip Catatan Pintar</title>
            <style>
                body { font-family: sans-serif; line-height: 1.6; padding: 20px; color: #333; }
                .note { border-bottom: 2px solid #ccc; margin-bottom: 20px; padding-bottom: 20px; }
                .title { color: #2e7d32; margin-bottom: 5px; }
                .meta { font-size: 0.9em; color: #666; margin-top: 0; margin-bottom: 15px; }
                .content { white-space: pre-wrap; }
            </style>
        </head>
        <body>
            <h1 style="text-align: center;">Arsip Catatan Pintar</h1>
            <hr><br>
        `;

        notesArray.forEach((n) => {
            const note = this._getNoteFields(n, categoryMap);
            html += `
            <div class="note">
                <h2 class="title">${this._escapeHtml(note.title)}</h2>
                <p class="meta">Kategori: ${this._escapeHtml(note.category)} | Tanggal: ${this._escapeHtml(String(note.date))}</p>
                <div class="content">${note.bodyHTML}</div>
            </div>
            `;
        });
        html += "</body></html>";
        return html;
    },

    // --- HELPER: Buat PDF biner sungguhan dengan jsPDF (sudah termuat via CDN) ---
    // Dirender sebagai teks tersusun rapi (bukan rendering HTML pixel-perfect) karena
    // hanya jsPDF murni yang termuat di app ini (tanpa html2canvas), sehingga pendekatan
    // ini paling akurat dan tidak butuh pustaka tambahan.
    _generatePdfBlob(notesArray, categoryMap = {}) {
        // jsPDF dimuat dari CDN pada web. APK/offline dapat gagal memuat CDN,
        // jadi jangan gagalkan ekspor: gunakan generator PDF lokal minimal sebagai fallback.
        const jsPDFClass = window.jspdf?.jsPDF || window.jsPDF;
        if (!jsPDFClass) return this._generateBasicPdfBlob(notesArray, categoryMap);

        const doc = new jsPDFClass({ unit: 'pt', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const marginX = 42;
        const maxWidth = pageWidth - marginX * 2;
        let y = 56;

        const ensureSpace = (needed) => {
            if (y + needed > pageHeight - 40) { doc.addPage(); y = 56; }
        };

        doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
        doc.text('Arsip Catatan Pintar', pageWidth / 2, y, { align: 'center' });
        y += 18;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(120);
        doc.text(`Diekspor: ${new Date().toLocaleString('id-ID')} · ${notesArray.length} catatan`, pageWidth / 2, y, { align: 'center' });
        y += 26;

        notesArray.forEach((n) => {
            const note = this._getNoteFields(n, categoryMap);
            ensureSpace(40);
            doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(30);
            const titleLines = doc.splitTextToSize(note.title, maxWidth);
            titleLines.forEach((line) => { ensureSpace(14); doc.text(line, marginX, y); y += 14; });

            doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110);
            doc.text(`Kategori: ${note.category}  |  Tanggal: ${note.date}`, marginX, y);
            y += 16;

            doc.setFontSize(10); doc.setTextColor(35);
            const bodyLines = doc.splitTextToSize(note.plainText, maxWidth);
            bodyLines.forEach((line) => { ensureSpace(13); doc.text(line, marginX, y); y += 13; });

            y += 10; ensureSpace(8);
            doc.setDrawColor(222); doc.line(marginX, y, marginX + maxWidth, y);
            y += 20;
        });

        return doc.output('blob');
    },

    // Fallback PDF mandiri: tidak membutuhkan CDN/library eksternal. Teks disimpan
    // sebagai PDF standar dengan font Helvetica; karakter di luar WinAnsi ditransliterasi.
    _generateBasicPdfBlob(notesArray, categoryMap = {}) {
        const encoder = new TextEncoder();
        const safe = (value) => String(value ?? '')
            .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\x20-\x7E]/g, ' ')
            .replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
        const wrap = (text, max = 92) => {
            const words = String(text || '').split(/\s+/);
            const lines = []; let line = '';
            for (const word of words) {
                if (!word) continue;
                if ((line + ' ' + word).trim().length > max && line) { lines.push(line); line = word; }
                else line = (line ? line + ' ' : '') + word;
            }
            if (line) lines.push(line);
            return lines.length ? lines : [''];
        };
        const lines = ['ARSIP CATATAN PINTAR', `Diekspor: ${new Date().toLocaleString('id-ID')} | ${notesArray.length} catatan`, ''];
        notesArray.forEach((raw, i) => {
            const n = this._getNoteFields(raw, categoryMap);
            lines.push(`${i + 1}. ${n.title}`, `Kategori: ${n.category} | Tanggal: ${n.date}`, ...wrap(n.plainText), '');
        });
        const pages = []; let page = [];
        for (const line of lines) { if (page.length >= 48) { pages.push(page); page = []; } page.push(line); }
        if (page.length || !pages.length) pages.push(page);
        const objects = [];
        const addObj = (s) => { objects.push(s); return objects.length; };
        const catalogId = addObj('');
        const pagesId = addObj('');
        const fontId = addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
        const pageIds = [];
        pages.forEach((pageLines) => {
            let stream = 'BT\n/F1 10 Tf\n50 790 Td\n';
            pageLines.forEach((line, idx) => {
                if (idx) stream += '0 -15 Td\n';
                stream += `(${safe(line)}) Tj\n`;
            });
            stream += 'ET';
            const streamBytes = encoder.encode(stream).length;
            const contentId = addObj(`<< /Length ${streamBytes} >>\nstream\n${stream}\nendstream`);
            const pageId = addObj(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
            pageIds.push(pageId);
        });
        objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
        objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
        let pdf = '%PDF-1.4\n%CPFallback\n'; const offsets = [0];
        objects.forEach((obj, i) => { offsets.push(encoder.encode(pdf).length); pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
        const xref = encoder.encode(pdf).length;
        pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
        for (let i = 1; i < offsets.length; i++) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
        pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
        return new Blob([pdf], { type: 'application/pdf' });
    },

    async exportSingleNote(note, categories = []) {
        try {
            const result = await this.exportNotes([note], categories, 'pdf');
            return result?.cancelled ? { success: false, cancelled: true } : { success: true, result: result?.result };
        } catch (error) {
            return { success: false, error: error?.message || 'Gagal mengekspor PDF.' };
        }
    },

    // --- HELPER: Buat ZIP biner sungguhan dengan JSZip (sudah termuat via CDN) ---
    // Berisi backup JSON penuh (untuk impor ulang) + ringkasan TXT yang mudah dibaca manusia.
    async _generateZipBlob(notesArray, categoryMap = {}, timestamp) {
        const files = [
            { name: `Catatan_Pintar_${timestamp}_backup.json`, data: JSON.stringify(notesArray, null, 2) },
            { name: `Catatan_Pintar_${timestamp}_ringkasan.txt`, data: this._convertToText(notesArray, categoryMap) }
        ];
        // Gunakan JSZip jika CDN berhasil dimuat. Jika offline/CDN gagal di Android
        // WebView, buat ZIP valid tanpa kompresi agar ekspor tetap dapat berjalan.
        if (typeof window !== 'undefined' && window.JSZip) {
            const zip = new window.JSZip();
            files.forEach(file => zip.file(file.name, file.data));
            return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
        }
        return this._generateStoredZipBlob(files);
    },

    // Generator ZIP fallback (metode STORE, tanpa kompresi) berbasis format ZIP standar.
    // Ini menghindari ketergantungan wajib pada JSZip CDN saat aplikasi digunakan offline.
    _generateStoredZipBlob(files) {
        const encoder = new TextEncoder();
        const crc32 = (bytes) => {
            let crc = 0xffffffff;
            for (let i = 0; i < bytes.length; i++) {
                crc ^= bytes[i];
                for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
            }
            return (crc ^ 0xffffffff) >>> 0;
        };
        const u16 = (n) => [n & 255, (n >>> 8) & 255];
        const u32 = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
        const localParts = [], centralParts = [];
        let offset = 0;
        for (const file of files) {
            const name = encoder.encode(file.name);
            const data = encoder.encode(file.data);
            const crc = crc32(data);
            const localHeader = new Uint8Array([
                ...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0),
                ...u16(0), ...u16(0), ...u32(crc), ...u32(data.length), ...u32(data.length),
                ...u16(name.length), ...u16(0), ...name
            ]);
            localParts.push(localHeader, data);
            const centralHeader = new Uint8Array([
                ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0),
                ...u16(0), ...u16(0), ...u32(crc), ...u32(data.length), ...u32(data.length),
                ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...name
            ]);
            centralParts.push(centralHeader);
            offset += localHeader.length + data.length;
        }
        const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
        const end = new Uint8Array([
            ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length),
            ...u32(centralSize), ...u32(offset), ...u16(0)
        ]);
        return new Blob([...localParts, ...centralParts, end], { type: 'application/zip' });
    },

    async _exportWeb(stringData, fileName, mimeType) {
        const blob = new Blob([stringData], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
        return { status: 'success', message: 'Ekspor berhasil.', result: { method: 'blob-download' } };
    },

    async _exportNative(stringData, fileName, mimeType) {
        const result = await FileExport.exportFile({
            fileName: fileName,
            data: stringData,
            mimeType: mimeType
        });

        if (result.success) {
            return {
                status: 'success',
                message: 'Ekspor berhasil.',
                result: { method: 'android-save-picker', location: result.uri || '' }
            };
        } else {
            throw new Error('Plugin native gagal merespons.');
        }
    },

    // Membaca format backup yang benar-benar dihasilkan aplikasi: JSON utama
    // berupa array catatan, envelope backup versi baru, dan backup finance-v2.
    async parseBackupFile(file) {
        if (!file || typeof file.text !== 'function') throw new Error('Berkas cadangan tidak dapat dibaca.');
        const rawText = await file.text();
        if (!rawText || !rawText.trim()) throw new Error('Berkas JSON kosong.');
        let parsed;
        try { parsed = JSON.parse(rawText.replace(/^\uFEFF/, '').trim()); }
        catch (_) { throw new Error('Format JSON tidak valid atau berkas rusak.'); }

        // Ekspor JSON utama saat ini menghasilkan array catatan langsung.
        if (Array.isArray(parsed)) {
            if (!parsed.every(item => item && typeof item === 'object' && !Array.isArray(item))) {
                throw new Error('Struktur daftar catatan di dalam JSON tidak valid.');
            }
            return { notes: parsed, categories: [], count: parsed.length, financeState: null };
        }
        if (!parsed || typeof parsed !== 'object') throw new Error('Struktur cadangan JSON tidak dikenali.');

        // Backup keuangan memakai backupFormat=finance-v2 dan properti transactions.
        if (parsed.backupFormat === 'finance-v2' || (Array.isArray(parsed.transactions) && ('obligations' in parsed || 'savings' in parsed))) {
            const transactions = Array.isArray(parsed.transactions) ? parsed.transactions : [];
            const notes = transactions.map((tx, index) => {
                const sourceFinance = tx.finance && typeof tx.finance === 'object' ? tx.finance : {};
                const type = tx.type || sourceFinance.type || 'expense';
                const amount = Number(tx.amount ?? sourceFinance.amount ?? 0) || 0;
                const date = tx.date || sourceFinance.date || new Date().toISOString().slice(0, 10);
                return {
                    ...tx,
                    id: tx.id || `finance_import_${Date.now()}_${index}`,
                    title: tx.title || tx.judul || 'Transaksi keuangan',
                    category: 'keuangan',
                    createdAt: tx.createdAt || Date.now(),
                    finance: { ...sourceFinance, type, amount, date }
                };
            });
            return {
                notes, categories: [], count: notes.length,
                financeState: {
                    obligations: Array.isArray(parsed.obligations) ? parsed.obligations : [],
                    savings: Array.isArray(parsed.savings) ? parsed.savings : [],
                    history: Array.isArray(parsed.history) ? parsed.history : []
                }
            };
        }

        // Format envelope untuk backup penuh yang membawa metadata dan data pendukung.
        const notes = Array.isArray(parsed.notes) ? parsed.notes : (Array.isArray(parsed.data) ? parsed.data : null);
        if (!notes) throw new Error('JSON tidak berisi daftar catatan atau transaksi yang dapat diimpor.');
        if (!notes.every(item => item && typeof item === 'object' && !Array.isArray(item))) {
            throw new Error('Ada data catatan yang formatnya tidak valid.');
        }
        const financeState = parsed.financeState && typeof parsed.financeState === 'object' ? parsed.financeState : null;
        return {
            notes,
            categories: Array.isArray(parsed.categories) ? parsed.categories : [],
            count: notes.length,
            financeState
        };
    },

    async importNotes() {
        try {
            return { status: 'success', data: null };
        } catch (error) {
            throw new Error("Terjadi kesalahan saat mengimpor.");
        }
    }
};
