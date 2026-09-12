import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Shield, Plus, Pencil } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/LanguageContext";
import { useFearSetting } from "@/hooks/useFearSetting";
import { saveFearSetting, type FearSettingInput } from "@/lib/fearSettings";

type FieldKey = keyof FearSettingInput;

const FIELD_KEYS: { key: FieldKey; labelKey: string; promptKey: string }[] = [
  { key: "worstCase",       labelKey: "fear.field.worstCase",       promptKey: "fear.prompt.worstCase" },
  { key: "preventionPlan",  labelKey: "fear.field.preventionPlan",  promptKey: "fear.prompt.preventionPlan" },
  { key: "repairPlan",      labelKey: "fear.field.repairPlan",      promptKey: "fear.prompt.repairPlan" },
  { key: "costOfInaction",  labelKey: "fear.field.costOfInaction",  promptKey: "fear.prompt.costOfInaction" },
];

const EMPTY: FearSettingInput = {
  worstCase: "",
  preventionPlan: "",
  repairPlan: "",
  costOfInaction: "",
};

export function FearSettingSection({ taskId, enabled }: { taskId: string; enabled: boolean }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { data: existing, isLoading } = useFearSetting(taskId, enabled);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FearSettingInput>(EMPTY);
  const [saving, setSaving] = useState(false);

  function beginEdit() {
    setForm({
      worstCase: existing?.worst_case ?? "",
      preventionPlan: existing?.prevention_plan ?? "",
      repairPlan: existing?.repair_plan ?? "",
      costOfInaction: existing?.cost_of_inaction ?? "",
    });
    setEditing(true);
  }

  useEffect(() => {
    if (!enabled) setEditing(false);
  }, [enabled]);

  const canSave = Object.values(form).some((v) => v.trim().length > 0) && !saving;

  async function handleSave() {
    if (!user || !canSave) return;
    setSaving(true);
    try {
      await saveFearSetting(user.id, taskId, form, existing?.id ?? null);
      await queryClient.invalidateQueries({ queryKey: ["fear_settings", user.id, taskId] });
      toast({ title: t("fear.toast.saved.title"), description: t("fear.toast.saved.desc") });
      setEditing(false);
    } catch {
      toast({ title: t("fear.toast.error.title"), description: t("fear.toast.error.desc"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border p-4 bg-[#2D2420] border-[#4D3020]">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#D4806A]" />
          <span className="text-sm font-heading font-bold text-[#E8EDE3]">{t("fear.title")}</span>
        </div>
        {existing && !editing && (
          <button
            onClick={beginEdit}
            className="flex items-center gap-1 text-xs font-medium text-[#D4806A] hover:text-[#D4A06A] transition-colors"
            data-testid={`button-edit-fear-${taskId}`}
          >
            <Pencil className="w-3.5 h-3.5" /> {t("fear.edit")}
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-[#7A8A72]">{t("common.loading")}</p>
      ) : editing ? (
        <div className="space-y-3">
          {FIELD_KEYS.map((f) => (
            <div key={f.key}>
              <label
                htmlFor={`fear-${f.key}-${taskId}`}
                className="block text-xs font-semibold text-[#A3B197] mb-1"
              >
                {t(f.labelKey)}
              </label>
              <Textarea
                id={`fear-${f.key}-${taskId}`}
                value={form[f.key]}
                onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                placeholder={t(f.promptKey)}
                data-testid={`textarea-fear-${f.key}-${taskId}`}
                className="min-h-[68px] bg-[#1A1E1A] border-[#3D3020] text-[#C8D5B9] placeholder:text-[#7A8A72] rounded-xl resize-none text-sm"
              />
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="h-10 px-4 rounded-xl bg-[#D4806A] text-[#E8EDE3] text-sm font-medium hover:bg-[#D4A06A] transition-colors disabled:opacity-50"
              data-testid={`button-save-fear-${taskId}`}
            >
              {saving ? t("fear.saving") : t("fear.save")}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="h-10 px-4 rounded-xl text-sm font-medium text-[#7A8A72] hover:bg-[#1A1E1A] transition-colors"
              data-testid={`button-cancel-fear-${taskId}`}
            >
              {t("fear.cancel")}
            </button>
          </div>
        </div>
      ) : existing ? (
        <div className="space-y-2.5">
          {FIELD_KEYS.map((f) => {
            const value =
              f.key === "worstCase"
                ? existing.worst_case
                : f.key === "preventionPlan"
                  ? existing.prevention_plan
                  : f.key === "repairPlan"
                    ? existing.repair_plan
                    : existing.cost_of_inaction;
            if (!value) return null;
            return (
              <div key={f.key}>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#D4806A]/70">
                  {t(f.labelKey)}
                </p>
                <p className="text-sm text-[#C8D5B9]">{value}</p>
              </div>
            );
          })}
        </div>
      ) : (
        <div>
          <p className="text-sm text-[#A3B197] mb-3">
            {t("fear.emptyBody")}
          </p>
          <button
            onClick={beginEdit}
            className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-[#D4806A] text-[#E8EDE3] text-sm font-medium hover:bg-[#D4A06A] transition-colors"
            data-testid={`button-add-fear-${taskId}`}
          >
            <Plus className="w-4 h-4" /> {t("fear.addButton")}
          </button>
        </div>
      )}
    </div>
  );
}
