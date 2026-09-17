# Deploy OpenCut Classic PWA on Render

## Your PWA URL

After a successful deploy, Render assigns:

```text
https://opencut-classic.onrender.com
```

(Exact hostname is shown in the Render dashboard. Free tier may sleep after idle.)

That HTTPS URL is your **PWA link** — open it in Chrome/Safari, then Install / Add to Home Screen.

## One-time setup (dashboard)

1. Open [https://dashboard.render.com](https://dashboard.render.com)
2. **New → Blueprint**
3. Connect GitHub repo **`shukanwadhawana-cloud/opencut-classic`**
4. Select branch **`main`** — Render reads `render.yaml`
5. Apply the blueprint (creates **Web Service** + **Postgres**)
6. After first deploy, set env var:

   | Key | Value |
   |-----|--------|
   | `NEXT_PUBLIC_SITE_URL` | `https://<your-service>.onrender.com` |

7. **Manual Deploy** once more so the public URL is baked into the client bundle

## Local equivalent

```bash
bun install
bun run build:web
cd apps/web && bun run start
```

## Notes

- Free web services **spin down** after ~15 minutes idle; first request can take 30–60s
- Build needs enough memory; if OOM, upgrade the web service plan
- Core editor uses **IndexedDB/OPFS** in the browser; Postgres is mainly for auth/account features
- Optional: set real `UPSTASH_REDIS_*` and Freesound keys later for full auth rate-limits / sound search

## Manifest / SW (once live)

- `https://<your-service>.onrender.com/manifest.json`
- `https://<your-service>.onrender.com/sw.js`
