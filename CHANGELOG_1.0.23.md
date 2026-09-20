# Catatan Pintar 1.0.23

## Perbaikan ekspor Android
- Ekspor APK sekarang membuka Android System Save Picker (ACTION_CREATE_DOCUMENT), sehingga pengguna dapat memilih folder/nama file seperti pada website.
- File tidak lagi dianggap berhasil sebelum pengguna memilih lokasi dan file selesai ditulis.
- Ekspor dikirim bertahap ke file sementara agar PDF/ZIP besar tidak membutuhkan Base64 penuh di RAM.
- Pembatalan pemilihan folder/file ditangani sebagai pembatalan, bukan sukses palsu.
- File sementara dibersihkan jika proses gagal atau dibatalkan.
