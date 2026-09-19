# 1.0.17

## Tampilan Jadwal & Acara dibuat lebih interaktif & jelas

- **Hari ini** dan **tanggal terpilih** sekarang punya penanda visual berbeda (sebelumnya keduanya terlihat sama jika kebetulan bertepatan) — ditambah legenda kecil di atas kalender agar artinya jelas.
- Kotak kosong di awal grid (sebelum tanggal 1) sekarang benar-benar disembunyikan, bukan kotak pudar yang mengganggu.
- Label acara di dalam sel kalender diganti dari teks penuh (yang gampang menumpuk/terpotong saat acara banyak dalam sehari) menjadi titik indikator kompak — maksimal 4 titik, sisanya ditampilkan sebagai "+N". Judul lengkap tetap muncul lewat tooltip dan di daftar "Acara pada tanggal terpilih" di bawah kalender.
- Ditambahkan efek tekan (scale-down saat ditap) pada tiap sel tanggal untuk umpan balik sentuhan yang lebih hidup.
- Header hari Minggu & Sabtu diberi warna aksen berbeda untuk mempercepat orientasi visual.

**File yang berubah**: `src/modules/featurePack.js` (markup, style, dan logika render kalender Jadwal & Acara)
**File Android/workflow**: tidak ada perubahan
