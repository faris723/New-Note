# Catatan Pintar 1.0.9

## Perbaikan lampiran, anotasi, viewer, dan editor

- Penyisipan lampiran ke posisi kursor memakai DOM insertion marker yang tetap bertahan saat file picker Android membuka dan menutup.
- Pembatalan pemilih berkas membersihkan marker tanpa mengubah isi catatan.
- Alur Anotasi Gambar tidak lagi membuka catatan baru atau mengganti objek catatan lama; hanya menambah/memperbarui attachment pada catatan yang sedang diedit.
- Mengedit/anotasi gambar yang sudah ada mempertahankan ID attachment sehingga chip file di dalam teks tetap terhubung.
- Tambah/edit attachment divalidasi agar tidak menghapus attachment lain.
- Viewer PDF Android menggunakan plugin PdfRenderer native; browser tetap memakai fallback PDF viewer.
- Preview DOCX internal mempertahankan heading, bold, italic, underline, coretan, alignment, paragraf, dan tabel dasar.
- Ditambahkan editor TXT/CSV/JSON/MD, editor DOCX berbasis HTML yang diekspor kembali ke DOCX, serta editor tabel XLSX/XLS yang diekspor ke XLSX.
- Editor file menyimpan perubahan ke attachment yang sama dan baru dipersistenkan ketika catatan disimpan.
- Ditambahkan tombol Edit pada viewer dan daftar lampiran.
- Workflow Android memverifikasi bundle web hasil build agar APK tidak memakai bundle Android lama.
- versionName 1.0.9 / versionCode 10.
