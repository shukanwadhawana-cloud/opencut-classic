# OpenCut PWA

## What is implemented

- Web App Manifest (`/manifest.json`) with name, short_name, icons (192/512), standalone display, theme colors
- Service worker (`/sw.js`) registered by `RegisterServiceWorker`
- Versioned app-shell cache (`opencut-shell-v1`)
- Offline fallback page (`/offline.html`)
- Safe-area CSS variables for iOS standalone

## What is intentionally not cached

- User video/audio files (mp4, webm, mov, …)
- WASM binaries (handled by the browser/module loader)
- OPFS / media-files paths

Projects continue to live in IndexedDB + OPFS as implemented by the classic editor. Losing network must not delete local projects.

## Platform notes

| Platform | Install | Offline shell | Notes |
|----------|---------|---------------|-------|
| Chrome/Edge desktop | Yes | Yes | Full SW support |
| Chrome Android | Yes | Yes | |
| Safari iOS | Add to Home Screen | Limited | SW supported recent iOS; media/file pickers still constrained |
| Safari macOS | Limited | Limited | |

Whisper model download and any future cloud AI remain network-dependent.

## Cache versioning

Bump `CACHE_VERSION` in `public/sw.js` on deploy so old shell caches are deleted on activate.
