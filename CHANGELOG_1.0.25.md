# 1.0.25

## Perbaikan besar: Ekspor PDF, ZIP, dan Keuangan

### 1. Ekspor PDF kini benar-benar menghasilkan berkas `.pdf`
**Sebelumnya**: fitur ini sengaja ditulis sebagai HTML yang diganti ekstensi jadi `.html` (ada komentar eksplisit di kode: "tanpa library eksternal, kita HARUS menyimpannya sebagai file .html"). Padahal library `jsPDF` **sudah termuat** di `index.html` lewat CDN, hanya belum dipakai.
**Sekarang**: memakai jsPDF sungguhan untuk menghasilkan berkas PDF biner asli, tersusun rapi per catatan (judul, kategori, tanggal, isi), dengan pemisah antar-catatan dan pemisahan halaman otomatis.

### 2. Ekspor ZIP kini benar-benar menghasilkan arsip `.zip`
**Sebelumnya**: hasilnya selalu `.json` walau diberi nama `.zip` (ada komentar: "mode zip untuk saat ini masih menghasilkan cadangan JSON penuh").
**Sekarang**: memakai `JSZip` (juga sudah termuat via CDN, belum dipakai) untuk membungkus backup JSON lengkap + ringkasan TXT yang mudah dibaca ke dalam satu arsip `.zip` sungguhan.

### 3. Ekspor Laporan Keuangan (PDF) yang sebelumnya gagal total — diperbaiki
**Akar masalah**: `src/modules/attachment.js` memanggil method native `startExport` / `appendExportChunk` / `finishExport` untuk menulis berkas biner besar secara bertahap — tapi method-method ini **tidak pernah diimplementasikan** di `FileExportPlugin.java`. Setiap percobaan ekspor Keuangan gagal diam-diam di sisi native.
**Perbaikan**: menambahkan implementasi lengkap ke-4 method tersebut (`startExport`, `appendExportChunk`, `finishExport`, `cancelExport`) di `FileExportPlugin.java`, memakai `OutputStream` + `Base64.decode` agar data biner ditulis dengan benar (bukan ditulis sebagai teks UTF-8 mentah seperti jalur lama).

**Efek samping positif**: perbaikan native plugin ini otomatis turut memperbaiki jalur ekspor biner lain yang memakai `AttachmentService.saveOrDownloadBlob` (dipakai juga oleh beberapa fitur simpan lampiran/gambar), yang sebelumnya kemungkinan juga gagal diam-diam di Android untuk alasan yang sama.

**File yang berubah**:
- `src/modules/exportImport.js` (PDF & ZIP sungguhan)
- `android/app/src/main/java/com/catatanpintar/app/FileExportPlugin.java` (method native baru)

**File yang TIDAK berubah**: `MainActivity.java` (plugin sudah terdaftar, tidak perlu didaftarkan ulang), `debug.keystore`, `.github/workflows/*`
