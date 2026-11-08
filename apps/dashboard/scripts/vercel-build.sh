#!/usr/bin/env bash
set -euo pipefail
cd ../..
bun run db:check
export NITRO_PRESET=vercel
turbo run build --filter=dashboard --cache=remote:r
bun apps/dashboard/scripts/prune-build-cache.ts
if [ "${VERCEL_ENV:-}" = "production" ]; then
  DATABASE_URL="${MIGRATION_DATABASE_URL:-${DATABASE_URL:-}}" bun run db:migrate
  (cd apps/dashboard && bun scripts/send-geo-engine-change-emails.ts --once --send) ||
    echo "GEO engine change emails failed; rerun scripts/send-geo-engine-change-emails.ts --send" >&2
  if [ -n "${TINYBIRD_TOKEN:-}" ] && [ -n "${TINYBIRD_BASE_URL:-}" ]; then
    (cd packages/analytics && bun run tinybird:deploy)
  else
    echo "Skipping Tinybird deploy: TINYBIRD_TOKEN or TINYBIRD_BASE_URL is unset" >&2
  fi
fi
