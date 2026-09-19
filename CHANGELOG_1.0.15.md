# 1.0.15

## Tampilan Keuangan dibuat lebih ringkas & interaktif

- 6 kartu ringkasan (Saldo Bersih, Pemasukan, Pengeluaran, Hutang, Tabungan, Pengeluaran Wajib) dirombak dari kartu tinggi bertumpuk satu kolom (dengan tombol "Lihat Riwayat" terpisah) menjadi kartu ikon kompak 2 kolom.
- Seluruh badan kartu kini bisa ditap langsung untuk membuka riwayat (tidak perlu lagi menekan tombol terpisah di bawahnya).
- Tiap kategori punya ikon & warna aksen sendiri (Pemasukan hijau, Pengeluaran merah, Hutang ungu, Tabungan biru, Pengeluaran Wajib kuning) untuk mempercepat pemindaian visual.
- Ditambahkan efek tekan (scale-down saat ditap) dan dukungan keyboard (Enter/Spasi) untuk aksesibilitas.
- Tinggi total bagian ringkasan berkurang signifikan (dari 6 baris penuh menjadi 3 baris x 2 kolom), sehingga konten di bawahnya (grafik arus kas, daftar transaksi) lebih cepat terlihat tanpa scroll panjang.

**File yang berubah**: `src/modules/featurePack.js` (markup & style kartu ringkasan Keuangan)
**File Android/workflow**: tidak ada perubahan
