# Catatan Pintar 1.0.5

## Keuangan — sumber dana

- Saldo Bersih sekarang menghitung pengeluaran berdasarkan sumber dana internal: pengeluaran dari Dana Bersih mengurangi saldo bersih; pengeluaran dari tabungan mengurangi tabungan terkait; sumber manual tidak mengurangi saldo internal.
- Form **Pengeluaran** menyediakan sumber dana dengan default **Dana Bersih**.
- Pengguna dapat memilih satu atau beberapa sumber sekaligus dan membagi nominal sampai tepat sama dengan total pengeluaran.
- Tersedia pencarian sumber dana.
- Pilihan **Lainnya / sumber manual** dapat diisi sendiri dan tidak mengubah saldo internal.
- **Dana Pengeluaran Wajib** dibayar melalui form sumber dana yang sama; pembayaran dapat menggunakan Dana Bersih, satu/lebih pos tabungan, atau sumber manual.
- Ketika pembayaran dana wajib menggunakan tabungan, saldo setiap tabungan yang dipilih otomatis berkurang sesuai alokasi.
- Pembatalan pembayaran dana wajib mengembalikan saldo tabungan yang sebelumnya dipakai.

## Riwayat

- Setiap transaksi keuangan memiliki riwayat sumber dana, waktu, nominal, dan keterangan.
- Setiap pos tabungan memiliki riwayat setor/tarik dan perubahan yang berasal dari pembayaran/pengeluaran.
- Setiap dana pengeluaran wajib memiliki riwayat pembayaran dan pembatalan.
- Tersedia tampilan **Riwayat Semua Dana & Transaksi**.
- Penghapusan pengeluaran mengembalikan saldo tabungan yang pernah digunakan oleh transaksi tersebut.

## Kompatibilitas update

- `applicationId` tetap `com.catatanpintar.app`.
- `versionCode` menjadi 6 dan `versionName` menjadi 1.0.5.
- Kunci kompatibilitas lama tetap digunakan agar update in-place tetap memungkinkan.
