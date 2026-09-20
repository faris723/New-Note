# Catatan Pintar 1.0.22

## Perbaikan ekspor
- Ekspor Android sekarang dikirim ke plugin native secara bertahap per chunk, bukan seluruh file Base64 sekaligus. Ini mengurangi penggunaan RAM untuk PDF/ZIP besar.
- Android 9 dan sebelumnya meminta izin penyimpanan dan memiliki permission manifest yang sesuai.
- MediaStore menghapus entry jika penulisan gagal; file lama tidak ditimpa pada Android lama.
- Hasil ekspor diverifikasi ukurannya sebelum dianggap berhasil.
- Ekspor catatan terpilih sekarang menggunakan engine backup yang sama dengan ekspor utama, termasuk lampiran dan struktur portable-v2.
- Backup JSON/ZIP dibatalkan jika ada lampiran yang tidak dapat dibaca, agar pengguna tidak menerima backup parsial dengan pesan sukses.
