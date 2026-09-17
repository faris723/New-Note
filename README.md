# Catatan Pintar — Offline

Aplikasi catatan pintar & manajemen keuangan lokal-pertama (offline-first) untuk Android (APK) dan Web (PWA).

## Cara build APK (tanpa command line)

1. Buka tab **Actions** di repo ini.
2. Pilih workflow **"Build Android APK"**.
3. Klik tombol **"Run workflow"**.
4. Untuk build biasa (hanya artifact, belum jadi Release resmi): biarkan kolom `release_tag` kosong.
5. **Untuk merilis versi resmi** yang bisa dideteksi fitur "Cek Update" di dalam aplikasi: isi `release_tag` dengan nomor versi diawali huruf `v`, misalnya `v1.0.5`. Workflow otomatis akan:
   - Build APK
   - Membuat tag Git `v1.0.5`
   - Membuat GitHub Release resmi + melampirkan file `.apk`

Cek tab **Releases** setelah workflow selesai (±2-3 menit) — APK akan muncul di sana.

## ⚠️ Setiap kali merilis versi baru, SAMAKAN 4 hal ini

| Lokasi | Contoh nilai untuk rilis v1.0.5 |
|---|---|
| `src/version.js` → `APP_VERSION` | `'1.0.5'` |
| `android/app/build.gradle` → `versionName` | `"1.0.5"` |
| `android/app/build.gradle` → `versionCode` | naikkan, untuk 1.0.5 menjadi `6` |
| `release_tag` saat menjalankan workflow | `v1.0.5` |

Kalau `versionCode` lupa dinaikkan, Android akan menolak pasang APK baru menimpa yang lama (`INSTALL_FAILED_VERSION_DOWNGRADE`).

## Kenapa update APK tidak perlu uninstall aplikasi lama
- `applicationId` selalu sama: `com.catatanpintar.app`
- Signing key debug selalu sama, dikunci ke `android/app/debug.keystore` yang di-commit di repo ini (lihat komentar di `android/app/build.gradle`)

Selama dua hal di atas tidak berubah dan `versionCode` selalu naik tiap rilis, APK baru akan menimpa (update) instalasi lama tanpa perlu uninstall.

## Deploy web preview
Workflow **"Deploy Web Preview to GitHub Pages"** berjalan otomatis tiap push ke `main`. Pastikan **Settings → Pages → Source** diset ke **GitHub Actions**.
