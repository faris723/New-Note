# Catatan Pintar 1.0.3

## Fitur baru

- Navigasi bawah: **Catatan / Keuangan / Jadwal**.
- Dashboard keuangan dengan ringkasan pemasukan, pengeluaran, saldo bersih, hutang aktif, kewajiban, dan tabungan.
- Input transaksi cepat untuk pemasukan, pengeluaran, dan hutang.
- Informasi tambahan transaksi: sumber pemasukan dan tujuan pengeluaran.
- **Dana Pengeluaran Wajib** dengan nominal, jatuh tempo, status lunas, dan hapus.
- **Pos Tabungan** dengan target, saldo, sumber dana, setor dan tarik.
- Ekspor ringkasan keuangan dalam JSON.
- Kalender **Acara/Jadwal** bulanan dan daftar acara berdasarkan tanggal.
- Lokasi acara dan tanggal acara disimpan bersama catatan.
- Operasi batch pada mode pilih: hapus, pindah kategori, dan ekspor.
- Tambah kategori langsung dari editor catatan.
- Editor anotasi gambar: pena, garis, kotak, elips, panah, penghapus, teks, undo/redo.
- Mekanisme updater diperbaiki agar memilih `app-release.apk` dari GitHub Release yang benar, bukan asset APK lama/ambigu.

## Kompatibilitas update

- `applicationId` tetap `com.catatanpintar.app`.
- `versionCode` naik dari 3 ke 4.
- `versionName` menjadi `1.0.3`.
- Signing compatibility key tetap `android/app/debug.keystore`, sehingga 1.0.3 dapat dipasang di atas 1.0.1/1.0.2 tanpa menghapus data.

## Catatan implementasi

ZIP referensi `catatan-pintar-app (1).zip` digunakan sebagai **spesifikasi fitur/perilaku**, bukan sebagai basis repository baru. Implementasi 1.0.3 ditempatkan sebagai feature pack terpisah di repository aktif agar storage lama dan mekanisme keamanan tidak diganti secara destruktif.
