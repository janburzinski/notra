#!/usr/bin/env bash
set -euo pipefail
cd ../..
bun run db:check
export NITRO_PRESET=vercel
turbo run build --filter=dashboard --cache=remote:r
bun apps/dashboard/scripts/prune-build-cache.ts
if [ "${VERCEL_ENV:-}" = "production" ]; then
  DATABASE_URL="${MIGRATION_DATABASE_URL:-${DATABASE_URL:-}}" bun run db:migrate
  if [ -n "${INTEGRATION_ENCRYPTION_KEY_PREVIOUS:-}" ]; then
    (cd packages/db && bun run rotate:integration-key)
  fi
  if [ -n "${TINYBIRD_TOKEN:-}" ] && [ -n "${TINYBIRD_BASE_URL:-}" ]; then
    (cd packages/analytics && bun run tinybird:deploy)
  fi
fi
