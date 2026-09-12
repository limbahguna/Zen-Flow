import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useLocation } from "wouter";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { isProfileComplete, profileLoading } = useProfile();
  const [, setLocation] = useLocation();

  const isLoading = loading || profileLoading;

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      setLocation("/auth");
      return;
    }
    if (!isProfileComplete) {
      setLocation("/setup");
    }
  }, [user, isLoading, isProfileComplete, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user || !isProfileComplete) {
    return null;
  }

  return <>{children}</>;
}

/** Wraps the /setup page: requires auth but redirects away if profile is already complete. */
export function SetupRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { isProfileComplete, profileLoading } = useProfile();
  const [, setLocation] = useLocation();

  const isLoading = loading || profileLoading;

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      setLocation("/auth");
      return;
    }
    if (isProfileComplete) {
      setLocation("/dashboard");
    }
  }, [user, isLoading, isProfileComplete, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user || isProfileComplete) {
    return null;
  }

  return <>{children}</>;
}
