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

    // ==========================================
    // 1. EKSPOR CATATAN UTAMA (JSON, TXT, DOC, ZIP, PDF)
    // ==========================================
    async exportNotes(dataCatatan, formatParam = 'json') {
        try {
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

            if (!['json', 'txt', 'doc', 'pdf', 'zip'].includes(format)) {
                format = 'json';
            }

            console.log(`Mengekspor catatan format: ${format}`);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

            let fileName = `Catatan_Pintar_${timestamp}.${format}`;
            let stringData = '';
            let isBase64 = false;
            let mimeType = 'text/plain';

            let catatanArray = Array.isArray(dataCatatan) ? dataCatatan : (dataCatatan.notes || [dataCatatan]);

            if (format === 'json') {
                stringData = JSON.stringify(dataCatatan, null, 2);
                mimeType = 'application/json';
            } 
            else if (format === 'txt') {
                stringData = this._convertToText(catatanArray);
                mimeType = 'text/plain';
            } 
            else if (format === 'doc') {
                stringData = this._convertToHTML(catatanArray);
                mimeType = 'application/msword';
            } 
            else if (format === 'zip') {
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
                const html2pdf = await loadExternalLibrary('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js', 'html2pdf');
                const htmlContent = this._convertToHTML(catatanArray);

                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = htmlContent;

                const opt = {
                    margin: 10,
                    filename: fileName,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2 },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                };

                const pdfBase64 = await html2pdf().set(opt).from(tempDiv).outputPdf('datauristring');
                stringData = pdfBase64.split(',')[1];
                isBase64 = true;
                mimeType = 'application/pdf';
            }

            return await this._saveFile(fileName, stringData, mimeType, isBase64);

        } catch (error) {
            console.error("Proses ekspor catatan gagal:", error);
            if (error.message === 'USER_CANCELLED') throw new Error('Ekspor dibatalkan.');
            throw new Error('Gagal mengekspor data catatan: ' + error.message);
        }
    },

    // ==========================================
    // 2. EKSPOR KEUANGAN (JSON, TXT, DOC, PDF)
    // ==========================================
    async exportFinance(dataKeuangan, formatParam = 'json') {
        try {
            let format = 'json';

            if (typeof formatParam === 'string') {
                format = formatParam.toLowerCase();
            } else if (formatParam && typeof formatParam === 'object') {
                const target = formatParam.target || formatParam.currentTarget;
                if (target) {
                    const val = (target.dataset && target.dataset.format) || target.value || target.innerText || target.textContent || '';
                    const text = val.toLowerCase();
                    if (text.includes('pdf')) format = 'pdf';
                    else if (text.includes('doc') || text.includes('word')) format = 'doc';
                    else if (text.includes('txt')) format = 'txt';
                } else if (formatParam.format) {
                    format = formatParam.format.toLowerCase();
                }
            }

            if (!['json', 'txt', 'doc', 'pdf'].includes(format)) {
                format = 'json';
            }

            console.log(`Mengekspor keuangan format: ${format}`);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

            let fileName = `Laporan_Keuangan_${timestamp}.${format}`;
            let stringData = '';
            let isBase64 = false;
            let mimeType = 'text/plain';

            let trxArray = Array.isArray(dataKeuangan) ? dataKeuangan : (dataKeuangan.transactions || dataKeuangan.transaksi || [dataKeuangan]);

            if (format === 'json') {
                stringData = JSON.stringify(dataKeuangan, null, 2);
                mimeType = 'application/json';
            } 
            else if (format === 'txt') {
                stringData = this._convertToTextFinance(trxArray);
                mimeType = 'text/plain';
            } 
            else if (format === 'doc') {
                stringData = this._convertToHTMLFinance(trxArray);
                mimeType = 'application/msword';
            } 
            else if (format === 'pdf') {
                const html2pdf = await loadExternalLibrary('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js', 'html2pdf');
                const htmlContent = this._convertToHTMLFinance(trxArray);

                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = htmlContent;

                const opt = {
                    margin: 10,
                    filename: fileName,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2 },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                };

                const pdfBase64 = await html2pdf().set(opt).from(tempDiv).outputPdf('datauristring');
                stringData = pdfBase64.split(',')[1];
                isBase64 = true;
                mimeType = 'application/pdf';
            }

            return await this._saveFile(fileName, stringData, mimeType, isBase64);

        } catch (error) {
            console.error("Proses ekspor keuangan gagal:", error);
            if (error.message === 'USER_CANCELLED') throw new Error('Ekspor dibatalkan.');
            throw new Error('Gagal mengekspor data keuangan: ' + error.message);
        }
    },

    // ==========================================
    // 3. FITUR IMPOR DATA (JSON)
    // ==========================================
    async importNotes() {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'application/json';

            input.onchange = (event) => {
                const file = event.target.files[0];
                if (!file) {
                    reject(new Error('Tidak ada file yang dipilih.'));
                    return;
                }

                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const parsedData = JSON.parse(e.target.result);
                        resolve({ status: 'success', data: parsedData });
                    } catch (err) {
                        reject(new Error('Format file JSON tidak valid.'));
                    }
                };
                reader.onerror = () => reject(new Error('Gagal membaca file.'));
                reader.readAsText(file);
            };

            input.click();
        });
    },

    // ==========================================
    // 4. HELPER EKSEKUSI PENYIMPANAN FILE
    // ==========================================
    async _saveFile(fileName, stringData, mimeType, isBase64) {
        if (Capacitor.isNativePlatform()) {
            const result = await FileExport.exportFile({
                fileName: fileName,
                data: stringData,
                mimeType: mimeType,
                isBase64: isBase64
            });
            if (!result.success) throw new Error('Plugin native gagal merespons.');
            return { status: 'success', message: 'Ekspor berhasil disimpan.' };
        } else {
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
    },

    // ==========================================
    // 5. HELPER KONVERSI (CATATAN)
    // ==========================================
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

    // ==========================================
    // 6. HELPER KONVERSI (KEUANGAN)
    // ==========================================
    _convertToTextFinance(financeArray) {
        let text = "=== LAPORAN KEUANGAN ===\n\n";
        let totalPemasukan = 0;
        let totalPengeluaran = 0;

        financeArray.forEach((trx, index) => {
            const tipe = trx.type || trx.tipe || '-';
            const nominal = Number(trx.amount || trx.nominal || 0);
            const tanggal = trx.date || trx.tanggal || '-';
            const deskripsi = trx.description || trx.deskripsi || '-';

            if (tipe.toLowerCase() === 'pemasukan') totalPemasukan += nominal;
            if (tipe.toLowerCase() === 'pengeluaran') totalPengeluaran += nominal;

            text += `Transaksi #${index + 1}\nTipe      : ${tipe.toUpperCase()}\nNominal   : Rp ${nominal.toLocaleString('id-ID')}\nTanggal   : ${tanggal}\nKeterangan: ${deskripsi}\n--------------------------------------\n`;
        });

        text += `\nRINGKASAN\nTotal Pemasukan  : Rp ${totalPemasukan.toLocaleString('id-ID')}\nTotal Pengeluaran: Rp ${totalPengeluaran.toLocaleString('id-ID')}\nSALDO AKHIR       : Rp ${(totalPemasukan - totalPengeluaran).toLocaleString('id-ID')}\n======================================\n`;
        return text;
    },

    _convertToHTMLFinance(financeArray) {
        let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Laporan Keuangan</title><style>body{font-family:Arial,sans-serif;padding:20px;color:#333} table{width:100%;border-collapse:collapse;margin-top:20px;} th,td{border:1px solid #ccc;padding:10px;text-align:left;} th{background-color:#f4f4f4;} .in{color:green;font-weight:bold;} .out{color:red;font-weight:bold;} .summary{margin-top:30px;padding:15px;background:#f9f9f9;border-radius:8px;font-size:1.1em;}</style></head><body><h1 style="text-align:center;">Laporan Transaksi Keuangan</h1><table><thead><tr><th>No</th><th>Tanggal</th><th>Tipe</th><th>Keterangan</th><th>Nominal</th></tr></thead><tbody>`;

        let totalPemasukan = 0;
        let totalPengeluaran = 0;

        financeArray.forEach((trx, index) => {
            const tipe = trx.type || trx.tipe || '-';
            const nominal = Number(trx.amount || trx.nominal || 0);
            const isPemasukan = tipe.toLowerCase() === 'pemasukan';
            const style = isPemasukan ? 'in' : 'out';

            if (isPemasukan) totalPemasukan += nominal;
            else if (tipe.toLowerCase() === 'pengeluaran') totalPengeluaran += nominal;

            html += `<tr><td>${index + 1}</td><td>${trx.date || trx.tanggal || '-'}</td><td class="${style}">${tipe.toUpperCase()}</td><td>${trx.description || trx.deskripsi || '-'}</td><td class="${style}">Rp ${nominal.toLocaleString('id-ID')}</td></tr>`;
        });

        html += `</tbody></table><div class="summary"><p class="in">Total Pemasukan: Rp ${totalPemasukan.toLocaleString('id-ID')}</p><p class="out">Total Pengeluaran: Rp ${totalPengeluaran.toLocaleString('id-ID')}</p><hr><p><strong>SALDO AKHIR: Rp ${(totalPemasukan - totalPengeluaran).toLocaleString('id-ID')}</strong></p></div></body></html>`;
        return html;
    },

    // Helper Web untuk konversi base64 ke Blob
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
    }
};
