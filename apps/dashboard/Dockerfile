# syntax=docker/dockerfile:1

FROM oven/bun:1.4.0-slim AS bun

FROM node:24.11.1-bookworm-slim AS base
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
RUN ln -s /usr/local/bin/bun /usr/local/bin/bunx
WORKDIR /app

FROM base AS builder
COPY . .
RUN bun install --frozen-lockfile --ignore-scripts

ARG NOTRA_DEMO_MODE
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_NOTRA_DEMO_MODE
ARG NEXT_PUBLIC_NOTRA_DEMO_API_URL
ARG WORKFLOW_BASE_URL
ARG UNKEY_SECRETS_ID=notra-build-env
ENV NITRO_PRESET=node-server
RUN --mount=type=secret,id=${UNKEY_SECRETS_ID},target=/run/secrets/.env \
    set -a && if [ -f /run/secrets/.env ]; then . /run/secrets/.env; fi && set +a \
    && bunx turbo run build --filter=dashboard

FROM builder AS migrator
RUN mkdir -p /migrate \
  && bun build packages/db/src/scripts/migrate.ts --target=node \
    --external pg-native --outfile=/migrate/migrate.mjs \
  && cp -r packages/db/migrations /migrate/migrations \
  && printf '#!/bin/sh\nset -e\nexec node /migrate/migrate.mjs /migrate/migrations\n' > /migrate/run.sh \
  && chmod +x /migrate/run.sh

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV WORKFLOW_LOCAL_DATA_DIR=/tmp/notra-workflows
COPY --from=builder /app/apps/dashboard/.output /app/apps/dashboard/.output
COPY --from=migrator /migrate /migrate
WORKDIR /app/apps/dashboard
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
