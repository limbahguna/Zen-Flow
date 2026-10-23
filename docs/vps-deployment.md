# Hostinger VPS deployment (Docker + existing Traefik)

Zen-Flow runs as **one** Node process. Express serves `/api` and the Vite
frontend from `dist/public`. On a VPS that already has Traefik and other
Compose projects, this stack stays isolated: unique project name, unique
container name, loopback-only publish, no host ports 80 or 443.

Do not change DNS for `getmindfulspace.com` until the loopback tests pass.
Do not install `deploy/nginx/zen-flow.conf` on this host — Traefik already
listens on 80/443.

## Isolation

| Resource | Value |
|---|---|
| Compose project | `mindful-space` |
| Container | `mindful-space-app` |
| Image | `mindful-space-app:latest` |
| Docker network | `mindful-space-internal` |
| Published port | `127.0.0.1:3010` → container `3000` |

This does not join Traefik or the networks used by `hermes-agent-lupk` and
`openclaw-oyz2` unless you later add `docker-compose.traefik.yml`.

## What gets built

`pnpm run build:hostinger` (inside the Docker build stage) produces:

```
artifacts/api-server/dist/
  index.mjs
  public/
```

Vite inlines `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` at **build**
time. The API reads `SUPABASE_URL` at **runtime**. Both must use the Dashboard
Project URL hostname `mdawcxxihzkaxozxznyx.supabase.co`. Leave
`VITE_API_BASE_URL` unset so the browser calls `/api` on the same origin.

## Staging install (no DNS, no Traefik, no nginx)

### 1. Confirm ports 80/443 stay with Traefik

```bash
sudo ss -tlnp | grep -E ':80 |:443 '
# Expect Traefik (or docker-proxy for Traefik), not nginx and not this app.
```

### 2. Clone without touching other projects

```bash
sudo mkdir -p /opt/mindful-space
sudo git clone https://github.com/limbahguna/Zen-Flow.git /opt/mindful-space
cd /opt/mindful-space
git checkout main
```

Do not reuse `/opt` directories of hermes-agent or openclaw.

### 3. Environment file

```bash
cp deploy/env.example .env
chmod 600 .env
nano .env
```

Required for a working image and login:

- `VITE_SUPABASE_URL=https://mdawcxxihzkaxozxznyx.supabase.co`
- `VITE_SUPABASE_ANON_KEY` (anon key from the same project; never the service-role key)
- `SUPABASE_URL=https://mdawcxxihzkaxozxznyx.supabase.co`
- `SUPABASE_ANON_KEY` (same project)
- `SUPABASE_SERVICE_ROLE_KEY` (runtime only)
- `DATABASE_URL`
- `AI_PROVIDER`, `AI_PROVIDER_API_KEY`, `AI_MODEL` (for AI Coach)
- `SESSION_SECRET`
- `HOST_PORT=3010`
- `CORS_ALLOWED_ORIGINS=http://127.0.0.1:3010` for SSH-tunnel browser tests

Do not set `VITE_API_BASE_URL`. Do not put `getmindfulspace.com` in
`VITE_SUPABASE_URL`.

Check hostnames only (do not print keys):

```bash
grep -E '^(VITE_SUPABASE_URL|SUPABASE_URL|HOST_PORT)=' .env
```

### 4. Build and start (isolated)

```bash
cd /opt/mindful-space
docker compose --project-name mindful-space build
docker compose --project-name mindful-space up -d
docker compose --project-name mindful-space ps
docker compose --project-name mindful-space logs -f app
```

Confirm other stacks are untouched:

```bash
docker ps --format '{{.Names}}\t{{.Ports}}'
# mindful-space-app should show 127.0.0.1:3010->3000
# hermes-agent-* and openclaw-* should be unchanged
# nothing from this stack on 0.0.0.0:80 or 0.0.0.0:443
```

### 5. Test on the VPS (loopback)

```bash
curl -i http://127.0.0.1:3010/api/healthz      # 200 JSON {"status":"ok"}
curl -I http://127.0.0.1:3010/                 # 200 text/html
curl -I http://127.0.0.1:3010/auth             # 200 text/html (SPA)
curl -I http://127.0.0.1:3010/dashboard        # 200 text/html
curl -i http://127.0.0.1:3010/api/nope         # 404 JSON
```

Confirm the baked Vite hostname (no keys):

```bash
JS=$(curl -sS http://127.0.0.1:3010/ | grep -oE '/assets/index-[^"]+\.js')
curl -sS "http://127.0.0.1:3010$JS" | grep -oE 'https://[a-z0-9-]+\.supabase\.co' | sort -u
# Must print only: https://mdawcxxihzkaxozxznyx.supabase.co
```

AI Coach without a browser (expects 401 without a user JWT; 503 if AI env is missing):

```bash
curl -i -X POST http://127.0.0.1:3010/api/ai/coach \
  -H 'Content-Type: application/json' \
  -d '{"message":"hello"}'
```

### 6. Browser test before DNS (SSH tunnel)

From your laptop:

```bash
ssh -L 3010:127.0.0.1:3010 USER@VPS_IP
```

Open `http://127.0.0.1:3010/auth`, sign in with email/password, then open Coach.
Same-origin `/api` calls go through the tunnel. Google OAuth may fail on this
origin until Auth redirect URLs are updated; that is a separate Auth change
and is not done here.

`https://getmindfulspace.com` continues to hit Replit until you later change DNS.

## Optional Traefik (still no DNS cutover)

Only after you have a **separate** hostname (not `getmindfulspace.com`) and know
Traefik's Docker network and cert resolver names:

```bash
docker network ls
docker inspect TRAEFIK_CONTAINER --format '{{json .NetworkSettings.Networks}}'
```

Set in `.env`: `TRAEFIK_NETWORK`, `TRAEFIK_HOST`, `TRAEFIK_ENTRYPOINT`,
`TRAEFIK_CERTRESOLVER`. Then:

```bash
docker compose --project-name mindful-space \
  -f docker-compose.yml -f docker-compose.traefik.yml \
  up -d
```

That overlay does not bind 80/443. Do not use `TRAEFIK_HOST=getmindfulspace.com`
until you are ready to move DNS.

## Updating

```bash
cd /opt/mindful-space
git pull origin main
docker compose --project-name mindful-space build
docker compose --project-name mindful-space up -d
```

## Rollback / stop (this stack only)

```bash
cd /opt/mindful-space
docker compose --project-name mindful-space down
# Other Compose projects keep running.
```

## Notes

- Static files are served by Node, not nginx or Traefik file providers.
- Android/iOS builds are not produced by this image.
- The image runs as the non-root `node` user and contains no `.env`.
