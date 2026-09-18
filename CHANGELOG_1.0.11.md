# Catatan Pintar 1.0.11

- Memperbaiki layout modal Impor/Ekspor di layar kecil agar tombol tidak tertutup area navigasi/safe-area.
- Menambahkan progress yang terlihat saat validasi dan penyimpanan impor; proses tidak lagi langsung menutup modal.
- Mode "Ganti Semua" sekarang benar-benar menghapus catatan lama sebelum menyimpan cadangan.
- Ekspor JSON/ZIP tidak lagi bergantung pada JSZip untuk membuat arsip baru.
- Ekspor PDF menghasilkan berkas PDF nyata, bukan hanya memanggil dialog print.
- Ekspor Word menghasilkan DOCX dasar yang valid.
- Ekspor pada Android menggunakan folder Download/Catatan Pintar melalui plugin native.
- Preview PDF Android memakai proxy Capacitor native yang eksplisit sehingga plugin lebih konsisten terdeteksi.
- Pada APK native, tombol "Pasang Aplikasi" diganti menjadi "Periksa Pembaruan" dan memeriksa GitHub Releases.
- Menambahkan validasi CI untuk plugin native PDF dan ekspor.
