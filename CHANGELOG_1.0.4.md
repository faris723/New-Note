# Catatan Pintar 1.0.4

## Perbaikan utama

- Memperbaiki pemeriksaan pembaruan GitHub agar mencari release publik yang benar-benar memiliki aset APK, bukan hanya mengandalkan satu endpoint/asset name.
- Menambahkan tombol **Periksa Versi Terbaru** untuk pengecekan manual.
- Menaikkan Android `versionCode` menjadi 5 dan `versionName` menjadi `1.0.4`.
- Tetap mempertahankan `applicationId com.catatanpintar.app` dan kunci kompatibilitas lama agar jalur update in-place tetap memungkinkan.

## Keuangan

- Tombol Pemasukan, Pengeluaran, dan Hutang sekarang membuka form transaksi khusus, bukan bergantung pada prompt atau state editor catatan.
- Transaksi memiliki tanggal, nominal, sumber/tujuan, detail hutang, status lunas, dan catatan tambahan.
- Transaksi baru langsung disimpan melalui `StorageService`, sehingga muncul di dashboard dan tetap tersimpan setelah restart/update.
- Hutang dapat ditandai lunas dari dashboard.
- Kewajiban dan pos tabungan memakai form yang lebih stabil.
- Filter tanggal menggunakan tanggal transaksi, bukan hanya waktu perubahan catatan.

## Jadwal & Acara

- Tombol **+ Acara** membuka form acara lengkap: nama, tanggal, jam, lokasi, deskripsi, dan pengingat.
- Acara langsung disimpan sebagai catatan kategori `Acara`.
- Kalender dan daftar acara diperbarui otomatis setelah penyimpanan.
- Acara dapat dibuka dan dihapus dari daftar tanggal terpilih.

## Lampiran & batch

- Anotasi gambar kini membuat catatan baru dengan lampiran hasil anotasi sehingga hasil tidak hilang ketika editor sebelumnya belum terbuka.
- Batch delete/move/export tetap memakai penyimpanan utama aplikasi.

## Catatan pengujian

Pemeriksaan statis JavaScript dilakukan dengan `node --check`. Build Android final tetap harus dijalankan oleh GitHub Actions pada repository karena lingkungan kerja lokal tidak berhasil menyelesaikan `npm install` dalam batas waktu.
