import { registerPlugin } from '@capacitor/core';
const FileExport = registerPlugin('FileExport');

export async function eksporCatatanKeSistem(dataCatatan) {
    try {
        // Tampilkan indikator "Menyiapkan berkas ekspor..." di UI Anda di sini
        
        const stringData = JSON.stringify(dataCatatan);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        const result = await FileExport.exportFile({
            fileName: `Backup_Catatan_Pintar_${timestamp}.json`,
            data: stringData
        });

        if (result.success) {
            // Eksekusi jika berhasil
            console.log("File berhasil disimpan di:", result.uri);
            return { status: 'success', message: 'Ekspor berhasil disimpan.' };
        }
    } catch (error) {
        // Tangkap penolakan (reject) dari Java
        console.error("Proses ekspor terhenti:", error);
        
        if (error.message === 'USER_CANCELLED') {
            return { status: 'cancelled', message: 'Ekspor dibatalkan.' };
        } else {
            return { status: 'error', message: 'Terjadi kesalahan sistem saat mengekspor.' };
        }
    }
}
