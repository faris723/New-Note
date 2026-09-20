# Catatan Pintar 1.0.21

## Perbaikan
- **Fitur Ekspor (Catatan & PDF Keuangan)**: memperbaiki lokasi penyimpanan berkas hasil ekspor pada perangkat Android versi lama (di bawah Android 10) — sebelumnya tersimpan ke folder privat aplikasi yang tidak terlihat di file manager, sekarang tersimpan ke folder `Download/Catatan Pintar/` yang sesungguhnya.
- Menambahkan izin `WRITE_EXTERNAL_STORAGE` (dibatasi hanya untuk Android 9 ke bawah) yang dibutuhkan agar penulisan ke folder Download publik berhasil di perangkat lama.
- Pesan notifikasi (toast) setelah ekspor sekarang jujur menyesuaikan metode penyimpanan yang benar-benar terjadi, alih-alih selalu mengklaim "berhasil" walau sebenarnya jatuh ke metode cadangan yang tidak reliabel.
- Memicu media scanner setelah menulis berkas di perangkat Android lama, supaya berkas langsung terlihat di aplikasi file manager tanpa perlu restart HP.

## Perubahan Tampilan
- Indikator **"Penyimpanan"** di halaman Catatan diubah menjadi **"Penyimpanan digunakan"** — hanya menampilkan total ukuran data yang benar-benar tersimpan, tanpa batas/kuota buatan (sebelumnya menampilkan kuota browser seperti "100 MB" yang tidak relevan, karena aplikasi ini menyimpan data sebagai berkas fisik nyata di perangkat, bukan dibatasi kuota browser).
- Menghapus bilah progres kapasitas dan banner peringatan "penyimpanan hampir penuh" yang sebelumnya dihitung dari kuota buatan tersebut.

## Lainnya
- Cache versi PWA/native dinaikkan ke 1.0.21 agar perubahan tidak tertahan cache lama.
