/**
 * Versi aplikasi saat ini (dipakai oleh UpdateService untuk membandingkan
 * dengan rilis terbaru di GitHub).
 *
 * PENTING — setiap kali membuat rilis versi baru, SAMAKAN 3 hal berikut:
 *   1. Nilai APP_VERSION di file ini, misal '1.0.1'
 *   2. `versionName` di android/app/build.gradle, misal "1.0.1"
 *      (dan naikkan `versionCode` juga, misal dari 1 -> 2)
 *   3. Tag Git yang di-push, HARUS diawali huruf v, misal: v1.0.1
 *      (tag inilah yang memicu GitHub Actions membuat Release baru)
 */
export const APP_VERSION = '1.0.0';
