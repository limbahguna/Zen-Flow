/**
 * Unit tests for translations.ts pure functions.
 *
 * Scope: EN / ID / JA launch languages only.
 * ES / DE / AR / ZH are retired and must NOT appear in SUPPORTED_LANGUAGES.
 *
 * Run:  pnpm --filter @workspace/mindful-productivity run test
 *
 * No React rendering needed — all functions are pure (localStorage or
 * document globals are faked via jsdom environment in vitest.config.ts).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getTranslationKeys,
  t,
  isRTL,
  getStoredLanguage,
  SUPPORTED_LANGUAGES,
  LANGUAGE_OPTIONS,
  type LanguageCode,
} from "./translations";

// ── 1. t() — translation lookup ───────────────────────────────────────────────
describe("t() — translation lookup", () => {
  it("returns English string for en", () => {
    expect(t("en", "nav.home")).toBe("Home");
  });

  it("returns Indonesian string for id", () => {
    expect(t("id", "nav.home")).toBe("Beranda");
  });

  it("returns Japanese string for ja", () => {
    expect(t("ja", "nav.home")).toBe("ホーム");
  });

  it("falls back to English when key is missing in target language", () => {
    // profile.version is in en; if missing in id, falls back to en value
    const result = t("id", "profile.version");
    expect(result).toBe("Mindful Space v1.0");
  });

  it("returns the key itself when not found in any language", () => {
    expect(t("en", "nonexistent.key.xyz")).toBe("nonexistent.key.xyz");
  });

  it("returns Indonesian greeting for each time of day", () => {
    expect(t("id", "dashboard.greeting.morning")).toBe("Selamat pagi");
    expect(t("id", "dashboard.greeting.afternoon")).toBe("Selamat siang");
    expect(t("id", "dashboard.greeting.evening")).toBe("Selamat malam");
  });

  it("returns Indonesian practice tab labels", () => {
    expect(t("id", "practice.tab.intentions")).toBe("Niat");
    expect(t("id", "practice.tab.journal")).toBe("Jurnal");
    expect(t("id", "practice.tab.lessons")).toBe("Pelajaran");
  });

  it("uses Daily Insight terminology for the dashboard lesson label", () => {
    expect(t("en", "dashboard.quickActions.lessons")).toBe("Daily Insight");
    expect(t("id", "dashboard.quickActions.lessons")).toBe("Wawasan Harian");
    expect(t("ja", "dashboard.quickActions.lessons")).toBe("デイリーインサイト");
  });

  it("returns Indonesian coach strings", () => {
    expect(t("id", "coach.placeholder")).toBe("Ceritakan apa yang ada di pikiranmu…");
    expect(t("id", "coach.emptyTitle")).toBe("Teman mindful-mu");
    expect(t("id", "coach.error.limit")).toContain("10 pesan AI Coach");
  });

  it("returns Indonesian profile strings", () => {
    expect(t("id", "profile.signOut")).toBe("Keluar");
    expect(t("id", "profile.language")).toBe("Bahasa");
    expect(t("id", "profile.languageSubtitle")).toBe("Bahasa pelatih dan konten");
  });

  it("returns Japanese nav labels", () => {
    expect(t("ja", "nav.home")).toBe("ホーム");
    expect(t("ja", "nav.practice")).toBe("練習");
    expect(t("ja", "nav.coach")).toBe("コンパニオン");
    expect(t("ja", "nav.profile")).toBe("プロフィール");
  });

  it("returns Japanese greetings", () => {
    expect(t("ja", "dashboard.greeting.morning")).toBe("おはようございます");
    expect(t("ja", "dashboard.greeting.afternoon")).toBe("こんにちは");
    expect(t("ja", "dashboard.greeting.evening")).toBe("こんばんは");
  });
});

// ── 1b. Journal questions 3-5 — everyday wording, no clinical jargon ─────────
// These questions previously read as literal translations of CBT worksheet
// language. They must stay understandable without any therapy background.
describe("journal questions 3-5 — Indonesian", () => {
  it("asks question 3 conversationally instead of asking for evidence", () => {
    expect(t("id", "journal.form.step3.label")).toBe(
      "Apa yang membuatmu berpikir begitu?",
    );
    expect(t("id", "journal.form.step3.placeholder")).toBe(
      "Tuliskan alasan atau kejadian yang membuatmu berpikir seperti ini...",
    );
  });

  it("asks question 4 without the confrontational 'bertentangan' framing", () => {
    expect(t("id", "journal.form.step4.label")).toBe(
      "Apakah ada fakta atau pengalaman yang menunjukkan hal berbeda?",
    );
    expect(t("id", "journal.form.step4.placeholder")).toBe(
      "Adakah hal yang menunjukkan bahwa pikiran ini tidak sepenuhnya benar?",
    );
  });

  it("invites a balanced view in question 5 instead of naming a concept", () => {
    expect(t("id", "journal.form.step5.label")).toBe(
      "Coba lihat situasi ini dengan cara yang lebih seimbang",
    );
    expect(t("id", "journal.form.step5.placeholder")).toBe(
      "Jika melihat situasi ini dengan lebih tenang dan realistis, bagaimana kamu akan menuliskannya?",
    );
  });

  it("drops legal-sounding 'bukti' and CBT jargon from the flow", () => {
    for (const key of [
      "journal.form.step3.label",
      "journal.form.step3.placeholder",
      "journal.form.step4.label",
      "journal.form.step4.placeholder",
      "journal.form.step5.label",
      "journal.form.step5.placeholder",
      "journal.form.done.mood.improved",
    ]) {
      expect(t("id", key)).not.toContain("Bukti");
      expect(t("id", key)).not.toContain("bukti");
      expect(t("id", key)).not.toContain("bertentangan");
      expect(t("id", key)).not.toContain("CBT");
      expect(t("id", key)).not.toContain("reformulasi");
    }
  });
});

describe("journal questions 3-5 — Japanese", () => {
  it("asks question 3 in everyday Japanese", () => {
    expect(t("ja", "journal.form.step3.label")).toBe(
      "そう思うきっかけになったことは何ですか？",
    );
    expect(t("ja", "journal.form.step3.placeholder")).toBe(
      "そう考えた理由や、実際に起きたことを書いてみましょう...",
    );
  });

  it("asks question 4 softly instead of using 反する", () => {
    expect(t("ja", "journal.form.step4.label")).toBe(
      "その考えとは違う事実や経験はありますか？",
    );
    expect(t("ja", "journal.form.step4.placeholder")).toBe(
      "この考えとは違う事実や経験を書いてみましょう...",
    );
  });

  it("invites another perspective in question 5 without commanding the user", () => {
    expect(t("ja", "journal.form.step5.label")).toBe("別の見方を考えてみましょう");
    expect(t("ja", "journal.form.step5.placeholder")).toBe(
      "この状況を、もう少し現実的に捉えるとどうなりますか？",
    );
  });

  it("drops 証拠, 反する and CBT wording from the flow", () => {
    for (const key of [
      "journal.form.step3.label",
      "journal.form.step3.placeholder",
      "journal.form.step4.label",
      "journal.form.step4.placeholder",
      "journal.form.step5.label",
      "journal.form.step5.placeholder",
      "journal.form.done.mood.improved",
    ]) {
      expect(t("ja", key)).not.toContain("証拠");
      expect(t("ja", key)).not.toContain("反する");
      expect(t("ja", key)).not.toContain("CBT");
      expect(t("ja", key)).not.toContain("再構成");
    }
  });

  it("keeps 書き直してください out of question 5", () => {
    expect(t("ja", "journal.form.step5.placeholder")).not.toContain("書き直してください");
  });
});

// ── 1c. Journal UX strings exist in every launch language ────────────────────
describe("journal UX strings — EN / ID / JA", () => {
  const uxKeys = [
    "journal.form.progress",
    "journal.form.required",
    "journal.form.validation.title",
    "journal.form.validation.body",
    "journal.form.draft.restored",
    "journal.form.draft.discard",
    "journal.form.draft.confirm",
    "journal.form.draft.confirmYes",
    "journal.form.draft.confirmNo",
    "journal.form.done.title",
    "journal.form.done.answered.all",
    "journal.form.done.answered.partial",
    "journal.form.done.mood",
    "journal.form.done.mood.improved",
    "journal.form.done.mood.same",
    "journal.form.done.mood.lower",
    "journal.form.done.next",
    "journal.form.done.cta",
    "journal.detail.title",
    "journal.detail.close",
    "journal.detail.open",
    "journal.detail.unanswered",
    "journal.detail.summary.title",
    "journal.detail.summary.saved",
    "journal.detail.summary.changeUp",
    "journal.detail.summary.changeDown",
    "journal.detail.summary.changeSame",
    "journal.detail.summary.moodMissing",
    "journal.detail.summary.perspectiveLabel",
    "journal.detail.summary.perspectiveMissing",
    "journal.detail.summary.next",
    "journal.detail.summary.createIntention",
    "journal.patterns.moodUp",
    "journal.patterns.moodDown",
    "journal.patterns.moodSame",
    "journal.patterns.streakNone",
  ];

  it("resolves every new key in all three languages", () => {
    for (const lang of ["en", "id", "ja"] as LanguageCode[]) {
      for (const key of uxKeys) {
        const value = t(lang, key);
        expect(value).not.toBe(key);
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps the {current}/{total} placeholders in the progress label", () => {
    for (const lang of ["en", "id", "ja"] as LanguageCode[]) {
      expect(t(lang, "journal.form.progress")).toContain("{current}");
      expect(t(lang, "journal.form.progress")).toContain("{total}");
    }
  });

  it("keeps the {fields} placeholder in the validation message", () => {
    for (const lang of ["en", "id", "ja"] as LanguageCode[]) {
      expect(t(lang, "journal.form.validation.body")).toContain("{fields}");
    }
  });

  it("keeps the count placeholders in both answered-count messages", () => {
    for (const lang of ["en", "id", "ja"] as LanguageCode[]) {
      expect(t(lang, "journal.form.done.answered.all")).toContain("{total}");
      const partial = t(lang, "journal.form.done.answered.partial");
      expect(partial).toContain("{answered}");
      expect(partial).toContain("{total}");
      expect(partial).toContain("{skipped}");
    }
  });
});

// ── 1d. No therapy or technical vocabulary anywhere in the Journal ───────────
// The Journal is a general wellness surface: a user with no therapy background
// must be able to read every string in it.
describe("journal vocabulary sweep — every journal.* key", () => {
  const banned: Record<LanguageCode, string[]> = {
    en: ["reframe", "reframing", "cbt", "cognitive", "restructur", "reformulation", "evidence", "distortion"],
    id: ["reformulasi", "bukti", "bertentangan", "cbt", "kognitif", "restrukturisasi"],
    ja: ["リフレーム", "再構成", "証拠", "反する", "CBT", "認知行動", "再構築"],
  };

  for (const lang of ["en", "id", "ja"] as LanguageCode[]) {
    it(`keeps ${lang} journal strings free of clinical vocabulary`, () => {
      const journalKeys = getTranslationKeys(lang).filter((key) => key.startsWith("journal."));
      expect(journalKeys.length).toBeGreaterThan(30);

      for (const key of journalKeys) {
        const value = lang === "ja" ? t(lang, key) : t(lang, key).toLowerCase();
        for (const term of banned[lang]) {
          expect(value, `${lang} / ${key}`).not.toContain(term);
        }
      }
    });
  }
});

// ── 1e. Pattern insights: direction-aware mood, natural streak wording ───────
describe("journal pattern insights — EN / ID / JA", () => {
  it("no longer exposes the old afterReframe or afterReflection keys", () => {
    for (const lang of ["en", "id", "ja"] as LanguageCode[]) {
      const keys = getTranslationKeys(lang);
      expect(keys).not.toContain("journal.patterns.afterReframe");
      expect(keys).not.toContain("journal.patterns.afterReflection");
      expect(keys).not.toContain("journal.patterns.avgShift");
    }
  });

  it("names a rising average as an improvement", () => {
    expect(t("en", "journal.patterns.moodUp")).toBe("Average mood improved by {value} points");
    expect(t("id", "journal.patterns.moodUp")).toBe("Rata-rata suasana hati naik {value} poin");
    expect(t("ja", "journal.patterns.moodUp")).toBe("平均して気分が{value}ポイント上がりました");
  });

  it("names a falling average as a decrease, never an improvement", () => {
    expect(t("en", "journal.patterns.moodDown")).toBe("Average mood decreased by {value} points");
    expect(t("id", "journal.patterns.moodDown")).toBe("Rata-rata suasana hati turun {value} poin");
    expect(t("ja", "journal.patterns.moodDown")).toBe("平均して気分が{value}ポイント下がりました");

    expect(t("en", "journal.patterns.moodDown").toLowerCase()).not.toContain("improved");
    expect(t("id", "journal.patterns.moodDown")).not.toContain("naik");
    expect(t("ja", "journal.patterns.moodDown")).not.toContain("上がり");
  });

  it("uses neutral wording when the average is unchanged", () => {
    expect(t("en", "journal.patterns.moodSame")).toBe("Average mood stayed the same");
    expect(t("id", "journal.patterns.moodSame")).toBe("Rata-rata suasana hati tetap sama");
    expect(t("ja", "journal.patterns.moodSame")).toBe("気分は変わりませんでした");
  });

  it("keeps the {value} placeholder only where a number is shown", () => {
    for (const lang of ["en", "id", "ja"] as LanguageCode[]) {
      expect(t(lang, "journal.patterns.moodUp")).toContain("{value}");
      expect(t(lang, "journal.patterns.moodDown")).toContain("{value}");
      expect(t(lang, "journal.patterns.moodSame")).not.toContain("{value}");
    }
  });

  it("localizes the streak line instead of borrowing English words", () => {
    expect(t("en", "journal.patterns.streak")).toBe("{count} days in a row");
    expect(t("id", "journal.patterns.streak")).toBe("Menulis {count} hari berturut-turut");
    expect(t("ja", "journal.patterns.streak")).toBe("{count}日続けて書いています");
    expect(t("id", "journal.patterns.streak")).not.toContain("Streak");
    expect(t("ja", "journal.patterns.streak")).not.toContain("ストリーク");
  });

  it("reads naturally when there is no streak yet", () => {
    expect(t("en", "journal.patterns.streakNone")).toBe("No consecutive days yet");
    expect(t("id", "journal.patterns.streakNone")).toBe("Belum ada catatan berturut-turut");
    expect(t("ja", "journal.patterns.streakNone")).toBe("まだ連続記録はありません");

    for (const lang of ["en", "id", "ja"] as LanguageCode[]) {
      expect(t(lang, "journal.patterns.streakNone")).not.toContain("0");
      expect(t(lang, "journal.patterns.streakNone")).not.toContain("{count}");
    }
  });

  it("uses natural phrasing for the patterns heading and entry count", () => {
    expect(t("id", "journal.patterns.label")).toBe("Yang mulai terlihat");
    expect(t("ja", "journal.patterns.label")).toBe("見えてきたこと");
    expect(t("id", "journal.patterns.entries")).toBe("Kamu sudah menulis {count} entri");
    expect(t("ja", "journal.patterns.entries")).toBe("これまでに{count}件書きました");
    expect(t("ja", "journal.patterns.entries")).not.toContain("ジャーナルエントリ");
  });

  it("keeps the {count} placeholder in every counted pattern line", () => {
    for (const lang of ["en", "id", "ja"] as LanguageCode[]) {
      expect(t(lang, "journal.patterns.entries")).toContain("{count}");
      expect(t(lang, "journal.patterns.streak")).toContain("{count}");
    }
  });
});

// ── 1e-2. Question 4 reads plainly in English ────────────────────────────────
describe("journal question 4 — English", () => {
  it("asks whether anything suggests otherwise", () => {
    expect(t("en", "journal.form.step4.label")).toBe("Is there anything that suggests otherwise?");
  });

  it("leaves the approved Indonesian and Japanese wording untouched", () => {
    expect(t("id", "journal.form.step4.label")).toBe(
      "Apakah ada fakta atau pengalaman yang menunjukkan hal berbeda?",
    );
    expect(t("ja", "journal.form.step4.label")).toBe("その考えとは違う事実や経験はありますか？");
  });
});

// ── 1e-3. Weekly Report insight sentences exist in all launch languages ──────
describe("weekly report localization — EN / ID / JA", () => {
  const weeklyKeys = [
    "weekly.insight.anxietyDown",
    "weekly.insight.intentions",
    "weekly.insight.journalMood",
    "weekly.insight.streak",
    "weekly.insight.breathing",
    "weekly.insight.default",
    "weekly.eyebrow",
    "weekly.dismiss",
    "weekly.seeReport",
    "weekly.showLess",
    "weekly.stat.anxietyTrend",
    "weekly.stat.steady",
    "weekly.stat.intentions",
    "weekly.stat.completionRate",
    "weekly.stat.journal",
    "weekly.stat.moodShift",
    "weekly.stat.breathing",
    "weekly.streak",
    "weekly.streakReal",
    "weekly.streakKeep",
  ];

  it("resolves every weekly key in all three languages", () => {
    for (const lang of ["en", "id", "ja"] as LanguageCode[]) {
      for (const key of weeklyKeys) {
        const value = t(lang, key);
        expect(value, `${lang} / ${key}`).not.toBe(key);
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });

  it("translates the insight sentences rather than leaving them in English", () => {
    for (const key of weeklyKeys) {
      expect(t("id", key), `id / ${key}`).not.toBe(t("en", key));
      expect(t("ja", key), `ja / ${key}`).not.toBe(t("en", key));
    }
  });

  it("fills insight placeholders with the supplied values", () => {
    expect(t("en", "weekly.insight.journalMood", { value: "1.5" })).toContain("1.5");
    expect(t("id", "weekly.insight.streak", { count: 4 })).toContain("4");
    expect(t("ja", "weekly.insight.breathing", { count: 5 })).toContain("5");
    expect(t("en", "weekly.insight.intentions", { rate: 75 })).toContain("75%");
  });

  it("leaves no {placeholder} behind once values are applied", () => {
    const filled = [
      t("en", "weekly.insight.anxietyDown", { value: "2.0" }),
      t("id", "weekly.insight.journalMood", { value: "1.2" }),
      t("ja", "weekly.insight.intentions", { rate: 80 }),
      t("ja", "weekly.stat.completionRate", { rate: 80 }),
      t("id", "weekly.streak", { n: 3 }),
    ];
    for (const text of filled) {
      expect(text).not.toMatch(/\{\w+\}/);
    }
  });

  it("does not hardcode a plus sign in the mood shift label", () => {
    for (const lang of ["en", "id", "ja"] as LanguageCode[]) {
      expect(t(lang, "weekly.stat.moodShift")).not.toContain("+");
      expect(t(lang, "weekly.stat.moodShift")).toContain("{shift}");
    }
  });

  it("uses the app's own vocabulary for intentions and journal in Japanese", () => {
    expect(t("ja", "weekly.stat.intentions")).toBe("目標");
    expect(t("ja", "weekly.stat.journal")).toBe("ジャーナルの記録");
    expect(t("id", "weekly.streak")).not.toContain("Streak");
  });
});

// ── 1f. Mood messages match "higher score = better mood" ─────────────────────
describe("journal completion mood messages — EN / ID / JA", () => {
  it("describes a higher score as possibly feeling better, without promising it", () => {
    expect(t("en", "journal.form.done.mood.improved")).toBe(
      "You may be feeling a little better after reflecting.",
    );
    expect(t("id", "journal.form.done.mood.improved")).toBe(
      "Kamu mungkin merasa sedikit lebih baik setelah refleksi.",
    );
    expect(t("ja", "journal.form.done.mood.improved")).toBe(
      "振り返りの後、少し気持ちが楽になったかもしれません。",
    );
  });

  it("reassures the user when the score is unchanged", () => {
    expect(t("en", "journal.form.done.mood.same")).toBe(
      "It is okay if your feelings have not changed yet.",
    );
    expect(t("id", "journal.form.done.mood.same")).toBe(
      "Tidak apa-apa jika perasaanmu belum berubah.",
    );
    expect(t("ja", "journal.form.done.mood.same")).toBe("まだ気持ちが変わらなくても大丈夫です。");
  });

  it("never calls a lower score an improvement", () => {
    expect(t("en", "journal.form.done.mood.lower")).toBe(
      "It may still feel difficult. Try taking one small step.",
    );
    expect(t("id", "journal.form.done.mood.lower")).toBe(
      "Mungkin masih terasa berat. Coba lakukan satu langkah kecil.",
    );
    expect(t("ja", "journal.form.done.mood.lower")).toBe(
      "まだつらく感じるかもしれません。まずは小さな一歩を試してみましょう。",
    );

    expect(t("en", "journal.form.done.mood.lower").toLowerCase()).not.toContain("better");
    expect(t("en", "journal.form.done.mood.lower").toLowerCase()).not.toContain("improve");
    expect(t("id", "journal.form.done.mood.lower")).not.toContain("lebih baik");
    expect(t("ja", "journal.form.done.mood.lower")).not.toContain("楽になった");

    expect(t("en", "journal.detail.summary.title")).toBe("Reflection summary");
    expect(t("id", "journal.detail.summary.title")).toBe("Ringkasan refleksi");
    expect(t("ja", "journal.detail.summary.title")).toBe("振り返りのまとめ");
    expect(t("en", "journal.detail.summary.createIntention")).toBe("Create an intention");
    expect(t("id", "journal.detail.summary.createIntention")).toBe("Buat Niat");
    expect(t("ja", "journal.detail.summary.createIntention")).toBe("目標を作る");
    expect(t("en", "journal.detail.summary.changeUp")).toContain("{value}");
    expect(t("en", "journal.detail.summary.changeDown")).not.toContain("-");
  });
});

// ── 1g. Deleting and privacy copy describes the Journal in plain words ───────
describe("Japanese Practice labels", () => {
  const practiceKeys = [
    "practice.title",
    "practice.subtitle",
    "practice.tab.intentions",
    "practice.tab.journal",
    "practice.tab.lessons",
  ];

  it("uses familiar wording for the Practice section", () => {
    expect(t("ja", "practice.tab.intentions")).toBe("目標");
    expect(t("ja", "practice.subtitle")).toBe("目標、振り返り、成長のための空間");
    expect(t("ja", "practice.tab.journal")).toBe("ジャーナル");
    expect(t("ja", "practice.tab.lessons")).toBe("レッスン");
    expect(t("ja", "journal.newEntry")).toBe("新しい記録");
    expect(t("ja", "journal.form.title")).toBe("新しい記録");
    expect(t("ja", "journal.empty.cta")).toBe("最初の記録を書く");
    expect(t("ja", "journal.detail.summary.createIntention")).toBe("目標を作る");
  });

  it("keeps English and Indonesian Practice labels unchanged", () => {
    expect(t("en", "practice.tab.intentions")).toBe("Intentions");
    expect(t("id", "practice.tab.intentions")).toBe("Niat");
    expect(t("en", "journal.newEntry")).toBe("New Entry");
    expect(t("id", "journal.form.title")).toBe("Entri Baru");
  });

  it("drops imported wording from Practice and Journal labels", () => {
    const keys = getTranslationKeys("ja").filter(
      (key) => practiceKeys.includes(key) || key.startsWith("journal."),
    );
    for (const key of keys) {
      const value = t("ja", key);
      expect(value, key).not.toContain("インテンション");
      expect(value, key).not.toContain("新しいエントリ");
      expect(value, key).not.toContain("内省");
    }
  });
});

describe("Indonesian and Japanese copy consistency", () => {
  it("uses conversational Indonesian for programs, insights, and intention review", () => {
    expect(t("id", "programs.page.subtitle")).toBe(
      "Pilih program singkat yang terstruktur. Fokus pada satu program dalam satu waktu.",
    );
    expect(t("id", "programs.calmReset.benefit")).toBe(
      "Latihan harian yang lembut untuk membantu menenangkan tubuh dan pikiran.",
    );
    expect(t("id", "programs.focusHabit.benefit")).toBe(
      "Latihan fokus dan gerakan singkat untuk membantu membangun kebiasaan secara bertahap.",
    );
    expect(t("id", "dailyInsight.reason.available")).toBe("Dipilih dari wawasan hari ini");
    expect(t("id", "dashboard.challenge.20.title")).toBe("Lihat kembali niatmu");
    expect(t("id", "dashboard.challenge.20.desc")).toContain("Hargai kemajuanmu");
    expect(t("id", "programs.page.subtitle")).not.toContain("jalur");
    expect(t("id", "programs.focusHabit.benefit")).not.toContain("ajeg");
  });

  it("uses 目標 for the intention feature and 記録 for journal entries in Japanese", () => {
    expect(t("ja", "dashboard.intentionModal.title")).toBe("目標を設定");
    expect(t("ja", "dashboard.challenge.20.title")).toBe("目標の振り返り");
    expect(t("ja", "tasks.empty.cta")).toBe("最初の目標を立てる");
    expect(t("ja", "profile.stat.entries")).toBe("ジャーナルの記録");
    expect(t("ja", "delete.confirm.step1.body")).toContain("ジャーナルの記録");
    expect(t("ja", "delete.confirm.step1.body")).toContain("目標");
    expect(t("ja", "sleep.hub.subtitle")).toContain("振り返り");
    expect(t("ja", "sleep.hub.subtitle")).not.toContain("内省");
    expect(t("ja", "privacy.children.body")).toContain("意図的に");
  });

  it("keeps imported Japanese terms out of user-facing labels", () => {
    for (const key of getTranslationKeys("ja")) {
      const value = t("ja", key);
      expect(value, key).not.toContain("インテンション");
      expect(value, key).not.toContain("新しいエントリ");
      expect(value, key).not.toContain("ジャーナルエントリ");
    }
  });
});

// ── 1g. Deleting and privacy copy describes the Journal in plain words ───────
describe("journal data descriptions", () => {
  it("lists journal contents without worksheet vocabulary", () => {
    expect(t("en", "delete.item.journal")).toBe("All journal entries and reflections");
    expect(t("id", "delete.item.journal")).toBe("Semua entri jurnal dan refleksi");
    expect(t("ja", "delete.item.journal")).toBe("すべてのジャーナルの記録と振り返り");

    expect(t("en", "privacy.collect.journal").toLowerCase()).not.toContain("evidence");
    expect(t("id", "privacy.collect.journal")).not.toContain("bukti");
    expect(t("ja", "privacy.collect.journal")).not.toContain("証拠");
    expect(t("ja", "privacy.collect.journal")).not.toContain("再構成");
  });
});

// ── 2. isRTL() — all launch languages are LTR ─────────────────────────────────
describe("isRTL()", () => {
  it("returns false for all EN/ID/JA launch languages", () => {
    const ltr: LanguageCode[] = ["en", "id", "ja"];
    for (const lang of ltr) {
      expect(isRTL(lang)).toBe(false);
    }
  });
});

// ── 3. SUPPORTED_LANGUAGES allowlist — only en/id/ja ─────────────────────────
describe("SUPPORTED_LANGUAGES", () => {
  it("contains exactly the 3 launch language codes: en, id, ja", () => {
    const codes = Object.keys(SUPPORTED_LANGUAGES).sort();
    expect(codes).toEqual(["en", "id", "ja"]);
  });

  it("does NOT contain retired codes es, de, ar, zh", () => {
    const codes = Object.keys(SUPPORTED_LANGUAGES);
    expect(codes).not.toContain("es");
    expect(codes).not.toContain("de");
    expect(codes).not.toContain("ar");
    expect(codes).not.toContain("zh");
  });

  it("maps each code to a non-empty display name", () => {
    for (const [, name] of Object.entries(SUPPORTED_LANGUAGES)) {
      expect(typeof name).toBe("string");
      expect(name.length).toBeGreaterThan(0);
    }
  });
});

// ── 4. LANGUAGE_OPTIONS selector — only en/id/ja selectable ──────────────────
describe("LANGUAGE_OPTIONS", () => {
  it("contains exactly 3 options", () => {
    expect(LANGUAGE_OPTIONS).toHaveLength(3);
  });

  it("option codes are exactly en, id, ja", () => {
    const codes = LANGUAGE_OPTIONS.map((o) => o.code).sort();
    expect(codes).toEqual(["en", "id", "ja"]);
  });

  it("does NOT contain es, de, ar, zh as selectable options", () => {
    const codes = LANGUAGE_OPTIONS.map((o) => o.code);
    expect(codes).not.toContain("es");
    expect(codes).not.toContain("de");
    expect(codes).not.toContain("ar");
    expect(codes).not.toContain("zh");
  });

  it("each option has a non-empty flag and label", () => {
    for (const option of LANGUAGE_OPTIONS) {
      expect(option.flag.length).toBeGreaterThan(0);
      expect(option.label.length).toBeGreaterThan(0);
    }
  });
});

// ── 5. getStoredLanguage() — localStorage persistence ────────────────────────
describe("getStoredLanguage()", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("returns 'en' when nothing is stored", () => {
    expect(getStoredLanguage()).toBe("en");
  });

  it("returns stored 'id' when stored", () => {
    localStorage.setItem("mindful_language", "id");
    expect(getStoredLanguage()).toBe("id");
  });

  it("returns stored 'ja' when stored", () => {
    localStorage.setItem("mindful_language", "ja");
    expect(getStoredLanguage()).toBe("ja");
  });

  it("returns 'en' when stored value is not in SUPPORTED_LANGUAGES (unknown 'xx')", () => {
    localStorage.setItem("mindful_language", "xx");
    expect(getStoredLanguage()).toBe("en");
  });

  it("normalizes legacy 'es' to 'en' and persists normalization", () => {
    localStorage.setItem("mindful_language", "es");
    expect(getStoredLanguage()).toBe("en");
    // After normalization the key must be overwritten to 'en'
    expect(localStorage.getItem("mindful_language")).toBe("en");
  });

  it("normalizes legacy 'de' to 'en' and persists normalization", () => {
    localStorage.setItem("mindful_language", "de");
    expect(getStoredLanguage()).toBe("en");
    expect(localStorage.getItem("mindful_language")).toBe("en");
  });

  it("normalizes legacy 'ar' to 'en' and persists normalization", () => {
    localStorage.setItem("mindful_language", "ar");
    expect(getStoredLanguage()).toBe("en");
    expect(localStorage.getItem("mindful_language")).toBe("en");
  });

  it("normalizes legacy 'zh' to 'en' and persists normalization", () => {
    localStorage.setItem("mindful_language", "zh");
    expect(getStoredLanguage()).toBe("en");
    expect(localStorage.getItem("mindful_language")).toBe("en");
  });

  it("returns 'en' when stored value is empty string", () => {
    localStorage.setItem("mindful_language", "");
    expect(getStoredLanguage()).toBe("en");
  });

  it("stores all 3 supported language codes correctly", () => {
    const codes: LanguageCode[] = ["en", "id", "ja"];
    for (const code of codes) {
      localStorage.setItem("mindful_language", code);
      expect(getStoredLanguage()).toBe(code);
    }
  });

  it("detects Indonesian from the browser when no preference is stored", () => {
    Object.defineProperty(window.navigator, "language", {
      configurable: true,
      value: "id-ID",
    });
    expect(getStoredLanguage()).toBe("id");
    expect(localStorage.getItem("mindful_language")).toBe("id");
  });

  it("detects Japanese from the browser when no preference is stored", () => {
    Object.defineProperty(window.navigator, "language", {
      configurable: true,
      value: "ja-JP",
    });
    expect(getStoredLanguage()).toBe("ja");
    expect(localStorage.getItem("mindful_language")).toBe("ja");
  });
});

// ── 6. Translation key parity across EN / ID / JA ────────────────────────────
describe("translation key parity — EN / ID / JA", () => {
  const englishKeys = getTranslationKeys("en").sort();

  it("uses exactly the same key set for Indonesian", () => {
    expect(getTranslationKeys("id").sort()).toEqual(englishKeys);
  });

  it("uses exactly the same key set for Japanese", () => {
    expect(getTranslationKeys("ja").sort()).toEqual(englishKeys);
  });
});

// ── 7. HTML language direction — always LTR for launch scope ─────────────────
describe("document RTL side-effect", () => {
  it("isRTL returns false for all EN/ID/JA — HTML stays LTR", () => {
    expect(isRTL("en")).toBe(false);
    expect(isRTL("id")).toBe(false);
    expect(isRTL("ja")).toBe(false);
  });
});
