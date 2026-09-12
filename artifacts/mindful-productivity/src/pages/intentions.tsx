import { useEffect, useMemo, useState } from "react";
import { Bell, Check, Clock3, Edit3, Leaf, Plus } from "lucide-react";
import { IntentionForm } from "@/components/IntentionForm";
import { useIntentions, useIntentionActions } from "@/hooks/useIntentions";
import { cancelIntentionReminder, scheduleIntentionReminder } from "@/lib/intentionNotifications";
import type { Intention, IntentionInput, IntentionStatus } from "@/lib/intentions";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/hooks/use-toast";

const COPY = {
  en: { active:"Active intentions", history:"History", empty:"Set a gentle intention and choose one small next step.", add:"New intention", done:"Mark done", postpone:"Postpone", edit:"Edit reminder", letGo:"Let it go", statuses:{active:"Active",done:"Done",postponed:"Postponed",let_go:"Let go"} },
  id: { active:"Niat aktif", history:"Riwayat", empty:"Tetapkan niat yang lembut dan pilih satu langkah kecil.", add:"Niat baru", done:"Tandai selesai", postpone:"Tunda", edit:"Ubah pengingat", letGo:"Lepaskan", statuses:{active:"Aktif",done:"Selesai",postponed:"Ditunda",let_go:"Dilepas"} },
  ja: { active:"進行中のインテンション", history:"履歴", empty:"やさしいインテンションと小さな一歩を設定しましょう。", add:"新しいインテンション", done:"完了", postpone:"延期", edit:"リマインダー編集", letGo:"手放す", statuses:{active:"進行中",done:"完了",postponed:"延期",let_go:"手放した"} },
};

function ReminderSummary({ intention }: { intention: Intention }) {
  if (intention.reminder_choice === "off") return null;
  return <span className="flex items-center gap-1 text-xs text-[#8FA680]"><Bell className="h-3 w-3" />{intention.reminder_time?.slice(0,5)} · {intention.frequency.replace("_", " ")}</span>;
}

export default function IntentionsPage() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const c = COPY[language];
  const { data = [], isLoading, error } = useIntentions();
  const actions = useIntentionActions();
  const [editing, setEditing] = useState<Intention | null>(null);
  const [creating, setCreating] = useState(false);
  const active = useMemo(() => data.filter((item) => item.status === "active"), [data]);
  const history = useMemo(() => data.filter((item) => item.status !== "active"), [data]);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("intention");
    if (id) requestAnimationFrame(() => document.getElementById(`intention-${id}`)?.scrollIntoView({ behavior:"smooth", block:"center" }));
  }, [data]);

  async function setStatus(intention: Intention, status: IntentionStatus) {
    const postponedUntil = status === "postponed"
      ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      : null;
    await cancelIntentionReminder(intention.id);
    await actions.setStatus.mutateAsync({ id: intention.id, status, postponedUntil });
  }

  async function save(input: IntentionInput) {
    if (editing) {
      await cancelIntentionReminder(editing.id);
      let updated = await actions.update.mutateAsync({ id: editing.id, input });
      if (input.reminder_choice !== "off") {
        let scheduled = false;
        try { scheduled = await scheduleIntentionReminder(updated); } catch { scheduled = false; }
        if (!scheduled) {
          updated = await actions.update.mutateAsync({
            id: editing.id,
            input: { ...input, reminder_choice: "off", reminder_time: null },
          });
          toast({ title: language === "id" ? "Pengingat tidak diaktifkan" : language === "ja" ? "リマインダーはオフです" : "Reminder not enabled" });
        }
      }
      setEditing(null);
    } else {
      let created = await actions.create.mutateAsync(input);
      if (input.reminder_choice !== "off") {
        let scheduled = false;
        try { scheduled = await scheduleIntentionReminder(created); } catch { scheduled = false; }
        if (!scheduled) {
          created = await actions.update.mutateAsync({
            id: created.id,
            input: { ...input, reminder_choice: "off", reminder_time: null },
          });
          toast({ title: language === "id" ? "Pengingat tidak diaktifkan" : language === "ja" ? "リマインダーはオフです" : "Reminder not enabled" });
        }
      }
      setCreating(false);
    }
  }

  function Card({ intention, historical = false }: { intention: Intention; historical?: boolean }) {
    return <article id={`intention-${intention.id}`} data-testid={`intention-card-${intention.id}`}
      className="rounded-2xl border border-[#2D3A2E] bg-[#222822] p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div><h3 className="font-heading text-lg font-semibold text-[#E8EDE3]">{intention.title}</h3>
          <span className="text-xs text-[#7A8A72]">{c.statuses[intention.status]}</span></div>
        <Leaf className="h-5 w-5 text-[#8FA680]" />
      </div>
      <p className="mb-3 text-sm text-[#C8D5B9]">{intention.small_action}</p>
      <ReminderSummary intention={intention} />
      {!historical && <div className="mt-4 grid grid-cols-2 gap-2">
        <button onClick={() => void setStatus(intention,"done")} className="flex items-center justify-center gap-1 rounded-lg bg-[#4A5D3E] px-2 py-2 text-xs text-white"><Check className="h-3 w-3"/>{c.done}</button>
        <button onClick={() => void setStatus(intention,"postponed")} className="flex items-center justify-center gap-1 rounded-lg border border-[#3D4D35] px-2 py-2 text-xs text-[#A3B197]"><Clock3 className="h-3 w-3"/>{c.postpone}</button>
        <button onClick={() => setEditing(intention)} className="flex items-center justify-center gap-1 rounded-lg border border-[#3D4D35] px-2 py-2 text-xs text-[#A3B197]"><Edit3 className="h-3 w-3"/>{c.edit}</button>
        <button onClick={() => void setStatus(intention,"let_go")} className="rounded-lg px-2 py-2 text-xs text-[#7A8A72]">{c.letGo}</button>
      </div>}
    </article>;
  }

  return <main className="mx-auto max-w-4xl space-y-6 px-4 py-5">
    <div className="flex items-center justify-between"><h2 className="font-heading text-xl text-[#E8EDE3]">{c.active}</h2>
      <button onClick={() => setCreating(true)} className="flex items-center gap-1 rounded-xl bg-[#4A5D3E] px-3 py-2 text-sm text-white"><Plus className="h-4 w-4"/>{c.add}</button></div>
    {isLoading && <p className="text-sm text-[#7A8A72]">…</p>}
    {error && <p role="alert" className="text-sm text-red-300">{String(error)}</p>}
    {!isLoading && active.length === 0 && <p className="rounded-2xl border border-dashed border-[#2D3A2E] p-6 text-center text-sm text-[#7A8A72]">{c.empty}</p>}
    <div className="space-y-3">{active.map((item) => <Card key={item.id} intention={item}/>)}</div>
    {history.length > 0 && <section className="space-y-3"><h2 className="font-heading text-lg text-[#C8D5B9]">{c.history}</h2>
      {history.map((item) => <Card key={item.id} intention={item} historical/>)}</section>}
    {(creating || editing) && <IntentionForm initial={editing ?? undefined} onClose={() => { setCreating(false); setEditing(null); }} onSave={save}
      saving={actions.create.isPending || actions.update.isPending}/>}
  </main>;
}