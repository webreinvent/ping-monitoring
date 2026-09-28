# LNPM Cloud Dashboard — production image
#
# Build context is the repository root (this is a pnpm workspace:
# root package.json + dashboard/ member, single lockfile at the root).
#
#   docker build -f dashboard/Dockerfile -t lnpm-dashboard .
#
# better-sqlite3 v11 ships no musl prebuilds, so it compiles from source in
# the deps stage (python3/make/g++). The runtime stage uses the same
# node:22-alpine base, so the compiled .node binary is ABI-compatible.

# ---------------------------------------------------------------------------
# Stage 1: deps — install workspace dependencies
# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY dashboard/package.json ./dashboard/package.json
RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# Stage 2: build — nuxt build (Nitro node-server output in dashboard/.output)
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
# --link forces the copy into its own layer (BuildKit/overlayfs workaround)
COPY --link --from=deps /app/node_modules ./node_modules
COPY --link --from=deps /app/dashboard/node_modules ./dashboard/node_modules
COPY pnpm-workspace.yaml package.json ./
COPY dashboard/ ./dashboard/
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN pnpm --filter lnpm-dashboard run build

# ---------------------------------------------------------------------------
# Stage 3: runtime
# ---------------------------------------------------------------------------
FROM node:22-alpine
ARG APP_VERSION
ENV NODE_ENV=production
WORKDIR /app/dashboard
RUN apk add --no-cache curl \
 && addgroup -g 1001 -S appgroup \
 && adduser -S appuser -u 1001

# pnpm's dashboard/node_modules entries are symlinks into the root
# /app/node_modules/.pnpm store, so BOTH trees must be mirrored.
COPY --link --from=build /app/node_modules /app/node_modules
COPY --link --from=build /app/dashboard/node_modules /app/dashboard/node_modules
# Nitro output + schema/migrations (the database plugin resolves
# "schema/migrations" relative to the working directory at startup).
COPY --from=build /app/dashboard/.output /app/dashboard/.output
COPY --from=build /app/dashboard/schema /app/dashboard/schema
# package.json is read at runtime for the /api/health version field.
COPY --from=build /app/dashboard/package.json /app/dashboard/package.json

# Default DATABASE_PATH is .data/lingering.db (relative to CWD).
RUN mkdir -p .data && chown -R appuser:appgroup /app
USER appuser

LABEL org.opencontainers.image.version="${APP_VERSION}"
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://localhost:3000/api/health || exit 1

CMD ["node", ".output/server/index.mjs"]
