# Catatan Pintar 1.0.20

## Perbaikan
- Kategori **Acara** tidak lagi tampil di daftar Catatan, chip kategori, pencarian/filter, atau daftar catatan utama. Data acara tetap tersimpan dan hanya dikelola melalui **Jadwal**.
- Kategori **Keuangan** tetap hanya dikelola melalui **Keuangan**.
- Menghapus duplikasi fungsi `renderCalendar()` yang sebelumnya membuat renderer kalender lama menimpa renderer baru.
- Tampilan daftar acara di Jadwal menggunakan kartu acara yang rapi: tipe acara, waktu, lokasi, pengingat, deskripsi, tombol edit, dan hapus.
- Cache versi PWA/native dinaikkan ke 1.0.20 agar perubahan UI tidak tertahan cache lama.
