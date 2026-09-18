#!/usr/bin/env bash
# Start Next.js on Render after a monorepo build (rootDir = repo root).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Render provides RENDER_EXTERNAL_URL (https://….onrender.com)
if [ -z "${NEXT_PUBLIC_SITE_URL:-}" ] && [ -n "${RENDER_EXTERNAL_URL:-}" ]; then
	export NEXT_PUBLIC_SITE_URL="${RENDER_EXTERNAL_URL}"
fi

export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-3000}"
export HOSTNAME="${HOSTNAME:-0.0.0.0}"

cd "${WEB_DIR}"

if [ ! -d ".next" ]; then
	echo "error: ${WEB_DIR}/.next not found — production build did not land in apps/web" >&2
	exit 1
fi

# Bind all interfaces so Render health checks can reach the process.
exec bunx next start --hostname 0.0.0.0 --port "${PORT}"
