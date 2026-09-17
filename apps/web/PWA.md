# OpenCut PWA

## Implemented

- Web App Manifest (`/manifest.json`): name, short_name, icons (192/512), standalone, theme/background colors
- Service worker (`/sw.js`) registered by `RegisterServiceWorker`
- Versioned app-shell cache (`opencut-shell-v1`)
- Offline fallback (`/offline.html`)
- Viewport `viewport-fit=cover` + safe-area CSS variables
- iOS `appleWebApp` + `statusBarStyle: black-translucent`

## Icons

If `android-icon-512x512.png` is missing or corrupt (non-PNG / wrong size):

```bash
cd apps/web && python3 scripts/generate-pwa-512-icon.py
```

Requires Pillow. PWA tests assert PNG signature and dimensions for every manifest icon.

## Not cached (by design)

- User video/audio (mp4, webm, mov, …)
- WASM binaries
- OPFS / media-files paths

Projects live in **IndexedDB** (metadata) + **OPFS** (media blobs). Network loss must not delete local projects.

## Platform notes

| Platform | Install | Offline shell | Notes |
|----------|---------|---------------|-------|
| Chrome/Edge desktop | Yes | Yes | Full SW support |
| Chrome Android | Yes | Yes | |
| Safari iOS | Add to Home Screen | Limited | SW on modern iOS; file picker & media still constrained |
| Safari macOS | Limited | Limited | |

**Network-dependent:** Whisper model download, any cloud AI, first-time static asset fetch.

**Mobile gate:** Editor shows a “Desktop only (for now)” notice under 1024px width; user can acknowledge and continue. Layout is not fully optimized for phone/tablet.

## Cache versioning

Bump `CACHE_VERSION` in `public/sw.js` on deploy so activate deletes old shell caches.

## Manual verification checklist

1. Open app → Application panel: manifest + SW registered
2. Import short MP4 → plays on timeline
3. Generate transcript → captions + `project.transcripts`
4. AI Edit → overlays / zoom appear
5. Undo once → AI changes gone as one step
6. Redo → return
7. Save → reload app → reopen project → transcript + AI edits remain
8. AI Edit again → no duplicates
9. Offline after first load → shell/fallback; Whisper still needs network
