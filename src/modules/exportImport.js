import { Capacitor, registerPlugin } from '@capacitor/core';
const FileExport = registerPlugin('FileExport');

// Helper untuk memuat library eksternal secara dinamis
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
            let format = 'json';
            
            if (typeof formatParam === 'string') {
                format = formatParam.toLowerCase();
            } else if (formatParam && typeof formatParam === 'object') {
                const targetText = formatParam.target ? (formatParam.target.value || formatParam.target.textContent || '') : '';
                const objStr = JSON.stringify(formatParam) + String(targetText);
                const text = objStr.toLowerCase();
                
                if (text.includes('pdf')) format = 'pdf';
                else if (text.includes('zip')) format = 'zip';
                else if (text.includes('doc') || text.includes('word')) format = 'doc';
                else if (text.includes('txt')) format = 'txt';
            }

            console.log(`Mengekspor format asli: ${format}`);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            
            let stringData = '';
            let isBase64 = false;
            let mimeType = 'text/plain';
            let fileName = `Catatan_Pintar_${timestamp}.${format}`;

            let notesArray = [];
            if (Array.isArray(dataCatatan)) notesArray = dataCatatan;
            else if (dataCatatan && Array.isArray(dataCatatan.notes)) notesArray = dataCatatan.notes;
            else if (dataCatatan && typeof dataCatatan === 'object') notesArray = [dataCatatan];

            // --- ENGINE KONVERSI ---
            if (format === 'json') {
                stringData = JSON.stringify(notesArray, null, 2);
                mimeType = 'application/json';
            } 
            else if (format === 'txt') {
                stringData = this._convertToText(notesArray);
                mimeType = 'text/plain';
            } 
            else if (format === 'doc') {
                stringData = this._convertToHTML(notesArray);
                mimeType = 'application/msword';
            } 
            else if (format === 'zip') {
                // Generate ZIP biner asli
                const JSZip = await loadExternalLibrary('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', 'JSZip');
                const zip = new JSZip();
                
                notesArray.forEach((note, i) => {
                    const title = (note.title || `Catatan_${i+1}`).replace(/[^a-z0-9]/gi, '_');
                    zip.file(`${title}.txt`, `Judul: ${note.title}\nKategori: ${note.category}\nTanggal: ${note.date}\n\n${note.content}`);
                });
                
                stringData = await zip.generateAsync({ type: 'base64' });
                isBase64 = true;
                mimeType = 'application/zip';
            } 
            else if (format === 'pdf') {
                // Generate PDF biner asli
                const html2pdf = await loadExternalLibrary('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js', 'html2pdf');
                const htmlContent = this._convertToHTML(notesArray);
                
                // Buat elemen sementara
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = htmlContent;
                
                const pdfBase64 = await html2pdf().from(tempDiv).outputPdf('datauristring');
                stringData = pdfBase64.split(',')[1]; // Ambil data base64 murni tanpa prefix
                isBase64 = true;
                mimeType = 'application/pdf';
            }

            // --- EKSEKUSI PENYIMPANAN ---
            if (Capacitor.isNativePlatform()) {
                const result = await FileExport.exportFile({
                    fileName: fileName,
                    data: stringData,
                    mimeType: mimeType,
                    isBase64: isBase64 // Parameter baru untuk Java
                });
                if (!result.success) throw new Error('Plugin native gagal.');
                return { status: 'success', message: 'Ekspor berhasil.' };
            } else {
                // Logika Web
                const finalData = isBase64 ? this._base64ToBlob(stringData, mimeType) : new Blob([stringData], { type: mimeType });
                const url = URL.createObjectURL(finalData);
                const a = document.createElement("a");
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
                return { status: 'success', message: 'Ekspor berhasil.' };
            }

        } catch (error) {
            console.error("Proses ekspor gagal:", error);
            if (error.message === 'USER_CANCELLED') throw new Error('Ekspor dibatalkan.');
            throw new Error('Gagal mengekspor data: ' + error.message);
        }
    },

    _convertToText(notesArray) {
        let text = "=== ARSIP CATATAN PINTAR ===\n\n";
        notesArray.forEach((note, index) => {
            text += `Catatan #${index + 1}\nJudul    : ${note.title || 'Tanpa Judul'}\nKategori : ${note.category || '-'}\nTanggal  : ${note.date || '-'}\n--------------------------------------\n${note.content || '-'}\n======================================\n\n`;
        });
        return text;
    },

    _convertToHTML(notesArray) {
        let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Arsip Catatan Pintar</title><style>body { font-family: sans-serif; line-height: 1.6; padding: 20px; color: #333; } .note { border-bottom: 2px solid #ccc; margin-bottom: 20px; padding-bottom: 20px; } .title { color: #2e7d32; margin-bottom: 5px; } .meta { font-size: 0.9em; color: #666; margin-top: 0; margin-bottom: 15px; } .content { white-space: pre-wrap; }</style></head><body><h1 style="text-align: center;">Arsip Catatan Pintar</h1><hr><br>`;
        notesArray.forEach((note) => {
            html += `<div class="note"><h2 class="title">${note.title || 'Tanpa Judul'}</h2><p class="meta">Kategori: ${note.category || '-'} | Tanggal: ${note.date || '-'}</p><div class="content">${note.content || '-'}</div></div>`;
        });
        html += "</body></html>";
        return html;
    },

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
