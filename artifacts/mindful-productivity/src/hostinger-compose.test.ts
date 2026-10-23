import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const read = (name: string) => fs.readFileSync(path.join(repoRoot, name), "utf8");

describe("Hostinger compose isolation", () => {
  const compose = read("docker-compose.yml");
  const traefik = read("docker-compose.traefik.yml");
  const nginx = read("deploy/nginx/zen-flow.conf");
  const envExample = read("deploy/env.example");

  it("does not publish host ports 80 or 443 and stays on loopback", () => {
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

  it("documents the Dashboard Supabase hostname and Traefik-safe staging port", () => {
    expect(envExample).toContain("https://mdawcxxihzkaxozxznyx.supabase.co");
    expect(envExample).toContain("HOST_PORT=3010");
    expect(envExample).toContain("COMPOSE_PROJECT_NAME=mindful-space");
    expect(nginx).toContain("Do NOT install this file");
  });
});
