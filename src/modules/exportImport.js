import { Capacitor, registerPlugin } from '@capacitor/core';

// Mendaftarkan plugin Java Android kustom Anda
const FileExport = registerPlugin('FileExport');

export const ExportImportService = {
    
    // Fungsi ini dipanggil oleh antarmuka UI Anda saat tombol "Ekspor" ditekan
    async exportNotes(dataCatatan) {
        try {
            // Tampilkan log di konsol untuk proses debugging
            console.log("Memulai proses ekspor...");

            // Konversi objek catatan menjadi string JSON
            const stringData = JSON.stringify(dataCatatan, null, 2);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `Backup_Catatan_Pintar_${timestamp}.json`;

            // Deteksi Lingkungan: Jalankan metode yang sesuai
            if (Capacitor.isNativePlatform()) {
                console.log("Lingkungan Android terdeteksi. Menggunakan plugin native...");
                return await this._exportNative(stringData, fileName);
            } else {
                console.log("Lingkungan Web terdeteksi. Menggunakan unduhan browser...");
                return await this._exportWeb(stringData, fileName);
            }

        } catch (error) {
            console.error("Proses ekspor gagal:", error);
            // Kembalikan error agar bisa ditangkap oleh UI dan tidak membuat crash
            if (error.message === 'USER_CANCELLED') {
                throw new Error('Ekspor dibatalkan oleh pengguna.');
            }
            throw new Error('Gagal mengekspor data: ' + error.message);
        }
    },

    // -------------------------------------------------------------
    // LOGIKA KHUSUS WEB (Berfungsi normal di browser PWA/Website)
    // -------------------------------------------------------------
    async _exportWeb(stringData, fileName) {
        const blob = new Blob([stringData], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        
        // Pembersihan memori
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
        
        return { status: 'success', message: 'Ekspor berhasil disimpan ke perangkat.' };
    },

    // -------------------------------------------------------------
    // LOGIKA KHUSUS ANDROID (Menggunakan FileExportPlugin.java)
    // -------------------------------------------------------------
    async _exportNative(stringData, fileName) {
        const result = await FileExport.exportFile({
            fileName: fileName,
            data: stringData
        });

        if (result.success) {
            console.log("File berhasil disimpan di URI:", result.uri);
            return { status: 'success', message: 'Ekspor berhasil disimpan.' };
        } else {
            throw new Error('Plugin native gagal merespons dengan benar.');
        }
    },

    // -------------------------------------------------------------
    // FUNGSI IMPOR (Disiapkan agar tidak memicu error saat ditekan)
    // -------------------------------------------------------------
    async importNotes() {
        try {
            console.log("Fungsi impor dipanggil.");
            // Tempatkan logika plugin pembaca file Anda di sini di masa mendatang
            return { status: 'success', data: null };
        } catch (error) {
            console.error("Gagal mengimpor:", error);
            throw new Error("Terjadi kesalahan sistem saat mencoba mengimpor data.");
        }
    }
};
