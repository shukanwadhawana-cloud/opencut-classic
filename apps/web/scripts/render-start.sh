#!/usr/bin/env bash
set -euo pipefail
# Render provides RENDER_EXTERNAL_URL (https://….onrender.com)
if [ -z "${NEXT_PUBLIC_SITE_URL:-}" ] && [ -n "${RENDER_EXTERNAL_URL:-}" ]; then
  export NEXT_PUBLIC_SITE_URL="$RENDER_EXTERNAL_URL"
fi
export PORT="${PORT:-3000}"
exec bun run start
