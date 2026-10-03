# Hostinger VPS deployment (Docker)

Zen-Flow runs as **one** Node process in production. Express serves the API under
`/api` and the compiled Vite frontend from `dist/public` at `/`. This document
covers deploying that single service to a Hostinger VPS with Docker and nginx.

This replaces nothing on Replit. The Replit deployment, the Capacitor Android
build, Supabase, and the API contract are unchanged.

## What gets built

`pnpm run build:hostinger` produces:

```
artifacts/api-server/dist/
  index.mjs          # esbuild bundle of the Express API
  public/
    index.html       # Vite frontend entry
    assets/...       # content-hashed JS/CSS
```

esbuild bundles the API's dependencies into `index.mjs`, so the runtime image
carries only `dist/` — no `node_modules`.

## Image layout

| Stage | Base | Purpose |
|---|---|---|
| `build` | `node:24-bookworm-slim` | `npm install -g pnpm@10.26.1`, `pnpm install --frozen-lockfile`, `pnpm run build:hostinger` |
| `runtime` | `node:24-bookworm-slim` | Runs `node --enable-source-maps dist/index.mjs` as the non-root `node` user |

**Use glibc, not Alpine.** `pnpm-workspace.yaml` removes the `*-musl` platform
packages for esbuild, rollup, lightningcss, and Tailwind oxide, so a musl base
image cannot install the lockfile.

## Environment variables

Nothing is hardcoded. Two categories:

**Build time** — Vite inlines these into the public browser bundle, so they must
be present when the image is built. Only public values belong here.

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_BASE_URL` — **leave unset**. The browser calls `/api` on the same
  origin. Setting it would point the web app at a different host.

**Runtime** — read by the server from `./.env` via `docker compose`.

- `PORT` (set to `3000` by `docker-compose.yml`)
- `NODE_ENV`
- `DATABASE_URL`
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `AI_PROVIDER`, `AI_PROVIDER_API_KEY`, `AI_MODEL`
- `SESSION_SECRET`
- `CORS_ALLOWED_ORIGINS`
- `LOG_LEVEL`

`CORS_ALLOWED_ORIGINS` is a comma-separated list of full origins. Entries are
trimmed and empty items ignored, e.g. `https://example.com,https://www.example.com`.
Same-origin browser traffic needs no entry. `capacitor://localhost` and the
canonical `getmindfulspace.com` origins are already allowed in code.

Start from `deploy/env.example`. `.env` is git-ignored and excluded by
`.dockerignore`, so secrets never enter the image or the repository.

## First deployment

### 1. Install Docker on the VPS

```bash
ssh root@YOUR_VPS_IP
curl -fsSL https://get.docker.com | sh
docker --version
docker compose version
```

### 2. Get the code

```bash
mkdir -p /opt && cd /opt
git clone https://github.com/limbahguna/Zen-Flow.git zen-flow
cd /opt/zen-flow
git checkout main
```

### 3. Create the environment file

```bash
cp deploy/env.example .env
chmod 600 .env
nano .env        # fill in real values
```

### 4. Build and start

```bash
cd /opt/zen-flow
docker compose build
docker compose up -d
docker compose ps
docker compose logs -f app
```

`docker compose build` reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
from `.env` and passes them as build args.

### 5. Verify locally on the VPS

```bash
curl -i http://127.0.0.1:3000/api/healthz      # 200, application/json, {"status":"ok"}
curl -I http://127.0.0.1:3000/                 # 200, text/html
curl -I http://127.0.0.1:3000/dashboard        # 200, text/html (SPA fallback)
curl -i http://127.0.0.1:3000/api/nope         # 404, application/json
```

The container publishes on `127.0.0.1` only. It is not reachable from the
internet until nginx is in front of it.

### 6. Reverse proxy and TLS

```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
sudo cp deploy/nginx/zen-flow.conf /etc/nginx/sites-available/zen-flow.conf
sudo ln -s /etc/nginx/sites-available/zen-flow.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d getmindfulspace.com -d www.getmindfulspace.com
```

Only do this once DNS already points at the VPS. This document does not change
DNS; cutting traffic over is a separate, deliberate step.

### 7. Verify through the domain

```bash
curl -i https://getmindfulspace.com/api/healthz
curl -I https://getmindfulspace.com/
curl -I https://getmindfulspace.com/dashboard
```

## Updating a running deployment

```bash
cd /opt/zen-flow
git pull origin main
docker compose build
docker compose up -d
docker compose logs -f app
```

Compose recreates the container only after the new image builds, so a failed
build leaves the previous version serving traffic.

## Rollback

```bash
cd /opt/zen-flow
git checkout <previous-commit-sha>
docker compose build
docker compose up -d
```

## Operations

```bash
docker compose ps                    # status, including healthcheck
docker compose logs --tail=200 app   # recent logs
docker compose restart app           # restart without rebuilding
docker compose down                  # stop and remove the container
docker image prune -f                # reclaim space from old builds
```

The healthcheck calls `GET /api/healthz` every 30s from inside the container.
`docker compose ps` reports `healthy` once it passes.

## Notes and caveats

- **Static files are served by Node, not nginx.** The nginx config only proxies.
  Do not add a `root` directive; the SPA fallback lives in the Express app.
- **Source maps are not public.** `dist/*.map` files sit next to the server
  bundle, outside `dist/public`, and the static layer rejects `.map` requests.
- **`trust proxy` is not enabled.** The app does not use client IP for any
  decision, so it is left untouched. Enable it deliberately if that changes.
- **Android is unaffected.** The Capacitor build has its own API origin and is
  not built by this image.
- **The image runs as the non-root `node` user** and contains no `.env` file,
  no source, and no `node_modules`.
