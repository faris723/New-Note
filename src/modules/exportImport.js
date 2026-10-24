import { Capacitor, registerPlugin } from '@capacitor/core';
const FileExport = registerPlugin('FileExport');

export const ExportImportService = {
    
    // Tambahkan parameter "format" yang dikirim oleh antarmuka (UI) Anda
    async exportNotes(dataCatatan, format = 'json') {
        try {
            console.log(`Memulai proses ekspor dengan format: ${format}`);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            
            let stringData = '';
            let fileExtension = format.toLowerCase();
            let mimeType = 'text/plain';

            // --------------------------------------------------
            // 1. ENGINE KONVERSI FORMAT DATA
            // --------------------------------------------------
            if (fileExtension === 'json') {
                stringData = JSON.stringify(dataCatatan, null, 2);
                mimeType = 'application/json';
            } 
            else if (fileExtension === 'txt') {
                // Ekstrak data JSON menjadi teks yang rapi dan mudah dibaca
                stringData = this._convertToText(dataCatatan);
                mimeType = 'text/plain';
            }
            else if (fileExtension === 'word' || fileExtension === 'doc' || fileExtension === 'docx') {
                // Konversi ke format HTML (Microsoft Word bisa membaca file .doc berbasis HTML dengan sempurna)
                stringData = this._convertToHTML(dataCatatan);
                fileExtension = 'doc';
                mimeType = 'application/msword';
            }
            else if (fileExtension === 'pdf') {
                // Catatan: Jika aplikasi Anda belum menginstal library seperti jsPDF, 
                // kita simpan sebagai HTML yang rapi untuk dicetak sebagai PDF.
                stringData = this._convertToHTML(dataCatatan);
                fileExtension = 'html'; 
                mimeType = 'text/html';
                console.warn("Menggunakan format HTML sebagai PDF Fallback.");
            }
            else {
                // Format bawaan (fallback)
                stringData = JSON.stringify(dataCatatan, null, 2);
                fileExtension = 'json';
                mimeType = 'application/json';
            }

            const fileName = `Catatan_Pintar_${timestamp}.${fileExtension}`;

            // --------------------------------------------------
            // 2. EKSEKUSI PENYIMPANAN BERDASARKAN OS
            // --------------------------------------------------
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
        // Antisipasi jika data berupa array atau objek tunggal
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

    // --- HELPER: Pengubah JSON ke HTML (Untuk Word/Doc) ---
    _convertToHTML(data) {
        let html = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset='utf-8'><title>Ekspor Catatan Pintar</title></head>
        <body style="font-family: Arial, sans-serif;">
        <h1 style="text-align: center; color: #2e7d32;">Arsip Catatan Pintar</h1><hr>
        `;
        
        let catatanArray = Array.isArray(data) ? data : (data.notes || [data]);
        
        catatanArray.forEach((note) => {
            html += `<h2 style="color: #333;">${note.title || 'Tanpa Judul'}</h2>`;
            html += `<p style="font-size: 12px; color: #666;"><i>Kategori: ${note.category || '-'} | Tanggal: ${note.date || note.createdAt || '-'}</i></p>`;
            html += `<p style="font-size: 14px;">${(note.content || note.text || '').replace(/\n/g, '<br>')}</p>`;
            html += `<br><hr><br>`;
        });
        html += "</body></html>";
        return html;
    },

    // --- LOGIKA WEB ---
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

    // --- LOGIKA ANDROID ---
    async _exportNative(stringData, fileName, mimeType) {
        // Meneruskan MIME Type ke FileExportPlugin.java
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
