import { useEffect } from "react";
import { useLocation } from "wouter";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "@/hooks/useAuth";
import LandingPage from "@/pages/landing";

function RoutePending() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div
        className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin"
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}

export default function HomeRoute() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const native = Capacitor.isNativePlatform();

  useEffect(() => {
    if (loading) return;
    if (user) {
      setLocation("/dashboard");
      return;
    }
    if (native) {
      setLocation("/auth");
    }
  }, [user, loading, native, setLocation]);

  if (loading || user || native) {
    return <RoutePending />;
  }

  return <LandingPage />;
}
