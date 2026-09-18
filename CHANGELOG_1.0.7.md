# Catatan Pintar 1.0.7

- Memperbaiki validasi nominal bayar/cicil: nominal tidak lagi dibatasi kelipatan Rp1.000; nominal apa pun dalam batas saldo/sisa dapat dimasukkan.
- Memperbaiki pemilihan sumber dana saat mengedit pengeluaran agar saldo yang sebelumnya dipakai dapat dipakai kembali sebagai kapasitas edit.
- Saldo Dana Bersih kini memperhitungkan cicilan hutang dan pembayaran dana wajib, termasuk pembayaran bertahap.
- Pembayaran hutang dan dana wajib dibuat lebih aman dengan rollback saldo sumber dana jika penyimpanan gagal.
- Progres, sisa, sumber dana, dan riwayat pembayaran tetap dipertahankan.
- Pemeriksaan update diperkuat dengan endpoint release terbaru, fallback daftar release, cache-buster, dan pemeriksaan foreground.
- Metadata build APK dan ekspor data disinkronkan ke versi aplikasi.
