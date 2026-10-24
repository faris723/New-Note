import { Capacitor, registerPlugin } from '@capacitor/core';
const FileExport = registerPlugin('FileExport');

export const ExportImportService = {
    
    async exportNotes(dataCatatan, formatOpt = 'json') {
        try {
            // 1. JARING PENGAMAN (SAFETY CHECK)
            // Memastikan format selalu berupa huruf kecil string, 
            // meskipun UI tidak sengaja mengirim event klik (objek)
            let format = 'json';
            if (typeof formatOpt === 'string') {
                format = formatOpt;
            } else if (formatOpt && typeof formatOpt === 'object') {
                if (formatOpt.target) {
                    format = 'json'; // Jika berupa event klik, paksa jadi json
                } else if (typeof formatOpt.format === 'string') {
                    format = formatOpt.format; // Jika UI mengirim objek {format: 'txt'}
                }
            }

            console.log(`Memulai proses ekspor dengan format: ${format}`);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            
            let stringData = '';
            let fileExtension = format.toLowerCase();
            let mimeType = 'text/plain';

            // 2. ENGINE KONVERSI FORMAT DATA
            if (fileExtension === 'json') {
                stringData = JSON.stringify(dataCatatan, null, 2);
                mimeType = 'application/json';
            } 
            else if (fileExtension === 'txt') {
                stringData = this._convertToText(dataCatatan);
                mimeType = 'text/plain';
            }
            else if (fileExtension === 'word' || fileExtension === 'doc' || fileExtension === 'docx') {
                stringData = this._convertToHTML(dataCatatan);
                fileExtension = 'doc';
                mimeType = 'application/msword';
            }
            else if (fileExtension === 'pdf') {
                // Catatan: Karena PDF butuh library khusus (seperti jsPDF) untuk membuat file biner asli,
                // fallback paling aman tanpa merusak aplikasi adalah mengekspornya sebagai HTML cetak.
                stringData = this._convertToHTML(dataCatatan);
                fileExtension = 'html'; 
                mimeType = 'text/html';
            }
            else if (fileExtension === 'zip') {
                // Sama halnya dengan Zip (butuh library JSZip). Fallback aman ke JSON.
                stringData = JSON.stringify(dataCatatan, null, 2);
                fileExtension = 'json';
                mimeType = 'application/json';
            }
            else {
                stringData = JSON.stringify(dataCatatan, null, 2);
                fileExtension = 'json';
                mimeType = 'application/json';
            }

            const fileName = `Catatan_Pintar_${timestamp}.${fileExtension}`;

            // 3. EKSEKUSI PENYIMPANAN
            if (Capacitor.isNativePlatform()) {
                return await this._exportNative(stringData, fileName, mimeType);
            } else {
                return await this._exportWeb(stringData, fileName, mimeType);
            }

        } catch (error) {
            console.error("Proses ekspor gagal:", error);
            if (error.message === 'USER_CANCELLED') {
                throw new Error('Ekspor dibatalkan oleh pengguna.');
            }
            throw new Error('Gagal mengekspor data: ' + error.message);
        }
    },

    // --- HELPER: Pengubah JSON ke Text ---
    _convertToText(data) {
        let text = "=== DATA CATATAN PINTAR ===\n\n";
        let catatanArray = Array.isArray(data) ? data : (data.notes || [data]);
        
        catatanArray.forEach((note, index) => {
            text += `Catatan #${index + 1}\n`;
            text += `Judul   : ${note.title || 'Tanpa Judul'}\n`;
            text += `Kategori: ${note.category || 'Uncategorized'}\n`;
            text += `Tanggal : ${note.date || note.createdAt || '-'}\n`;
            text += `Isi Catatan:\n${note.content || note.text || '-'}\n`;
            text += `\n--------------------------------------\n\n`;
        });
        return text;
    },

    // --- HELPER: Pengubah JSON ke HTML (Untuk Word/PDF Print) ---
    _convertToHTML(data) {
        let html = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset='utf-8'><title>Ekspor Catatan Pintar</title></head>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h1 style="text-align: center; color: #2e7d32;">Arsip Catatan Pintar</h1><hr>
        `;
        
        let catatanArray = Array.isArray(data) ? data : (data.notes || [data]);
        
        catatanArray.forEach((note) => {
            html += `<h2 style="color: #333; margin-bottom: 5px;">${note.title || 'Tanpa Judul'}</h2>`;
            html += `<p style="font-size: 12px; color: #666; margin-top: 0;"><i>Kategori: ${note.category || '-'} | Tanggal: ${note.date || note.createdAt || '-'}</i></p>`;
            html += `<p style="font-size: 14px; line-height: 1.6;">${(note.content || note.text || '').replace(/\n/g, '<br>')}</p>`;
            html += `<br><hr><br>`;
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
            throw new Error('Plugin native gagal merespons dengan benar.');
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
