# Hostinger VPS deployment (Docker + Caddy)

Zen-Flow runs as **one** Node process. Express serves `/api` and the Vite
frontend from `dist/public`. The stack stays isolated from Hermes, OpenClaw,
and n8n: unique project name, unique container names, its own Docker network.

The app container never publishes host ports 80 or 443. Loopback
`127.0.0.1:3010` is for SSH-tunnel staging. Public HTTPS for
`getmindfulspace.com` and `www.getmindfulspace.com` uses the Caddy overlay
(`docker-compose.caddy.yml`). That overlay is the only Compose file in this
repo that binds 80/443.

Do not change DNS for `getmindfulspace.com` until the loopback tests pass.
Do not install `deploy/nginx/zen-flow.conf` on this host — Caddy will own
80/443 after cutover. Do not start `docker-compose.traefik.yml`.

## Isolation

| Resource | Value |
|---|---|
| Compose project | `mindful-space` |
| App container | `mindful-space-app` |
| Caddy container | `mindful-space-caddy` (overlay only) |
| Image | `mindful-space-app:latest` |
| Docker network | `mindful-space-internal` |
| App publish | `127.0.0.1:3010` → container `3000` |
| Public publish | Caddy `80:80` and `443:443` (overlay) |

Caddy joins `mindful-space-internal` and proxies to `mindful-space-app:3000`.
It does not join Hermes, OpenClaw, or n8n networks.

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

## Staging install (no DNS, no Caddy, no nginx)

Start only `docker-compose.yml`. Leave 80/443 unused until cutover.

### 1. Confirm ports 80/443 are free

```bash
sudo ss -tlnp | grep -E ':80 |:443 '
# Expect no listener (or only a host firewall), not nginx, not this app.
# Caddy will bind these ports later, together with or after the DNS change.
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
- `CADDY_ACME_EMAIL` — mailbox you can read (needed when the Caddy overlay starts; Let's Encrypt expiry notices)
- `CORS_ALLOWED_ORIGINS` — comma-separated full origins, no trailing slash. The API splits on commas and trims each entry.

`https://getmindfulspace.com` and `https://www.getmindfulspace.com` are already
allowed in code. The SSH-tunnel origin is not. For staging, set:

```
CORS_ALLOWED_ORIGINS=http://127.0.0.1:3010
```

To also list the public origins explicitly (optional; merges with the static
list):

```
CORS_ALLOWED_ORIGINS=https://getmindfulspace.com,https://www.getmindfulspace.com,http://127.0.0.1:3010
```

Do not set `VITE_API_BASE_URL`. Do not put `getmindfulspace.com` in
`VITE_SUPABASE_URL`.

Check hostnames and Caddy email presence only (do not print keys):

```bash
grep -E '^(VITE_SUPABASE_URL|SUPABASE_URL|HOST_PORT|CADDY_ACME_EMAIL)=' .env
```

Confirm `CADDY_ACME_EMAIL` is non-empty; do not paste the address into logs.

### 4. Build and start (isolated, loopback only)

```bash
cd /opt/mindful-space
docker compose --project-name mindful-space -f docker-compose.yml config
docker compose --project-name mindful-space -f docker-compose.yml build
docker compose --project-name mindful-space -f docker-compose.yml up -d
docker compose --project-name mindful-space ps
docker compose --project-name mindful-space logs -f app
```

Confirm other stacks are untouched:

```bash
docker ps --format '{{.Names}}\t{{.Ports}}'
# mindful-space-app should show 127.0.0.1:3010->3000
# hermes-agent-* and openclaw-* should be unchanged
# nothing from this stack on 0.0.0.0:80 or 0.0.0.0:443 yet
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

`https://getmindfulspace.com` continues to hit the previous host until you
change DNS.

## Public HTTPS cutover (Caddy + DNS)

Let's Encrypt will only issue certificates after `getmindfulspace.com` and
`www.getmindfulspace.com` resolve to this VPS **and** ports 80/443 are reachable
from the internet. Start Caddy **at the same time as the DNS change**, or
**after** DNS already points here. Starting Caddy while DNS still points at
another host will fail ACME and can leave visitors on the old site.

### 1. Validate the merged Compose file (does not start containers)

```bash
cd /opt/mindful-space
docker compose --project-name mindful-space \
  -f docker-compose.yml -f docker-compose.caddy.yml config
```

Confirm the rendered config: Caddy publishes 80/443; app stays
`127.0.0.1:3010->3000`; Caddy is on `mindful-space-internal`.

Open 80/443 on the VPS firewall / security group if they are not already open.

### 2. Point DNS, then start Caddy

At the DNS provider, set A (and AAAA if you use IPv6) for:

- `getmindfulspace.com`
- `www.getmindfulspace.com`

to this VPS. Then:

```bash
cd /opt/mindful-space
docker compose --project-name mindful-space \
  -f docker-compose.yml -f docker-compose.caddy.yml \
  up -d
```

Wait for DNS TTL and ACME. Check:

```bash
docker ps --format '{{.Names}}\t{{.Ports}}'
# mindful-space-caddy: 0.0.0.0:80->80 and 0.0.0.0:443->443
# mindful-space-app: 127.0.0.1:3010->3000
docker compose --project-name mindful-space \
  -f docker-compose.yml -f docker-compose.caddy.yml \
  logs -f caddy
```

```bash
curl -i https://getmindfulspace.com/api/healthz
curl -I https://www.getmindfulspace.com/
```

Loopback staging (`127.0.0.1:3010`) can stay published during public HTTPS.

## Rollback

DNS back to the previous host first if public traffic must leave this VPS,
then stop Caddy so 80/443 are free:

```bash
cd /opt/mindful-space
# Stop Caddy only; keep the app on loopback:
docker compose --project-name mindful-space \
  -f docker-compose.yml -f docker-compose.caddy.yml \
  stop caddy
# Or remove the Caddy service from this project:
docker compose --project-name mindful-space \
  -f docker-compose.yml -f docker-compose.caddy.yml \
  rm -f caddy
```

Stop the whole Mindful Space stack (does not stop Hermes / OpenClaw / n8n):

```bash
cd /opt/mindful-space
docker compose --project-name mindful-space \
  -f docker-compose.yml -f docker-compose.caddy.yml \
  down
```

`down` without `-v` keeps Caddy certificate volumes
(`mindful-space-caddy-data`, `mindful-space-caddy-config`). Do not delete those
volumes unless you intend to re-issue certificates.

## Updating

```bash
cd /opt/mindful-space
git pull origin main
docker compose --project-name mindful-space \
  -f docker-compose.yml -f docker-compose.caddy.yml \
  build
docker compose --project-name mindful-space \
  -f docker-compose.yml -f docker-compose.caddy.yml \
  up -d
```

During staging (no Caddy yet), omit `-f docker-compose.caddy.yml`.

## Notes

- Static files are served by Node. Caddy only reverse-proxies.
- Android/iOS builds are not produced by this image.
- The image runs as the non-root `node` user and contains no `.env`.
- `docker-compose.traefik.yml` is unused on this host.
