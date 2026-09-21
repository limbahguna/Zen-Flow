import { useEffect, useMemo } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AuthPage from "@/pages/auth";
import DashboardPage from "@/pages/dashboard";
import PracticePage from "@/pages/practice";
import SleepPage from "@/pages/sleep";
import CoachPage from "@/pages/coach";
import ProfilePage from "@/pages/profile";
import PrivacyPage from "@/pages/privacy";
import DeleteAccountPage from "@/pages/delete-account";
import TermsPage from "@/pages/terms";
import CrisisPage from "@/pages/crisis";
import { CoachProvider } from "@/context/CoachContext";
import { LanguageProvider, useLanguage } from "@/context/LanguageContext";
import FocusPage from "@/pages/focus";
import SetupPage from "@/pages/setup";
import PlansPage from "@/pages/plans";
import ProgramsPage from "@/pages/programs";
import ProgramDetailPage from "@/pages/program-detail";
import DailyPlanPage from "@/pages/daily-plan";
import ProgressPage from "@/pages/progress";
import ResetPasswordPage from "@/pages/reset-password";
import { SetupRoute } from "@/components/ProtectedRoute";
import { LanguageProfileSync } from "@/components/LanguageProfileSync";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
import { useIntentions } from "@/hooks/useIntentions";
import { clearDeviceIntentionNotifications, intentionPathFromNotificationExtra, scheduleIntentionReminder } from "@/lib/intentionNotifications";
import { ensureMindfulReminderChannel } from "@/lib/localReminderNotifications";
import { scheduleMovementReminder } from "@/lib/movementNotifications";
import { loadMovementConfig, movementReminderCopy } from "@/services/reminderService";

function NotificationNavigation() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let remove: (() => Promise<void>) | undefined;
    void LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
      const path = intentionPathFromNotificationExtra(event.notification.extra);
      if (path) setLocation(path);
    }).then((handle) => { remove = () => handle.remove(); });
    return () => { void remove?.(); };
  }, [setLocation]);
  return null;
}

function IntentionNotificationSync() {
  const { user } = useAuth();
  const { data = [] } = useIntentions();
  const fingerprint = data.map((item) => `${item.id}:${item.updated_at}`).join("|");

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const ownedIntentions = [...data];
    void (async () => {
      await ensureMindfulReminderChannel();
      await clearDeviceIntentionNotifications();
      if (!user?.id) return;
      await Promise.all(
        ownedIntentions
          .filter((item) => item.status === "active" && item.reminder_choice !== "off")
          .map((item) => scheduleIntentionReminder(item, false)),
      );
    })();
    return () => {
      void clearDeviceIntentionNotifications();
    };
  }, [user?.id, fingerprint]);

  return null;
}

function MovementNotificationSync() {
  const { t } = useLanguage();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const config = loadMovementConfig();
    void (async () => {
      await ensureMindfulReminderChannel();
      if (!config.enabled) return;
      await scheduleMovementReminder(config, movementReminderCopy(config, t), false);
    })();
  }, [t]);

  return null;
}

function RootRoute() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (loading) return;
    if (user) {
      setLocation("/dashboard");
    } else {
      setLocation("/auth");
    }
  }, [user, loading, setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={RootRoute} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/setup">
        <SetupRoute>
          <SetupPage />
        </SetupRoute>
      </Route>
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/delete-account" component={DeleteAccountPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/crisis" component={CrisisPage} />
      <Route path="/dashboard">
        <ProtectedRoute>
          <DashboardPage />
        </ProtectedRoute>
      </Route>
      <Route path="/practice">
        <ProtectedRoute>
          <PracticePage />
        </ProtectedRoute>
      </Route>
      <Route path="/coach">
        <ProtectedRoute>
          <CoachPage />
        </ProtectedRoute>
      </Route>
      <Route path="/profile">
        <ProtectedRoute>
          <ProfilePage />
        </ProtectedRoute>
      </Route>
      <Route path="/plans">
        <ProtectedRoute>
          <PlansPage />
        </ProtectedRoute>
      </Route>
      <Route path="/programs/:slug">
        <ProtectedRoute>
          <ProgramDetailPage />
        </ProtectedRoute>
      </Route>
      <Route path="/programs">
        <ProtectedRoute>
          <ProgramsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/daily-plan">
        <ProtectedRoute>
          <DailyPlanPage />
        </ProtectedRoute>
      </Route>
      <Route path="/progress">
        <ProtectedRoute>
          <ProgressPage />
        </ProtectedRoute>
      </Route>
      <Route path="/focus">
        <ProtectedRoute>
          <FocusPage />
        </ProtectedRoute>
      </Route>
      <Route path="/sleep">
        <ProtectedRoute>
          <SleepPage />
        </ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function UserScopedApplication() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useMemo(() => new QueryClient(), [userId]);

  useEffect(() => () => queryClient.clear(), [queryClient]);
  useEffect(() => {
    try {
      localStorage.removeItem("coach_chat_history");
    } catch {
      // Legacy best-effort cleanup; current chat content is never persisted.
    }
  }, [userId]);

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <div className="app-shell">
          <LanguageProfileSync />
          <IntentionNotificationSync />
          <MovementNotificationSync />
          <CoachProvider key={userId ?? "signed-out"} userId={userId}>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <NotificationNavigation />
              <Router />
            </WouterRouter>
          </CoachProvider>
          <Toaster />
        </div>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

function App() {
  return (
    <TooltipProvider>
      <AuthProvider>
        <UserScopedApplication />
      </AuthProvider>
    </TooltipProvider>
  );
}

export default App;
