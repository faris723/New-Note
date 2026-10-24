import { Capacitor, registerPlugin } from '@capacitor/core';
const FileExport = registerPlugin('FileExport');

export const ExportImportService = {
    
    async exportNotes(dataCatatan, formatParam = 'json') {
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
            
            // Validasi format akhir, fallback ke json jika tidak dikenali
            if (!['json', 'txt', 'doc', 'pdf', 'zip'].includes(format)) {
                format = 'json'; 
            }

            console.log(`Format final yang akan diekspor: ${format}`);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            let stringData = '';
            let fileName = `Catatan_Pintar_${timestamp}.${format}`;
            let mimeType = 'text/plain';

            // 2. NORMALISASI DATA (Mencegah file kosong)
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

            // 3. ENGINE KONVERSI
            if (format === 'json' || format === 'zip') {
                stringData = JSON.stringify(notesArray, null, 2);
                fileName = `Catatan_Pintar_${timestamp}.json`;
                mimeType = 'application/json';
            } 
            else if (format === 'txt') {
                stringData = this._convertToText(notesArray);
                mimeType = 'text/plain';
            }
            else if (format === 'doc' || format === 'pdf') {
                stringData = this._convertToHTML(notesArray);
                
                if (format === 'doc') {
                    fileName = `Catatan_Pintar_${timestamp}.doc`;
                    mimeType = 'application/msword';
                } else {
                    // PENTING: Untuk PDF tanpa library eksternal, kita HARUS menyimpannya 
                    // sebagai file .html agar tidak dianggap rusak oleh OS.
                    // Pengguna dapat membukanya di browser lalu memilih "Print -> Save as PDF".
                    fileName = `Catatan_Pintar_${timestamp}_Cetak_PDF.html`;
                    mimeType = 'text/html';
                }
            }

            // 4. EKSEKUSI PENYIMPANAN
            if (Capacitor.isNativePlatform()) {
                return await this._exportNative(stringData, fileName, mimeType);
            } else {
                return await this._exportWeb(stringData, fileName, mimeType);
            }

        } catch (error) {
            console.error("Proses ekspor gagal:", error);
            if (error.message === 'USER_CANCELLED') {
                throw new Error('Ekspor dibatalkan.');
            }
            throw new Error('Gagal mengekspor data: ' + error.message);
        }
    },

    // --- HELPER: Pengekstrak Data Fleksibel ---
    _getNoteFields(note) {
        return {
            title: note.title || note.judul || note.name || 'Tanpa Judul',
            category: note.category || note.kategori || 'Umum',
            date: note.date || note.createdAt || note.tanggal || new Date().toLocaleDateString(),
            content: note.content || note.text || note.isi || note.body || note.catatan || '(Tidak ada isi catatan)'
        };
    },

    // --- HELPER: Konversi ke Text ---
    _convertToText(notesArray) {
        let text = "=== ARSIP CATATAN PINTAR ===\n\n";
        notesArray.forEach((n, index) => {
            const note = this._getNoteFields(n);
            text += `Catatan #${index + 1}\n`;
            text += `Judul    : ${note.title}\n`;
            text += `Kategori : ${note.category}\n`;
            text += `Tanggal  : ${note.date}\n`;
            text += `--------------------------------------\n`;
            text += `${note.content}\n`;
            text += `======================================\n\n`;
        });
        return text;
    },

    // --- HELPER: Konversi ke HTML (Untuk Doc dan PDF fallback) ---
    _convertToHTML(notesArray) {
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
            const note = this._getNoteFields(n);
            html += `
            <div class="note">
                <h2 class="title">${note.title}</h2>
                <p class="meta">Kategori: ${note.category} | Tanggal: ${note.date}</p>
                <div class="content">${note.content}</div>
            </div>
            `;
        });
        html += "</body></html>";
        return html;
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
        return { status: 'success', message: 'Ekspor berhasil.' };
    },

    async _exportNative(stringData, fileName, mimeType) {
        const result = await FileExport.exportFile({
            fileName: fileName,
            data: stringData,
            mimeType: mimeType
        });

        if (result.success) {
            return { status: 'success', message: 'Ekspor berhasil.' };
        } else {
            throw new Error('Plugin native gagal merespons.');
        }
    },

    async importNotes() {
        try {
            return { status: 'success', data: null };
        } catch (error) {
            throw new Error("Terjadi kesalahan saat mengimpor.");
        }
    }
};
