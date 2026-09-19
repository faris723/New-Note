# 1.0.16

## Perbaikan: fitur "Cek Update" gagal mendeteksi rilis terbaru

**Gejala**: Sudah publish rilis baru (misal v1.0.15) di GitHub, tapi aplikasi tetap bilang sudah pakai versi terbaru / tidak menampilkan notifikasi update.

**Penyebab**: `src/modules/update.js` sebelumnya percaya begitu saja pada endpoint `/releases/latest` milik GitHub. Endpoint ini menentukan rilis "latest" berdasarkan **tanggal terbit**, bukan nomor versi tertinggi. Riwayat rilis repo ini membuktikan hal ini pernah benar-benar terjadi: rilis `v1.0.2` diterbitkan ulang **setelah** `v1.0.3` sudah ada, sehingga `/releases/latest` bisa saja menunjuk ke rilis lama walau rilis lebih baru sudah dipublikasikan.

**Perbaikan**: Urutan pengecekan dibalik — aplikasi sekarang **selalu mengambil seluruh daftar rilis lebih dulu dan memilih nomor versi tertinggi secara manual** (bukan mengandalkan status "latest" bawaan GitHub). Endpoint `/releases/latest` sekarang hanya dipakai sebagai cadangan jika pengambilan daftar rilis gagal.

**File yang berubah**: `src/modules/update.js`
**File Android/workflow**: tidak ada perubahan
