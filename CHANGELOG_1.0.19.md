# Catatan Pintar 1.0.19

## Perbaikan utama
- Memperbaiki ekspor laporan keuangan: scope laporan, tanggal lokal, status pembayaran hutang, saldo arus kas, dan penyimpanan native Android.
- Memperbaiki ekspor catatan terpilih agar memakai penyimpanan ekspor yang sama dengan ekspor utama.
- Memisahkan penyimpanan data keuangan antara Mode Aplikasi dan Mode Browser.
- Menambahkan rollback impor dan menghilangkan penghapusan catatan lama sebelum snapshot baru berhasil tersimpan.
- Memperbaiki penyimpanan lampiran IndexedDB agar menunggu transaksi selesai dan membersihkan record lampiran yang sudah dihapus.
- Memperbaiki pembukaan .cnote dari URI `content://` Android.
- Menghapus referensi type Vite PWA yang sudah tidak digunakan.
- Menambahkan type-check ke workflow CI.
