import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const read = (name: string) => fs.readFileSync(path.join(repoRoot, name), "utf8");

describe("Hostinger compose isolation", () => {
  const compose = read("docker-compose.yml");
  const caddyCompose = read("docker-compose.caddy.yml");
  const caddyfile = read("deploy/caddy/Caddyfile");
  const traefik = read("docker-compose.traefik.yml");
  const nginx = read("deploy/nginx/zen-flow.conf");
  const envExample = read("deploy/env.example");

  it("does not publish host ports 80 or 443 on the app and stays on loopback", () => {
    expect(compose).toContain("name: mindful-space");
    expect(compose).toContain("container_name: mindful-space-app");
    expect(compose).toContain("127.0.0.1:${HOST_PORT:-3010}:3000");
    expect(compose).not.toMatch(/["']0\.0\.0\.0:80/);
    expect(compose).not.toMatch(/["']80:80/);
    expect(compose).not.toMatch(/["']443:443/);
    expect(compose).not.toMatch(/["']80:443/);
    expect(traefik).not.toMatch(/["']80:80/);
    expect(traefik).not.toMatch(/["']443:443/);
    expect(traefik).toContain("traefik.http.routers.mindful-space");
  });

  it("documents the Dashboard Supabase hostname, Caddy ACME email, and staging port", () => {
    expect(envExample).toContain("https://mdawcxxihzkaxozxznyx.supabase.co");
    expect(envExample).toContain("HOST_PORT=3010");
    expect(envExample).toContain("COMPOSE_PROJECT_NAME=mindful-space");
    expect(envExample).toMatch(/^CADDY_ACME_EMAIL=$/m);
    expect(envExample).toContain("Let's Encrypt");
    expect(envExample).toContain(
      "https://getmindfulspace.com,https://www.getmindfulspace.com,http://127.0.0.1:3010",
    );
    expect(nginx).toContain("Do NOT install this file");
    expect(nginx).toContain("Caddy");
  });

  it("configures Caddy as the only 80/443 publisher with public domains and app upstream", () => {
    expect(caddyCompose).toContain("container_name: mindful-space-caddy");
    expect(caddyCompose).toMatch(/^\s+- "80:80"/m);
    expect(caddyCompose).toMatch(/^\s+- "443:443"/m);
    expect(caddyCompose).toContain("mindful-space-internal");
    expect(caddyCompose).toContain("name: mindful-space-caddy-data");
    expect(caddyCompose).toContain("name: mindful-space-caddy-config");
    expect(caddyCompose).toContain("CADDY_ACME_EMAIL");
    expect(caddyCompose).not.toContain("127.0.0.1:${HOST_PORT:-3010}:3000");

    expect(compose).toContain("127.0.0.1:${HOST_PORT:-3010}:3000");
    expect(compose).not.toMatch(/["']80:80/);
    expect(compose).not.toMatch(/["']443:443/);
    expect(traefik).not.toMatch(/["']80:80/);
    expect(traefik).not.toMatch(/["']443:443/);

    expect(caddyfile).toContain("getmindfulspace.com, www.getmindfulspace.com");
    expect(caddyfile).toContain("reverse_proxy mindful-space-app:3000");
    expect(caddyfile).toContain("email {$CADDY_ACME_EMAIL}");
  });
});
