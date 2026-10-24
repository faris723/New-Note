import { registerPlugin } from '@capacitor/core';
const FileExport = registerPlugin('FileExport');

export const ExportImportService = {
    
    async eksporCatatanKeSistem(dataCatatan) {
        try {
            const stringData = JSON.stringify(dataCatatan);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            
            const result = await FileExport.exportFile({
                fileName: `Backup_Catatan_Pintar_${timestamp}.json`,
                data: stringData
            });

            if (result.success) {
                console.log("File berhasil disimpan di:", result.uri);
                return { status: 'success', message: 'Ekspor berhasil disimpan.' };
            }
        } catch (error) {
            console.error("Proses ekspor terhenti:", error);
            
            if (error.message === 'USER_CANCELLED') {
                return { status: 'cancelled', message: 'Ekspor dibatalkan.' };
            } else {
                return { status: 'error', message: `Gagal mengekspor: ${error.message || 'Kesalahan sistem'}` };
            }
        }
    },

    async imporCatatanDariSistem() {
        // Kerangka fungsi impor untuk mencegah error jika featurePack.js memanggilnya
        try {
            console.log("Fungsi impor dipanggil");
            // Logika plugin pembaca file (FilePicker/FileOpen) diletakkan di sini nantinya
            return { status: 'success', data: null };
        } catch (error) {
            console.error("Gagal mengimpor:", error);
            return { status: 'error', message: 'Terjadi kesalahan saat mengimpor.' };
        }
    }
    
};
