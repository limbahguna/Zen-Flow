import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Leaf } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import {
  OAUTH_ERROR_EVENT,
  OAUTH_FINISHED_EVENT,
  OAUTH_SUCCESS_EVENT,
  openGoogleSignIn,
  requestPasswordReset,
} from "@/lib/native";
import LanguageSelector from "@/components/LanguageSelector";
import { trackEvent } from "@/lib/analytics";

export default function AuthPage() {
  const { signIn, signUp, user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      setLocation("/dashboard");
    }
  }, [authLoading, setLocation, user]);

  useEffect(() => {
    const handleOAuthError = (event: Event) => {
      setGoogleLoading(false);
      const message =
        event instanceof CustomEvent && typeof event.detail?.message === "string"
          ? event.detail.message
          : t("auth.google.failed");
      toast({
        title: t("auth.google.failed"),
        description: message,
        variant: "destructive",
      });
    };
    const handleOAuthFinished = () => setGoogleLoading(false);
    const handleOAuthSuccess = () => {
      setGoogleLoading(false);
      trackEvent("auth_sign_in_success", { method: "google" });
      setLocation("/dashboard");
    };
    window.addEventListener(OAUTH_ERROR_EVENT, handleOAuthError);
    window.addEventListener(OAUTH_FINISHED_EVENT, handleOAuthFinished);
    window.addEventListener(OAUTH_SUCCESS_EVENT, handleOAuthSuccess);
    return () => {
      window.removeEventListener(OAUTH_ERROR_EVENT, handleOAuthError);
      window.removeEventListener(OAUTH_FINISHED_EVENT, handleOAuthFinished);
      window.removeEventListener(OAUTH_SUCCESS_EVENT, handleOAuthSuccess);
    };
  }, [setLocation, t, toast]);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await openGoogleSignIn();
      if (error) {
        toast({
          title: t("auth.google.failed"),
          description: error.message,
          variant: "destructive",
        });
        setGoogleLoading(false);
      }
    } catch (error) {
      toast({
        title: t("auth.google.failed"),
        description: error instanceof Error ? error.message : t("auth.google.failed"),
        variant: "destructive",
      });
      setGoogleLoading(false);
    }
    // On web the page redirects; on native the callback finishes the flow.
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast({ title: t("auth.signin.error"), description: error.message, variant: "destructive" });
    } else {
      trackEvent("auth_sign_in_success", { method: "password" });
      setLocation("/dashboard");
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signUp(email, password);
    setLoading(false);
    if (error) {
      toast({ title: t("auth.signup.error"), description: error.message, variant: "destructive" });
    } else {
      trackEvent("auth_sign_up_success", { method: "password" });
      toast({ title: t("auth.signup.success.title"), description: t("auth.signup.success.desc") });
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast({
        title: t("auth.reset.emailRequired.title"),
        description: t("auth.reset.emailRequired.desc"),
        variant: "destructive",
      });
      return;
    }
    setResetLoading(true);
    const { error } = await requestPasswordReset(email.trim());
    setResetLoading(false);
    if (error) {
      toast({
        title: t("auth.reset.request.error"),
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: t("auth.reset.request.success.title"),
        description: t("auth.reset.request.success.desc"),
      });
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-end">
          <LanguageSelector />
        </div>

        {/* Logo + heading */}
        <div className="flex flex-col items-center justify-center space-y-3 text-center">
          <div className="w-16 h-16 bg-[#222822] border border-[#2D3A2E] rounded-2xl flex items-center justify-center mb-1">
            <Leaf className="w-8 h-8 text-[#8FA680]" />
          </div>
          <h1 className="text-3xl font-heading font-bold text-[#E8EDE3]">Mindful Space</h1>
          <p className="text-[#7A8A72]">{t("auth.tagline")}</p>
        </div>

        <div className="bg-[#222822] border border-[#2D3A2E] rounded-2xl overflow-hidden">
          <Tabs defaultValue="signin" className="w-full">
            <div className="px-6 pt-5 pb-0">

              {/* Google OAuth button */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={googleLoading}
                data-testid="button-google-login"
                className="w-full h-12 rounded-xl flex items-center justify-center gap-3 transition-opacity duration-200 disabled:opacity-60"
                style={{
                  backgroundColor: "#E8EDE3",
                  color: "#1A1E1A",
                  border: "0.5px solid #2D3A2E",
                  fontFamily: "DM Sans, sans-serif",
                  fontSize: "15px",
                  fontWeight: 500,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                {googleLoading ? t("auth.google.redirecting") : t("auth.google.cta")}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-[#2D3A2E]" />
                <span style={{ color: "#7A8A72", fontSize: "12px", fontFamily: "DM Sans, sans-serif" }}>
                  {t("auth.divider")}
                </span>
                <div className="flex-1 h-px bg-[#2D3A2E]" />
              </div>

              {/* Sign In / Sign Up tabs */}
              <TabsList className="grid w-full grid-cols-2 h-11 bg-[#1E241E] rounded-xl p-1">
                <TabsTrigger
                  value="signin"
                  data-testid="tab-signin"
                  className="rounded-lg data-[state=active]:bg-[#2D3A2E] data-[state=active]:text-[#E8EDE3] text-[#7A8A72]"
                >
                  {t("auth.tab.signin")}
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  data-testid="tab-signup"
                  className="rounded-lg data-[state=active]:bg-[#2D3A2E] data-[state=active]:text-[#E8EDE3] text-[#7A8A72]"
                >
                  {t("auth.tab.signup")}
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="p-6">
              <TabsContent value="signin" className="mt-0">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email" className="text-[#C8D5B9]">{t("auth.label.email")}</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      autoComplete="username"
                      placeholder={t("auth.placeholder.email")}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      data-testid="input-email-signin"
                      required
                      className="h-11 rounded-xl bg-[#1A1E1A] border-[#2D3A2E] text-[#C8D5B9] placeholder:text-[#7A8A72]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password" className="text-[#C8D5B9]">{t("auth.label.password")}</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      data-testid="input-password-signin"
                      required
                      className="h-11 rounded-xl bg-[#1A1E1A] border-[#2D3A2E] text-[#C8D5B9]"
                    />
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={resetLoading}
                      data-testid="button-forgot-password"
                      className="block ml-auto text-xs text-[#8FA680] hover:underline disabled:opacity-60"
                    >
                      {resetLoading
                        ? t("auth.reset.request.loading")
                        : t("auth.reset.forgot")}
                    </button>
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-11 rounded-xl text-sm bg-[#4A5D3E] hover:bg-[#6B8C5A] text-[#E8EDE3] border-0 transition-colors duration-300"
                    disabled={loading}
                    data-testid="button-submit-signin"
                  >
                    {loading ? t("auth.signin.loading") : t("auth.signin.submit")}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-0">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-[#C8D5B9]">{t("auth.label.email")}</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      autoComplete="username"
                      placeholder={t("auth.placeholder.email")}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      data-testid="input-email-signup"
                      required
                      className="h-11 rounded-xl bg-[#1A1E1A] border-[#2D3A2E] text-[#C8D5B9] placeholder:text-[#7A8A72]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-[#C8D5B9]">{t("auth.label.password")}</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      data-testid="input-password-signup"
                      required
                      className="h-11 rounded-xl bg-[#1A1E1A] border-[#2D3A2E] text-[#C8D5B9]"
                      minLength={6}
                    />
                  </div>

                  <label className="flex items-start gap-2.5 cursor-pointer" data-testid="label-age-gate">
                    <input
                      type="checkbox"
                      checked={ageConfirmed}
                      onChange={(e) => setAgeConfirmed(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-[#2D3A2E] accent-[#8FA680] cursor-pointer shrink-0"
                      data-testid="checkbox-age-gate"
                    />
                    <span className="text-xs text-[#7A8A72] leading-snug">
                      {t("auth.signup.age")}
                    </span>
                  </label>

                  <Button
                    type="submit"
                    className="w-full h-11 rounded-xl text-sm bg-[#4A5D3E] hover:bg-[#6B8C5A] text-[#E8EDE3] border-0 transition-colors duration-300"
                    disabled={loading || !ageConfirmed}
                    data-testid="button-submit-signup"
                  >
                    {loading ? t("auth.signup.loading") : t("auth.signup.submit")}
                  </Button>

                  <p className="text-center text-xs text-[#7A8A72] pt-1">
                    {t("auth.signup.terms.prefix")}{" "}
                    <button
                      type="button"
                      onClick={() => setLocation("/privacy")}
                      className="text-[#8FA680] hover:underline"
                      data-testid="link-privacy-signup"
                    >
                      {t("auth.signup.terms.privacy")}
                    </button>
                    {" "}{t("auth.signup.terms.and")}{" "}
                    <button
                      type="button"
                      onClick={() => setLocation("/terms")}
                      className="text-[#8FA680] hover:underline"
                      data-testid="link-terms-signup"
                    >
                      {t("auth.signup.terms.terms")}
                    </button>
                  </p>
                </form>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
