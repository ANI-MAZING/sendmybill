import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { ErrorState, PageLoader } from "@/components/shared/AsyncState";
import { Button } from "@/components/ui/button";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const finishAuthentication = async () => {
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setError(getAuthErrorMessage(exchangeError));
          return;
        }
      }
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setError("The sign-in link is invalid or has expired. Request a new one and try again.");
        return;
      }
      navigate("/dashboard", { replace: true });
    };
    void finishAuthentication();
  }, [navigate]);

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center p-6">
        <div className="w-full">
          <ErrorState title="Couldn’t finish signing in" message={error} />
          <Button asChild className="mt-4 w-full"><Link to="/auth">Return to sign in</Link></Button>
        </div>
      </main>
    );
  }
  return <PageLoader label="Finishing sign in…" />;
};

export default AuthCallback;
