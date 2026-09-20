# Catatan Pintar 1.0.24

## Perbaikan GitHub Actions / TypeScript

- Memperbaiki `tsconfig.json` yang masih meminta tipe `vite-plugin-pwa/client`, padahal project saat ini tidak memasang atau menggunakan `vite-plugin-pwa`.
- TypeScript sekarang hanya memuat tipe `vite/client` yang memang tersedia sebagai dependency.
- Menyamakan versi aplikasi menjadi 1.0.24 di package, source version, Android versionCode/versionName, dan cache query.
- Tidak mengubah mekanisme PWA manual yang menggunakan `public/manifest.json` dan `public/sw.js`.
