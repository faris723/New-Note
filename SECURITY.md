# Security Notes

## Temporary signing compatibility bridge

Release `1.0.4` is intentionally signed with the same legacy `android/app/debug.keystore` used by the existing `1.0.1` / `1.0.2` APK. This preserves Android update compatibility, so users can install the bridge release without uninstalling the existing app.

This is a **temporary migration measure**, not the desired long-term production signing setup. The legacy key is present in the repository and therefore must be treated as compromised/non-secret.

### Migration plan

1. Publish the compatibility bridge (`1.0.4`) with the legacy key.
2. Keep all subsequent bridge updates on the same key until users have migrated.
3. Create a new protected production keystore and store it only in GitHub Actions secrets (for example `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD`).
4. Once the legacy installation population has been retired, switch releases to the protected production key.
5. A signing-key change cannot be installed as an in-place Android update; it requires uninstalling the old signing identity first. Therefore the key change should be treated as a deliberate one-time migration.

Never expose a production private signing key in source control.
