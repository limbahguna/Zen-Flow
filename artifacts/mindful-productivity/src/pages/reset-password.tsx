import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import supabase from "@/lib/supabase";

export default function ResetPasswordPage() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const callbackError = useMemo(
    () => new URLSearchParams(window.location.search).get("error"),
    [],
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirmation) {
      toast({
        title: t("auth.reset.mismatch.title"),
        description: t("auth.reset.mismatch.desc"),
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      toast({
        title: t("auth.reset.update.error"),
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: t("auth.reset.update.success.title"),
      description: t("auth.reset.update.success.desc"),
    });
    await supabase.auth.signOut();
    setLocation("/auth");
  };

  const unavailable = callbackError || (!loading && !user);

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md bg-[#222822] border border-[#2D3A2E] rounded-2xl p-6 space-y-5">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 bg-[#1A1E1A] border border-[#2D3A2E] rounded-2xl flex items-center justify-center">
            <Leaf className="w-7 h-7 text-[#8FA680]" />
          </div>
          <h1 className="text-2xl font-heading font-bold text-[#E8EDE3]">
            {t("auth.reset.title")}
          </h1>
          <p className="text-sm text-[#7A8A72]">
            {unavailable ? callbackError ?? t("auth.reset.invalid") : t("auth.reset.subtitle")}
          </p>
        </div>

        {loading ? (
          <p className="text-center text-sm text-[#7A8A72]">{t("common.loading")}</p>
        ) : unavailable ? (
          <Button
            type="button"
            onClick={() => setLocation("/auth")}
            className="w-full bg-[#4A5D3E] hover:bg-[#6B8C5A] text-[#E8EDE3]"
            data-testid="button-reset-back"
          >
            {t("auth.reset.back")}
          </Button>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-[#C8D5B9]">
                {t("auth.reset.newPassword")}
              </Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                data-testid="input-new-password"
                className="bg-[#1A1E1A] border-[#2D3A2E] text-[#C8D5B9]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-[#C8D5B9]">
                {t("auth.reset.confirmPassword")}
              </Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                data-testid="input-confirm-password"
                className="bg-[#1A1E1A] border-[#2D3A2E] text-[#C8D5B9]"
              />
            </div>
            <Button
              type="submit"
              disabled={submitting}
              data-testid="button-update-password"
              className="w-full bg-[#4A5D3E] hover:bg-[#6B8C5A] text-[#E8EDE3]"
            >
              {submitting
                ? t("auth.reset.update.loading")
                : t("auth.reset.update.submit")}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}