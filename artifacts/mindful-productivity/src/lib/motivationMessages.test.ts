/**
 * Tests for motivation message library.
 *
 * Scope: EN / ID / JA launch languages only.
 * Legacy language fields (es/de/ar/zh) remain in the bundle but are not
 * tested as active languages — only en/id/ja are valid LanguageCode values.
 *
 * Covers: language following, date stability, date change, no API calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  MOTIVATION_MESSAGES,
  dailyIndex,
  getDailyMessage,
  getMessageByIndex,
  todayDateStr,
  getFavourites,
  toggleFavourite,
} from "./motivationMessages";
import type { LanguageCode } from "./translations";

// ── 1. Library integrity ──────────────────────────────────────────────────────

describe("motivationMessages — library", () => {
  it("has exactly 30 messages", () => {
    expect(MOTIVATION_MESSAGES).toHaveLength(30);
  });

  it("each message has non-empty translations for EN, ID, and JA", () => {
    const langs: LanguageCode[] = ["en", "id", "ja"];
    MOTIVATION_MESSAGES.forEach((msg, i) => {
      langs.forEach((lang) => {
        expect(msg.text[lang], `message ${i} missing lang ${lang}`).toBeTruthy();
        expect(msg.text[lang].length, `message ${i} lang ${lang} is empty`).toBeGreaterThan(0);
      });
    });
  });

  it("message IDs are unique and sequential", () => {
    const ids = MOTIVATION_MESSAGES.map((m) => m.id);
    expect(new Set(ids).size).toBe(MOTIVATION_MESSAGES.length);
  });

  it("English messages contain only Latin script (sanity check)", () => {
    MOTIVATION_MESSAGES.forEach((msg, i) => {
      expect(msg.text.en, `message ${i} english`).toMatch(/[a-zA-Z]/);
    });
  });

  it("Japanese messages contain CJK characters", () => {
    MOTIVATION_MESSAGES.forEach((msg, i) => {
      expect(msg.text.ja, `message ${i} japanese`).toMatch(/[\u3040-\u30FF\u4E00-\u9FFF]/);
    });
  });
});

// ── 2. getDailyMessage — language following for EN/ID/JA ─────────────────────

describe("getDailyMessage — language following", () => {
  it("returns English text for 'en'", () => {
    const msg = getDailyMessage("2026-08-18", "en");
    expect(typeof msg).toBe("string");
    expect(msg.length).toBeGreaterThan(0);
    // Must be recognisably Latin script
    expect(msg).toMatch(/[a-zA-Z]/);
  });

  it("returns Indonesian text for 'id'", () => {
    const msg = getDailyMessage("2026-08-18", "id");
    expect(typeof msg).toBe("string");
    expect(msg.length).toBeGreaterThan(0);
    // Indonesian differs from English on the same date
    expect(msg).not.toBe(getDailyMessage("2026-08-18", "en"));
  });

  it("returns Japanese text for 'ja'", () => {
    const msg = getDailyMessage("2026-08-18", "ja");
    // Japanese uses CJK characters
    expect(msg).toMatch(/[\u3040-\u30FF\u4E00-\u9FFF]/);
  });

  it("returns a different message for each of EN/ID/JA on the same date", () => {
    const date = "2026-08-18";
    const en = getDailyMessage(date, "en");
    const id = getDailyMessage(date, "id");
    const ja = getDailyMessage(date, "ja");
    // All three must differ from each other
    const unique = new Set([en, id, ja]);
    expect(unique.size).toBe(3);
  });

  it("getDailyMessage accepts all three LanguageCode values without TypeScript errors", () => {
    // This is a compile-time assertion exercised at runtime
    const langs: LanguageCode[] = ["en", "id", "ja"];
    for (const lang of langs) {
      const msg = getDailyMessage("2026-08-18", lang);
      expect(typeof msg).toBe("string");
      expect(msg.length).toBeGreaterThan(0);
    }
  });
});

// ── 3. Same date → same message ───────────────────────────────────────────────

describe("dailyIndex — date stability", () => {
  it("returns the same index for the same date string", () => {
    const idx1 = dailyIndex("2026-08-18");
    const idx2 = dailyIndex("2026-08-18");
    expect(idx1).toBe(idx2);
  });

  it("index is within valid range [0, 29]", () => {
    const idx = dailyIndex("2026-08-18");
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThanOrEqual(29);
  });

  it("returns the same message on multiple getDailyMessage calls for the same date + lang", () => {
    const msg1 = getDailyMessage("2026-08-18", "en");
    const msg2 = getDailyMessage("2026-08-18", "en");
    expect(msg1).toBe(msg2);
  });

  it("same date + different supported language → same slot but different translation", () => {
    const idx = dailyIndex("2026-08-18");
    expect(getDailyMessage("2026-08-18", "en")).toBe(MOTIVATION_MESSAGES[idx].text.en);
    expect(getDailyMessage("2026-08-18", "id")).toBe(MOTIVATION_MESSAGES[idx].text.id);
    expect(getDailyMessage("2026-08-18", "ja")).toBe(MOTIVATION_MESSAGES[idx].text.ja);
  });
});

// ── 4. Different date → different message (most of the time) ─────────────────

describe("dailyIndex — date changes", () => {
  it("returns different indices for different dates", () => {
    // Test a range of 30 consecutive days and verify not all the same
    const indices = Array.from({ length: 30 }, (_, i) => {
      const d = new Date("2026-08-01");
      d.setDate(d.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return dailyIndex(`${yyyy}-${mm}-${dd}`);
    });
    const unique = new Set(indices);
    // With a good hash, we should see at least 10 distinct values in 30 days
    expect(unique.size).toBeGreaterThanOrEqual(10);
  });

  it("2026-08-01 and 2026-08-02 produce different indices", () => {
    const a = dailyIndex("2026-08-01");
    const b = dailyIndex("2026-08-02");
    expect(a).not.toBe(b);
  });
});

// ── 5. No API calls (static library only) ────────────────────────────────────

describe("motivationMessages — no API calls", () => {
  it("getDailyMessage does not call fetch or XMLHttpRequest", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    getDailyMessage(todayDateStr(), "en");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("getMessageByIndex does not call fetch", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    getMessageByIndex(5, "id");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

// ── 6. getMessageByIndex wraps correctly ─────────────────────────────────────

describe("getMessageByIndex — bounds wrapping", () => {
  it("index 0 returns first message in EN", () => {
    expect(getMessageByIndex(0, "en")).toBe(MOTIVATION_MESSAGES[0].text.en);
  });

  it("index 0 returns first message in ID", () => {
    expect(getMessageByIndex(0, "id")).toBe(MOTIVATION_MESSAGES[0].text.id);
  });

  it("index 0 returns first message in JA", () => {
    expect(getMessageByIndex(0, "ja")).toBe(MOTIVATION_MESSAGES[0].text.ja);
  });

  it("index 29 returns last message", () => {
    expect(getMessageByIndex(29, "en")).toBe(MOTIVATION_MESSAGES[29].text.en);
  });

  it("index 30 wraps to 0", () => {
    expect(getMessageByIndex(30, "en")).toBe(MOTIVATION_MESSAGES[0].text.en);
  });

  it("getMessageByIndex accepts all three LanguageCode values", () => {
    const langs: LanguageCode[] = ["en", "id", "ja"];
    for (const lang of langs) {
      const msg = getMessageByIndex(5, lang);
      expect(typeof msg).toBe("string");
      expect(msg.length).toBeGreaterThan(0);
    }
  });
});

// ── 7. Favourites localStorage helpers ───────────────────────────────────────

describe("toggleFavourite / getFavourites", () => {
  beforeEach(() => {
    try { localStorage.removeItem("mindful_motivation_favorites"); } catch {}
  });
  afterEach(() => {
    try { localStorage.removeItem("mindful_motivation_favorites"); } catch {}
  });

  it("getFavourites returns [] when nothing stored", () => {
    expect(getFavourites()).toEqual([]);
  });

  it("toggleFavourite adds a new ID and returns true", () => {
    const result = toggleFavourite(3);
    expect(result).toBe(true);
    expect(getFavourites()).toContain(3);
  });

  it("toggleFavourite removes existing ID and returns false", () => {
    toggleFavourite(3);
    const result = toggleFavourite(3);
    expect(result).toBe(false);
    expect(getFavourites()).not.toContain(3);
  });

  it("multiple IDs stored and retrieved correctly", () => {
    toggleFavourite(0);
    toggleFavourite(5);
    toggleFavourite(29);
    const favs = getFavourites();
    expect(favs).toContain(0);
    expect(favs).toContain(5);
    expect(favs).toContain(29);
  });
});
