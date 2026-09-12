import { useState } from "react";
import { X } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import type { Intention, IntentionInput, ReminderChoice, IntentionFrequency } from "@/lib/intentions";

const COPY = {
  en: {
    title: "Intention title", why: "Why it matters (optional)", action: "Today's small action",
    reminder: "Reminder", off: "Off", morning: "Morning", evening: "Evening", custom: "Custom time",
    frequency: "Frequency", once: "Once", daily: "Daily", days: "Selected days",
    save: "Save intention", close: "Close", dayNames: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  },
  id: {
    title: "Judul niat", why: "Mengapa ini penting (opsional)", action: "Langkah kecil hari ini",
    reminder: "Pengingat", off: "Mati", morning: "Pagi", evening: "Malam", custom: "Waktu khusus",
    frequency: "Frekuensi", once: "Sekali", daily: "Setiap hari", days: "Hari pilihan",
    save: "Simpan niat", close: "Tutup", dayNames: ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"],
  },
  ja: {
    title: "インテンションのタイトル", why: "大切な理由（任意）", action: "今日の小さな一歩",
    reminder: "リマインダー", off: "オフ", morning: "朝", evening: "夜", custom: "時刻を指定",
    frequency: "頻度", once: "1回", daily: "毎日", days: "曜日を選択",
    save: "インテンションを保存", close: "閉じる", dayNames: ["日", "月", "火", "水", "木", "金", "土"],
  },
};

function defaultAction(title: string) {
  const clean = title.trim().replace(/^(i want to|i will|saya ingin|aku ingin)\s+/i, "");
  return clean ? `Spend 10 minutes on ${clean.charAt(0).toLowerCase()}${clean.slice(1)}` : "";
}

export function IntentionForm({
  initial,
  seedTitle = "",
  onClose,
  onSave,
  saving,
}: {
  initial?: Intention;
  seedTitle?: string;
  onClose: () => void;
  onSave: (input: IntentionInput) => Promise<void>;
  saving?: boolean;
}) {
  const { language } = useLanguage();
  const c = COPY[language];
  const [title, setTitle] = useState(initial?.title ?? seedTitle);
  const [why, setWhy] = useState(initial?.why_it_matters ?? "");
  const [action, setAction] = useState(initial?.small_action ?? defaultAction(seedTitle));
  const [choice, setChoice] = useState<ReminderChoice>(initial?.reminder_choice ?? "off");
  const [time, setTime] = useState(initial?.reminder_time?.slice(0, 5) ?? "09:00");
  const [frequency, setFrequency] = useState<IntentionFrequency>(initial?.frequency ?? "once");
  const [days, setDays] = useState<number[]>(initial?.selected_days ?? []);

  function changeChoice(next: ReminderChoice) {
    setChoice(next);
    if (next === "morning") setTime("09:00");
    if (next === "evening") setTime("19:00");
  }

  const valid = title.trim() && action.trim() && (frequency !== "selected_days" || days.length > 0);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <form
        className="max-h-[88vh] w-full max-w-md space-y-4 overflow-y-auto rounded-2xl border border-[#2D3A2E] bg-[#222822] p-5"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!valid) return;
          await onSave({
            title, why_it_matters: why, small_action: action,
            reminder_choice: choice,
            reminder_time: choice === "off" ? null : time,
            frequency,
            selected_days: frequency === "selected_days" ? days : [],
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          });
        }}
        data-testid="intention-confirmation-form"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-xl font-bold text-[#E8EDE3]">{c.save}</h2>
          <button type="button" onClick={onClose} aria-label={c.close} className="text-[#7A8A72]"><X /></button>
        </div>
        <label className="block text-sm text-[#A3B197]">{c.title}
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160}
            className="mt-1 w-full rounded-xl border border-[#2D3A2E] bg-[#1A1E1A] px-3 py-2.5 text-[#E8EDE3]" />
        </label>
        <label className="block text-sm text-[#A3B197]">{c.why}
          <textarea value={why} onChange={(e) => setWhy(e.target.value)} maxLength={600} rows={2}
            className="mt-1 w-full resize-none rounded-xl border border-[#2D3A2E] bg-[#1A1E1A] px-3 py-2.5 text-[#E8EDE3]" />
        </label>
        <label className="block text-sm text-[#A3B197]">{c.action}
          <input value={action} onChange={(e) => setAction(e.target.value)} maxLength={240}
            className="mt-1 w-full rounded-xl border border-[#2D3A2E] bg-[#1A1E1A] px-3 py-2.5 text-[#E8EDE3]" />
        </label>
        <fieldset><legend className="mb-2 text-sm text-[#A3B197]">{c.reminder}</legend>
          <div className="grid grid-cols-2 gap-2">{(["off","morning","evening","custom"] as ReminderChoice[]).map((value) =>
            <button type="button" key={value} onClick={() => changeChoice(value)}
              className={`rounded-lg border px-3 py-2 text-sm ${choice === value ? "border-[#8FA680] bg-[#2D3A2E] text-[#E8EDE3]" : "border-[#2D3A2E] text-[#7A8A72]"}`}>
              {c[value]}
            </button>)}</div>
        </fieldset>
        {choice !== "off" && <label className="block text-sm text-[#A3B197]">{c.custom}
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[#2D3A2E] bg-[#1A1E1A] px-3 py-2.5 text-[#E8EDE3]" />
        </label>}
        <fieldset><legend className="mb-2 text-sm text-[#A3B197]">{c.frequency}</legend>
          <div className="grid grid-cols-3 gap-2">{(["once","daily","selected_days"] as IntentionFrequency[]).map((value) =>
            <button type="button" key={value} onClick={() => setFrequency(value)}
              className={`rounded-lg border px-2 py-2 text-xs ${frequency === value ? "border-[#8FA680] bg-[#2D3A2E] text-[#E8EDE3]" : "border-[#2D3A2E] text-[#7A8A72]"}`}>
              {value === "selected_days" ? c.days : c[value]}
            </button>)}</div>
        </fieldset>
        {frequency === "selected_days" && <div className="grid grid-cols-7 gap-1">{c.dayNames.map((name, day) =>
          <button type="button" key={name} onClick={() => setDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day])}
            className={`rounded-lg py-2 text-xs ${days.includes(day) ? "bg-[#4A5D3E] text-white" : "bg-[#1A1E1A] text-[#7A8A72]"}`}>{name}</button>)}</div>}
        <button type="submit" disabled={!valid || saving}
          className="h-11 w-full rounded-xl bg-[#4A5D3E] font-medium text-[#E8EDE3] disabled:opacity-50">
          {saving ? "…" : c.save}
        </button>
      </form>
    </div>
  );
}