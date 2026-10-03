# syntax=docker/dockerfile:1

# Zen-Flow single-service production image.
#
# The build stage compiles the Vite frontend and the Express API, then copies the
# frontend into artifacts/api-server/dist/public. The runtime stage carries only
# that dist directory: esbuild bundles the API and its dependencies into
# dist/index.mjs, so no node_modules are needed to run the server.
#
# glibc (bookworm) is required, not musl/alpine: pnpm-workspace.yaml removes the
# *-musl platform packages for esbuild, rollup, lightningcss and tailwind oxide.

# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:24-bookworm-slim AS build

# Public Supabase values are compiled into the frontend bundle by Vite, so they
# must be present at build time. Pass them with --build-arg; never hardcode them.
# VITE_API_BASE_URL is intentionally left unset so the browser calls /api on the
# same origin.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

ENV CI=true
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN npm install -g pnpm@10.26.1

WORKDIR /repo

COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc package.json ./
COPY artifacts/api-server/package.json artifacts/api-server/
COPY artifacts/mindful-productivity/package.json artifacts/mindful-productivity/
COPY artifacts/mobile/package.json artifacts/mobile/
COPY artifacts/mockup-sandbox/package.json artifacts/mockup-sandbox/
COPY lib/api-client-react/package.json lib/api-client-react/
COPY lib/api-spec/package.json lib/api-spec/
COPY lib/api-zod/package.json lib/api-zod/
COPY lib/db/package.json lib/db/
COPY scripts/package.json scripts/

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build:hostinger

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

COPY --from=build --chown=node:node /repo/artifacts/api-server/dist ./dist

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--enable-source-maps", "dist/index.mjs"]
