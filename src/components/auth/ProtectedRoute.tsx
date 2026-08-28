import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PageLoader } from "@/components/shared/AsyncState";

interface ProtectedRouteProps {
  children: ReactNode;
  requireOnboarding?: boolean;
}

const ProtectedRoute = ({ children, requireOnboarding = true }: ProtectedRouteProps) => {
  const { user, loading, sessionExpired } = useAuth();
  const location = useLocation();
  const [checkingProfile, setCheckingProfile] = useState(requireOnboarding);
  const [onboardingComplete, setOnboardingComplete] = useState(true);

  useEffect(() => {
    if (loading || !user || !requireOnboarding) {
      setCheckingProfile(false);
      return;
    }

    let mounted = true;
    setCheckingProfile(true);
    void supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .single()
      .then(({ data, error }) => {
        if (!mounted) return;
        setOnboardingComplete(error ? true : Boolean(data?.onboarding_completed));
        setCheckingProfile(false);
      });

    return () => {
      mounted = false;
    };
  }, [loading, requireOnboarding, user]);

  if (loading || checkingProfile) return <PageLoader label="Checking your account…" />;

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location, sessionExpired }} />;
  }

  if (requireOnboarding && !onboardingComplete) {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
};

export default ProtectedRoute;
