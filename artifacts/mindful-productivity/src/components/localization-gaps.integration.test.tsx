/**
 * Integration tests for the remaining EN/ID/JA localization gaps.
 *
 * Scope:
 *   1. RatioCircle          — EN/ID/JA empty state and ratio summary
 *   2. WeeklyTrendChart     — EN/ID/JA weekday labels, empty tooltip
 *   3. FrictionReducerModal — locale-aware suggestion prefix; user task title
 *                             unchanged; user edits not overwritten on lang change
 *   4. LearnPage            — category filter labels in EN/ID/JA
 *   5. LessonReader         — category badge label in EN/ID/JA
 *   6. Local lessons        — localized title and body; stable IDs
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { LanguageProvider, useLanguage } from "@/context/LanguageContext";
import type { LanguageCode } from "@/lib/translations";
import { getLocalLessons } from "@/lib/localLessons";

// Import components directly (no dynamic imports at describe level)
import { RatioCircle } from "@/components/RatioCircle";
import { WeeklyTrendChart } from "@/components/WeeklyTrendChart";
import { FrictionReducerModal } from "@/components/FrictionReducerModal";
import { LessonReader } from "@/components/LessonReader";

// ── Global mocks ──────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase", () => ({
  default: {
    auth: {
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({
    user: { id: "test-user-id", email: "test@example.com" },
    session: null,
    loading: false,
  })),
}));

vi.mock("@/hooks/useTaskActions", () => ({
  useTaskActions: vi.fn(() => ({
    shrink: { mutateAsync: vi.fn(() => Promise.resolve()), isPending: false },
    postpone: { mutateAsync: vi.fn(() => Promise.resolve()), isPending: false },
    complete: { mutateAsync: vi.fn(() => Promise.resolve()), isPending: false },
    abandon: { mutateAsync: vi.fn(() => Promise.resolve()), isPending: false },
  })),
}));

vi.mock("wouter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("wouter")>();
  return {
    ...actual,
    useLocation: vi.fn(() => ["/", vi.fn()]),
  };
});

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: vi.fn(() => ({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })),
  };
});

// ── Helpers ────────────────────────────────────────────────────────────────────

function LangSwitchButton({ lang }: { lang: LanguageCode }) {
  const { setLanguage } = useLanguage();
  return (
    <button data-testid={`switch-to-${lang}`} onClick={() => setLanguage(lang)}>
      {lang}
    </button>
  );
}

function withLang(lang: LanguageCode, children: React.ReactNode) {
  if (lang !== "en") localStorage.setItem("mindful_language", lang);
  return render(
    <LanguageProvider>
      <LangSwitchButton lang="en" />
      <LangSwitchButton lang="id" />
      <LangSwitchButton lang="ja" />
      {children}
    </LanguageProvider>,
  );
}

beforeEach(() => {
  try { localStorage.removeItem("mindful_language"); } catch {}
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  try { localStorage.removeItem("mindful_language"); } catch {}
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. RatioCircle — empty state and ratio summary
// ─────────────────────────────────────────────────────────────────────────────
describe("RatioCircle — localization", () => {
  it("EN: shows English empty state when planned=0", () => {
    withLang("en", <RatioCircle ratio={0} planned={0} done={0} />);
    expect(screen.getByTestId("ratio-summary").textContent).toBe(
      "No plans set for today yet",
    );
  });

  it("ID: shows Indonesian empty state when planned=0", () => {
    withLang("id", <RatioCircle ratio={0} planned={0} done={0} />);
    expect(screen.getByTestId("ratio-summary").textContent).toBe(
      "Belum ada rencana untuk hari ini",
    );
  });

  it("JA: shows Japanese empty state when planned=0", () => {
    withLang("ja", <RatioCircle ratio={0} planned={0} done={0} />);
    expect(screen.getByTestId("ratio-summary").textContent).toBe(
      "今日の計画はまだありません",
    );
  });

  it("EN: shows English ratio summary with data", () => {
    withLang("en", <RatioCircle ratio={75} planned={4} done={3} />);
    const text = screen.getByTestId("ratio-summary").textContent ?? "";
    expect(text).toContain("3");
    expect(text).toContain("4");
    expect(text).toContain("plans");
  });

  it("ID: shows Indonesian ratio summary with data", () => {
    withLang("id", <RatioCircle ratio={75} planned={4} done={3} />);
    const text = screen.getByTestId("ratio-summary").textContent ?? "";
    expect(text).toContain("3");
    expect(text).toContain("4");
    expect(text).toContain("rencana");
  });

  it("JA: shows Japanese ratio summary with data", () => {
    withLang("ja", <RatioCircle ratio={75} planned={4} done={3} />);
    const text = screen.getByTestId("ratio-summary").textContent ?? "";
    expect(text).toContain("3");
    expect(text).toContain("4");
    expect(text).toContain("件");
  });

  it("switches EN→ID→JA without remount", async () => {
    const user = userEvent.setup();
    render(
      <LanguageProvider>
        <LangSwitchButton lang="id" />
        <LangSwitchButton lang="ja" />
        <LangSwitchButton lang="en" />
        <RatioCircle ratio={0} planned={0} done={0} />
      </LanguageProvider>,
    );

    expect(screen.getByTestId("ratio-summary").textContent).toBe(
      "No plans set for today yet",
    );

    await user.click(screen.getByTestId("switch-to-id"));
    expect(screen.getByTestId("ratio-summary").textContent).toBe(
      "Belum ada rencana untuk hari ini",
    );

    await user.click(screen.getByTestId("switch-to-ja"));
    expect(screen.getByTestId("ratio-summary").textContent).toBe(
      "今日の計画はまだありません",
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. WeeklyTrendChart — weekday labels, empty tooltip
// ─────────────────────────────────────────────────────────────────────────────
describe("WeeklyTrendChart — localization", () => {
  /** Build 7 bars with no data */
  function emptyBars() {
    return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label, i) => ({
      label,
      planned: 0,
      done: 0,
      ratio: 0,
      isFuture: i >= 4,
    }));
  }

  it("EN: shows English weekday labels", () => {
    withLang("en", <WeeklyTrendChart bars={emptyBars()} />);
    expect(screen.getByText("Mon")).toBeTruthy();
    expect(screen.getByText("Fri")).toBeTruthy();
    expect(screen.getByText("Sun")).toBeTruthy();
  });

  it("ID: shows Indonesian weekday labels", () => {
    withLang("id", <WeeklyTrendChart bars={emptyBars()} />);
    expect(screen.getByText("Sen")).toBeTruthy(); // Monday
    expect(screen.getByText("Jum")).toBeTruthy(); // Friday
    expect(screen.getByText("Min")).toBeTruthy(); // Sunday
  });

  it("JA: shows Japanese weekday labels", () => {
    withLang("ja", <WeeklyTrendChart bars={emptyBars()} />);
    expect(screen.getByText("月")).toBeTruthy(); // Monday
    expect(screen.getByText("金")).toBeTruthy(); // Friday
    expect(screen.getByText("日")).toBeTruthy(); // Sunday
  });

  it("EN: empty bar tooltip says 'No tasks'", () => {
    withLang("en", <WeeklyTrendChart bars={emptyBars()} />);
    const bar = document.querySelector('[title="No tasks"]');
    expect(bar).toBeTruthy();
  });

  it("ID: empty bar tooltip in Indonesian", () => {
    withLang("id", <WeeklyTrendChart bars={emptyBars()} />);
    const bar = document.querySelector('[title="Tidak ada tugas"]');
    expect(bar).toBeTruthy();
  });

  it("JA: empty bar tooltip in Japanese", () => {
    withLang("ja", <WeeklyTrendChart bars={emptyBars()} />);
    const bar = document.querySelector('[title="タスクなし"]');
    expect(bar).toBeTruthy();
  });

  it("data identity: bar data-testid uses stable English label regardless of locale", () => {
    withLang("id", <WeeklyTrendChart bars={emptyBars()} />);
    // data-testid uses bar.label (the stable "Mon", "Tue", etc.)
    expect(screen.getByTestId("weekly-bar-mon")).toBeTruthy();
    expect(screen.getByTestId("weekly-bar-fri")).toBeTruthy();
  });

  it("switches EN→ID→JA weekday labels without remount", async () => {
    const user = userEvent.setup();
    render(
      <LanguageProvider>
        <LangSwitchButton lang="id" />
        <LangSwitchButton lang="ja" />
        <LangSwitchButton lang="en" />
        <WeeklyTrendChart bars={emptyBars()} />
      </LanguageProvider>,
    );

    expect(screen.getByText("Mon")).toBeTruthy();

    await user.click(screen.getByTestId("switch-to-id"));
    expect(screen.queryByText("Mon")).toBeNull();
    expect(screen.getByText("Sen")).toBeTruthy();

    await user.click(screen.getByTestId("switch-to-ja"));
    expect(screen.queryByText("Sen")).toBeNull();
    expect(screen.getByText("月")).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. FrictionReducerModal — locale-aware prefix; user title unchanged
// ─────────────────────────────────────────────────────────────────────────────
describe("FrictionReducerModal — localization", () => {
  const task = {
    id: "task-abc",
    title: "Write the quarterly report",
    original_title: null,
    status: "pending" as const,
    created_at: new Date().toISOString(),
    completed_at: null,
    postponed_count: 3,
    postpone_count: 0,
    user_id: "user-1",
    wish: null,
    outcome: null,
    obstacle: null,
    plan: null,
    plan_if_then: null,
    sort_order: 0,
    steps: null,
  };

  function renderModal(lang: LanguageCode) {
    return withLang(lang, (
      <FrictionReducerModal
        task={task}
        onClose={() => {}}
        onShrunk={() => {}}
        onCoworkStarted={() => {}}
      />
    ));
  }

  it("EN: generated suggestion starts with English prefix", async () => {
    const user = userEvent.setup();
    renderModal("en");
    await user.click(screen.getByTestId("button-option-shrink"));
    const input = screen.getByTestId("input-shrink-title") as HTMLInputElement;
    expect(input.value).toMatch(/^Just start:/);
  });

  it("ID: generated suggestion starts with Indonesian prefix", async () => {
    const user = userEvent.setup();
    renderModal("id");
    await user.click(screen.getByTestId("button-option-shrink"));
    const input = screen.getByTestId("input-shrink-title") as HTMLInputElement;
    expect(input.value).toMatch(/^Mulai saja:/);
  });

  it("JA: generated suggestion starts with Japanese prefix", async () => {
    const user = userEvent.setup();
    renderModal("ja");
    await user.click(screen.getByTestId("button-option-shrink"));
    const input = screen.getByTestId("input-shrink-title") as HTMLInputElement;
    expect(input.value).toMatch(/^まず始めよう：/);
  });

  it("EN: user task title words are appended verbatim", async () => {
    const user = userEvent.setup();
    renderModal("en");
    await user.click(screen.getByTestId("button-option-shrink"));
    const input = screen.getByTestId("input-shrink-title") as HTMLInputElement;
    expect(input.value).toContain("Write the quarterly report");
  });

  it("ID: user task title words are unchanged (original EN words intact)", async () => {
    const user = userEvent.setup();
    renderModal("id");
    await user.click(screen.getByTestId("button-option-shrink"));
    const input = screen.getByTestId("input-shrink-title") as HTMLInputElement;
    expect(input.value).toContain("Write the quarterly report");
  });

  it("JA: supplied user task title is NEVER translated or modified", async () => {
    const user = userEvent.setup();
    renderModal("ja");
    await user.click(screen.getByTestId("button-option-shrink"));
    const input = screen.getByTestId("input-shrink-title") as HTMLInputElement;
    expect(input.value).toContain("Write the quarterly report");
  });

  it("language change does NOT overwrite a user-edited suggestion", async () => {
    const user = userEvent.setup();
    render(
      <LanguageProvider>
        <LangSwitchButton lang="id" />
        <LangSwitchButton lang="ja" />
        <FrictionReducerModal
          task={task}
          onClose={() => {}}
          onShrunk={() => {}}
          onCoworkStarted={() => {}}
        />
      </LanguageProvider>,
    );

    await user.click(screen.getByTestId("button-option-shrink"));
    const input = screen.getByTestId("input-shrink-title") as HTMLInputElement;

    // User clears and types their own text
    await user.clear(input);
    await user.type(input, "My custom edit");
    expect(input.value).toBe("My custom edit");

    // Switch language — user's edit must be preserved
    await user.click(screen.getByTestId("switch-to-id"));
    expect(input.value).toBe("My custom edit");

    await user.click(screen.getByTestId("switch-to-ja"));
    expect(input.value).toBe("My custom edit");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. LearnPage — category filter labels
// ─────────────────────────────────────────────────────────────────────────────
describe("LearnPage — category filter labels", () => {
  async function renderLearnPage(lang: LanguageCode) {
    if (lang !== "en") localStorage.setItem("mindful_language", lang);
    const { default: LearnPage } = await import("@/pages/learn");
    return render(
      <LanguageProvider>
        <LangSwitchButton lang="id" />
        <LangSwitchButton lang="ja" />
        <LangSwitchButton lang="en" />
        <LearnPage />
      </LanguageProvider>,
    );
  }

  it("EN: filter buttons show English category names", async () => {
    await renderLearnPage("en");
    expect(screen.getByTestId("filter-procrastination").textContent).toBe("Procrastination");
    expect(screen.getByTestId("filter-anxiety").textContent).toBe("Anxiety");
    expect(screen.getByTestId("filter-cbt").textContent).toBe("CBT");
    expect(screen.getByTestId("filter-motivation").textContent).toBe("Motivation");
    expect(screen.getByTestId("filter-habits").textContent).toBe("Habits");
  });

  it("ID: filter buttons show Indonesian category names", async () => {
    await renderLearnPage("id");
    expect(screen.getByTestId("filter-procrastination").textContent).toBe("Menunda");
    expect(screen.getByTestId("filter-anxiety").textContent).toBe("Kecemasan");
    expect(screen.getByTestId("filter-motivation").textContent).toBe("Motivasi");
    expect(screen.getByTestId("filter-habits").textContent).toBe("Kebiasaan");
  });

  it("JA: filter buttons show Japanese category names", async () => {
    await renderLearnPage("ja");
    expect(screen.getByTestId("filter-procrastination").textContent).toBe("先延ばし");
    expect(screen.getByTestId("filter-anxiety").textContent).toBe("不安");
    expect(screen.getByTestId("filter-motivation").textContent).toBe("モチベーション");
    expect(screen.getByTestId("filter-habits").textContent).toBe("習慣");
  });

  it("stable category IDs: data-testid values unchanged after language switch", async () => {
    const user = userEvent.setup();
    await renderLearnPage("en");

    await user.click(screen.getByTestId("switch-to-ja"));
    expect(screen.getByTestId("filter-procrastination")).toBeTruthy();
    expect(screen.getByTestId("filter-habits")).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. LessonReader — category badge
// ─────────────────────────────────────────────────────────────────────────────
describe("LessonReader — category badge label", () => {
  const sampleLesson = {
    id: "local-proc-7",
    title: "The perfectionism trap",
    content: "Waiting until conditions are perfect is a form of avoidance.",
    category: "procrastination",
    reading_time_minutes: 2,
    sort_order: 107,
    active: true,
    created_at: "2024-01-01T00:00:00Z",
  };

  it("EN: shows English category badge", () => {
    withLang("en", <LessonReader lesson={sampleLesson} onClose={() => {}} />);
    expect(screen.getAllByText("Procrastination").length).toBeGreaterThan(0);
  });

  it("ID: shows Indonesian category badge", () => {
    withLang("id", <LessonReader lesson={sampleLesson} onClose={() => {}} />);
    expect(screen.getAllByText("Menunda").length).toBeGreaterThan(0);
  });

  it("JA: shows Japanese category badge", () => {
    withLang("ja", <LessonReader lesson={sampleLesson} onClose={() => {}} />);
    expect(screen.getAllByText("先延ばし").length).toBeGreaterThan(0);
  });

  it("switches category badge EN→ID→JA without remount", async () => {
    const user = userEvent.setup();
    render(
      <LanguageProvider>
        <LangSwitchButton lang="id" />
        <LangSwitchButton lang="ja" />
        <LangSwitchButton lang="en" />
        <LessonReader lesson={sampleLesson} onClose={() => {}} />
      </LanguageProvider>,
    );

    expect(screen.getAllByText("Procrastination").length).toBeGreaterThan(0);

    await user.click(screen.getByTestId("switch-to-id"));
    expect(screen.queryAllByText("Procrastination")).toHaveLength(0);
    expect(screen.getAllByText("Menunda").length).toBeGreaterThan(0);

    await user.click(screen.getByTestId("switch-to-ja"));
    expect(screen.queryAllByText("Menunda")).toHaveLength(0);
    expect(screen.getAllByText("先延ばし").length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Local lessons — localized title and body for all 22 lessons
// ─────────────────────────────────────────────────────────────────────────────
describe("getLocalLessons — 24 localized lessons", () => {
  it("returns exactly 24 lessons for each locale", () => {
    expect(getLocalLessons("en")).toHaveLength(24);
    expect(getLocalLessons("id")).toHaveLength(24);
    expect(getLocalLessons("ja")).toHaveLength(24);
  });

  it("lesson IDs are stable across locales", () => {
    const enIds = getLocalLessons("en").map((l) => l.id);
    const idIds = getLocalLessons("id").map((l) => l.id);
    const jaIds = getLocalLessons("ja").map((l) => l.id);
    expect(enIds).toEqual(idIds);
    expect(enIds).toEqual(jaIds);
  });

  it("sort_order is stable across locales", () => {
    const enOrders = getLocalLessons("en").map((l) => l.sort_order);
    const idOrders = getLocalLessons("id").map((l) => l.sort_order);
    const jaOrders = getLocalLessons("ja").map((l) => l.sort_order);
    expect(enOrders).toEqual(idOrders);
    expect(enOrders).toEqual(jaOrders);
  });

  it("categories are stable across locales", () => {
    const enCats = getLocalLessons("en").map((l) => l.category);
    const idCats = getLocalLessons("id").map((l) => l.category);
    const jaCats = getLocalLessons("ja").map((l) => l.category);
    expect(enCats).toEqual(idCats);
    expect(enCats).toEqual(jaCats);
  });

  it("EN: first procrastination lesson has correct title and content", () => {
    const lessons = getLocalLessons("en");
    const lesson = lessons.find((l) => l.id === "local-proc-7")!;
    expect(lesson.title).toBe("The perfectionism trap");
    expect(lesson.content).toContain("Done is better than perfect");
  });

  it("ID: first procrastination lesson has Indonesian title and content", () => {
    const lessons = getLocalLessons("id");
    const lesson = lessons.find((l) => l.id === "local-proc-7")!;
    expect(lesson.title).toBe("Jebakan perfeksionisme");
    expect(lesson.content).toContain("Selesai lebih baik daripada sempurna");
  });

  it("JA: first procrastination lesson has Japanese title and content", () => {
    const lessons = getLocalLessons("ja");
    const lesson = lessons.find((l) => l.id === "local-proc-7")!;
    expect(lesson.title).toBe("完璧主義の罠");
    expect(lesson.content).toContain("完成は完璧に勝ります");
  });

  it("ID: anxiety lesson local-anx-7 is Indonesian", () => {
    const lessons = getLocalLessons("id");
    const lesson = lessons.find((l) => l.id === "local-anx-7")!;
    expect(lesson.title).toBe("Jendela kekhawatiran");
    expect(lesson.content).toContain("15 menit");
  });

  it("JA: anxiety lesson local-anx-7 is Japanese", () => {
    const lessons = getLocalLessons("ja");
    const lesson = lessons.find((l) => l.id === "local-anx-7")!;
    expect(lesson.title).toBe("心配ウィンドウ");
    expect(lesson.content).toContain("15分");
  });

  it("ID: CBT lesson local-cbt-7 is Indonesian", () => {
    const lessons = getLocalLessons("id");
    const lesson = lessons.find((l) => l.id === "local-cbt-7")!;
    expect(lesson.title).toBe("Pemikiran semua atau tidak sama sekali");
    expect(lesson.content).toContain("abu-abu");
  });

  it("JA: habits lesson local-hab-8 is Japanese", () => {
    const lessons = getLocalLessons("ja");
    const lesson = lessons.find((l) => l.id === "local-hab-8")!;
    expect(lesson.title).toBe("複利効果");
    expect(lesson.content).toContain("37倍");
  });

  it("EN: motivation lesson local-mot-5 correct content", () => {
    const lessons = getLocalLessons("en");
    const lesson = lessons.find((l) => l.id === "local-mot-5")!;
    expect(lesson.title).toBe("Motivation follows action");
    expect(lesson.content).toContain("behavioral activation");
  });

  it("ID: motivation lesson local-mot-5 is Indonesian", () => {
    const lessons = getLocalLessons("id");
    const lesson = lessons.find((l) => l.id === "local-mot-5")!;
    expect(lesson.title).toBe("Motivasi mengikuti tindakan");
    expect(lesson.content).toContain("aktivasi perilaku");
  });

  it("JA: motivation lesson local-mot-5 is Japanese", () => {
    const lessons = getLocalLessons("ja");
    const lesson = lessons.find((l) => l.id === "local-mot-5")!;
    expect(lesson.title).toBe("行動が動機を生む");
    expect(lesson.content).toContain("行動活性化");
  });

  it("all 24 lesson IDs are present in each locale", () => {
    // All 24 lesson IDs (6 proc + 6 anx + 4 cbt + 4 mot + 4 hab)
    const expectedIds = [
      "local-proc-7", "local-proc-8", "local-proc-9", "local-proc-10",
      "local-proc-11", "local-proc-12",
      "local-anx-7",  "local-anx-8",  "local-anx-9",  "local-anx-10",
      "local-anx-11", "local-anx-12",
      "local-cbt-7",  "local-cbt-8",  "local-cbt-9",  "local-cbt-10",
      "local-mot-5",  "local-mot-6",  "local-mot-7",  "local-mot-8",
      "local-hab-5",  "local-hab-6",  "local-hab-7",  "local-hab-8",
    ];
    for (const lang of ["en", "id", "ja"] as LanguageCode[]) {
      const ids = getLocalLessons(lang).map((l) => l.id);
      for (const id of expectedIds) {
        expect(ids, `${lang} should contain ${id}`).toContain(id);
      }
    }
  });

  it("all lessons have non-empty localized titles and content for all locales", () => {
    for (const lang of ["en", "id", "ja"] as LanguageCode[]) {
      const lessons = getLocalLessons(lang);
      for (const lesson of lessons) {
        expect(lesson.title.length, `${lang}/${lesson.id} title`).toBeGreaterThan(0);
        expect(lesson.content.length, `${lang}/${lesson.id} content`).toBeGreaterThan(0);
      }
    }
  });
});
