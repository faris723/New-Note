CATATAN PINTAR 1.0.14 - GITHUB MOBILE KIT

Upload each file to the SAME path shown below. Do not upload this ZIP itself to the repository.

.github/workflows/build-apk.yml
CHANGELOG_1.0.14.md
android/app/build.gradle
package.json
package-lock.json
src/app.js
src/version.js
src/modules/featurePack.js
src/modules/exportImport.js
src/modules/update.js

After all files are uploaded, run GitHub Actions -> Build APK Android.
Do NOT manually replace android/app/src/main/assets/public/assets/index-*.js.
The workflow rebuilds the web bundle and runs npx cap sync android.
