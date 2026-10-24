import { Capacitor, registerPlugin } from '@capacitor/core';
const FileExport = registerPlugin('FileExport');

// Helper untuk memuat library JSZip (ZIP) dan html2pdf (PDF) secara dinamis
async function loadExternalLibrary(url, globalVarName) {
    if (window[globalVarName]) return window[globalVarName];
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.onload = () => resolve(window[globalVarName]);
        script.onerror = () => reject(new Error(`Gagal memuat modul ${globalVarName}`));
        document.head.appendChild(script);
    });
}

export const ExportImportService = {
    
    async exportNotes(dataCatatan, formatParam = 'json') {
        try {
            // 1. PENDETEKSI FORMAT YANG AMAN
            // Kita TIDAK LAGI men-stringify seluruh objek event untuk mencegah error 'document' -> 'doc'
            let format = 'json';
            
            if (typeof formatParam === 'string') {
                format = formatParam.toLowerCase();
            } else if (formatParam && typeof formatParam === 'object') {
                const target = formatParam.target || formatParam.currentTarget;
                if (target) {
                    const val = (target.dataset && target.dataset.format) || target.value || target.innerText || target.textContent || '';
                    const text = val.toLowerCase();
                    if (text.includes('pdf')) format = 'pdf';
                    else if (text.includes('zip')) format = 'zip';
                    else if (text.includes('doc') || text.includes('word')) format = 'doc';
                    else if (text.includes('txt')) format = 'txt';
                } else if (formatParam.format) {
                    format = formatParam.format.toLowerCase();
                }
            }

            // Fallback terakhir jika format masih tidak dikenali
            if (!['json', 'txt', 'doc', 'pdf', 'zip'].includes(format)) {
                format = 'json';
            }

            console.log(`Mengekspor dengan format final: ${format}`);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            
            let fileName = `Catatan_Pintar_${timestamp}.${format}`;
            let stringData = '';
            let isBase64 = false;
            let mimeType = 'text/plain';

            // 2. KEMBALI KE LOGIKA TARIK DATA LAMA YANG SUDAH BERHASIL
            let catatanArray = Array.isArray(dataCatatan) ? dataCatatan : (dataCatatan.notes || [dataCatatan]);

            // 3. ENGINE KONVERSI
            if (format === 'json') {
                // Konversi standar JSON (SUDAH BERHASIL)
                stringData = JSON.stringify(dataCatatan, null, 2);
                mimeType = 'application/json';
            } 
            else if (format === 'txt') {
                // Konversi standar TXT (SUDAH BERHASIL)
                stringData = this._convertToText(catatanArray);
                mimeType = 'text/plain';
            } 
            else if (format === 'doc') {
                // Konversi standar Word/Doc (SUDAH BERHASIL)
                stringData = this._convertToHTML(catatanArray);
                mimeType = 'application/msword';
            } 
            else if (format === 'zip') {
                // GENERATE ZIP ASLI
                const JSZip = await loadExternalLibrary('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', 'JSZip');
                const zip = new JSZip();
                
                catatanArray.forEach((note, i) => {
                    const title = (note.title || note.judul || `Catatan_${i+1}`).replace(/[^a-z0-9]/gi, '_');
                    const category = note.category || note.kategori || 'Umum';
                    const date = note.date || note.createdAt || note.tanggal || '-';
                    const content = note.content || note.text || note.isi || note.catatan || '';
                    
                    zip.file(`${title}.txt`, `Judul: ${title}\nKategori: ${category}\nTanggal: ${date}\n\n${content}`);
                });
                
                stringData = await zip.generateAsync({ type: 'base64' });
                isBase64 = true;
                mimeType = 'application/zip';
            } 
            else if (format === 'pdf') {
                // GENERATE PDF ASLI
                const html2pdf = await loadExternalLibrary('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js', 'html2pdf');
                const htmlContent = this._convertToHTML(catatanArray);
                
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = htmlContent;
                
                const opt = {
                    margin:       10,
                    filename:     fileName,
                    image:        { type: 'jpeg', quality: 0.98 },
                    html2canvas:  { scale: 2 },
                    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
                };

                const pdfBase64 = await html2pdf().set(opt).from(tempDiv).outputPdf('datauristring');
                stringData = pdfBase64.split(',')[1]; // Ambil data biner base64-nya saja
                isBase64 = true;
                mimeType = 'application/pdf';
            }

            // 4. EKSEKUSI PENYIMPANAN
            if (Capacitor.isNativePlatform()) {
                const result = await FileExport.exportFile({
                    fileName: fileName,
                    data: stringData,
                    mimeType: mimeType,
                    isBase64: isBase64 // Disambungkan ke plugin Java Anda
                });
                if (!result.success) throw new Error('Plugin native gagal merespons.');
                return { status: 'success', message: 'Ekspor berhasil disimpan.' };
            } else {
                // Eksekusi jika dijalankan via Web/Browser
                const finalData = isBase64 ? this._base64ToBlob(stringData, mimeType) : new Blob([stringData], { type: mimeType });
                const url = URL.createObjectURL(finalData);
                const a = document.createElement("a");
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
                return { status: 'success', message: 'Ekspor berhasil disimpan.' };
            }

        } catch (error) {
            console.error("Proses ekspor gagal:", error);
            if (error.message === 'USER_CANCELLED') throw new Error('Ekspor dibatalkan.');
            throw new Error('Gagal mengekspor data: ' + error.message);
        }
    },

    // --- HELPER KONVERSI ---
    _convertToText(notesArray) {
        let text = "=== ARSIP CATATAN PINTAR ===\n\n";
        notesArray.forEach((note, index) => {
            const title = note.title || note.judul || note.name || 'Tanpa Judul';
            const category = note.category || note.kategori || '-';
            const date = note.date || note.createdAt || note.tanggal || '-';
            const content = note.content || note.text || note.isi || note.catatan || '(Tidak ada isi catatan)';

            text += `Catatan #${index + 1}\nJudul    : ${title}\nKategori : ${category}\nTanggal  : ${date}\n--------------------------------------\n${content}\n======================================\n\n`;
        });
        return text;
    },

    _convertToHTML(notesArray) {
        let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Arsip Catatan Pintar</title><style>body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; color: #333; } .note { border-bottom: 2px solid #ccc; margin-bottom: 20px; padding-bottom: 20px; } .title { color: #2e7d32; margin-bottom: 5px; } .meta { font-size: 0.9em; color: #666; margin-top: 0; margin-bottom: 15px; } .content { white-space: pre-wrap; }</style></head><body><h1 style="text-align: center;">Arsip Catatan Pintar</h1><hr><br>`;
        
        notesArray.forEach((note) => {
            const title = note.title || note.judul || note.name || 'Tanpa Judul';
            const category = note.category || note.kategori || '-';
            const date = note.date || note.createdAt || note.tanggal || '-';
            const content = note.content || note.text || note.isi || note.catatan || '(Tidak ada isi catatan)';

            html += `<div class="note"><h2 class="title">${title}</h2><p class="meta">Kategori: ${category} | Tanggal: ${date}</p><div class="content">${content}</div></div>`;
        });
        html += "</body></html>";
        return html;
    },

    // Helper Web untuk data biner (PDF/ZIP)
    _base64ToBlob(base64, mimeType) {
        const byteCharacters = atob(base64);
        const byteArrays = [];
        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
            const slice = byteCharacters.slice(offset, offset + 512);
            const byteNumbers = new Array(slice.length);
            for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
            }
            byteArrays.push(new Uint8Array(byteNumbers));
        }
        return new Blob(byteArrays, { type: mimeType });
    },

    async importNotes() {
        return { status: 'success', data: null };
    }
};
