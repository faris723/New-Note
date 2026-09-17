# Fix updater 1.0.2

- Update checker now selects `app-release.apk` from the exact GitHub Release returned by `/releases/latest`.
- `app-debug.apk` is only a fallback for older releases.
- The download URL comes from that release asset (`browser_download_url`), never from `/releases/latest/download/...`.
- GitHub API cache is bypassed with `cache: no-store` and a timestamp query.
- Changelog compare URL is generated as `currentTag...remoteTag`, e.g. `v1.0.1...v1.0.2`.
- Release workflow validates `release_tag` against `package.json` version.
