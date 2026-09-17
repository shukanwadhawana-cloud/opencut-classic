# Deploy OpenCut Classic PWA on Render

## Your PWA URL

After deploy:

```text
https://opencut-classic.onrender.com
```

(Exact hostname is on the Render service page.)

## Database is optional for now

**Editor projects are saved in the browser** (IndexedDB + OPFS), not on Render Postgres.

You can deploy **without** `DATABASE_URL`. Add Postgres later when you want login/accounts.

| Feature | Needs DATABASE_URL? |
|---------|---------------------|
| Open editor, import video, timeline | No |
| Transcript / AI Edit / save project | No (browser storage) |
| PWA install | No |
| Email/password login, server accounts | **Yes** (later) |

## Web Service settings

| Field | Value |
|--------|--------|
| Repo | `shukanwadhawana-cloud/opencut-classic` |
| Branch | `main` |
| Root Directory | *(empty)* |
| Build | `bun install && bun run build:web` |
| Start | `bash apps/web/scripts/render-start.sh` |

Env:

| Key | Value |
|-----|--------|
| `NODE_ENV` | `production` |
| `BUN_VERSION` | `1.2.18` |
| `NEXT_TELEMETRY_DISABLED` | `1` |
| `BETTER_AUTH_SECRET` | any 16+ character random string |
| `NEXT_PUBLIC_SITE_URL` | set after first deploy to your `https://….onrender.com` |
| `DATABASE_URL` | **skip for now** |

## Later: add Postgres

1. New → PostgreSQL (free)
2. Copy Internal Database URL
3. Add `DATABASE_URL` on the web service
4. Redeploy — auth APIs will turn on
