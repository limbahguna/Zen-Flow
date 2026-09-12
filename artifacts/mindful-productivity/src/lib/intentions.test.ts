import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("account-private intention persistence", () => {
  it("derives ownership in PostgreSQL and enforces all CRUD operations with RLS", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "docs/migrations/account_private_intentions.sql"),
      "utf8",
    );
    expect(sql).toContain("user_id uuid NOT NULL DEFAULT auth.uid()");
    expect(sql).toContain("NEW.user_id := auth.uid()");
    expect(sql).toContain("ALTER TABLE public.intentions FORCE ROW LEVEL SECURITY");
    for (const operation of ["select", "insert", "update", "delete"]) {
      expect(sql).toContain(`intentions_${operation}_own`);
    }
  });

  it("never sends a client-provided owner when creating an intention", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/lib/intentions.ts"),
      "utf8",
    );
    const createBody = source.slice(
      source.indexOf("export async function createIntention"),
      source.indexOf("export async function updateIntention"),
    );
    expect(createBody).not.toContain("user_id");
    expect(createBody).toContain(".insert(cleanInput(input))");
  });

  it("keys the intention query cache by authenticated user", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/hooks/useIntentions.ts"),
      "utf8",
    );
    expect(source).toContain('queryKey: ["intentions", user?.id]');
    expect(source).toContain('enabled: !!user?.id');
  });
});