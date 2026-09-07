import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

const signUpSchema = signInSchema.extend({
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().trim().min(2, "Enter your full name"),
});

type AuthFields = "email" | "password" | "fullName";
type AuthFieldErrors = Partial<Record<AuthFields, string>>;

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading: sessionLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [errors, setErrors] = useState<AuthFieldErrors>({});
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const mode = searchParams.get("mode") === "reset" ? "reset" : "account";
  const sessionExpired = Boolean((location.state as { sessionExpired?: boolean } | null)?.sessionExpired);

  useEffect(() => {
    if (!sessionLoading && user) {
      const requestedPath = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      navigate(requestedPath || "/dashboard", { replace: true });
    }
  }, [location.state, navigate, sessionLoading, user]);

  const setValidationErrors = (error: z.ZodError) => {
    const nextErrors: AuthFieldErrors = {};
    error.issues.forEach((issue) => {
      const field = issue.path[0] as AuthFields;
      if (!nextErrors[field]) nextErrors[field] = issue.message;
    });
    setErrors(nextErrors);
  };

  const handleSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = signInSchema.safeParse({ email, password });
    if (!result.success) {
      setValidationErrors(result.error);
      return;
    }
    setErrors({});
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: result.data.email ?? "", password: result.data.password ?? "" });
    setLoading(false);
    if (error) toast.error(getAuthErrorMessage(error));
    else toast.success("Welcome back.");
  };

  const handleSignUp = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = signUpSchema.safeParse({ email, password, fullName });
    if (!result.success) {
      setValidationErrors(result.error);
      return;
    }
    setErrors({});
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: result.data.email,
      password: result.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { full_name: result.data.fullName },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(getAuthErrorMessage(error));
      return;
    }
    if (!data.session) setVerificationEmail(result.data.email);
    else toast.success("Account created.");
  };

  const handleReset = async (event: React.FormEvent) => {
    event.preventDefault();
    const emailResult = z.string().trim().email("Enter a valid email address").safeParse(email);
    if (!emailResult.success) {
      setErrors({ email: emailResult.error.issues[0].message });
      return;
    }
    setErrors({});
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(emailResult.data, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });
    setLoading(false);
    if (error) toast.error(getAuthErrorMessage(error));
    else setVerificationEmail(emailResult.data);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      toast.error(getAuthErrorMessage(error));
      setLoading(false);
    }
  };

  if (verificationEmail) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Check your inbox</CardTitle>
            <CardDescription>We sent a secure link to {verificationEmail}. Open it to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            {sessionExpired && <p role="alert" className="mb-4 border border-destructive/50 bg-destructive/10 p-3 text-sm">Your session expired. Sign in again to continue.</p>}
            <Button className="w-full" variant="outline" onClick={() => setVerificationEmail(null)}>Back to sign in</Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <FileText className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold">Sendmybill</span>
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>{mode === "reset" ? "Reset your password" : "Your billing workspace"}</CardTitle>
            <CardDescription>{mode === "reset" ? "We’ll email you a secure reset link." : "Sign in or create an account to continue."}</CardDescription>
          </CardHeader>
          <CardContent>
            {mode === "reset" ? (
              <form onSubmit={handleReset} className="space-y-4">
                <AuthInput id="reset-email" label="Email" type="email" value={email} error={errors.email} onChange={setEmail} />
                <Button className="w-full" disabled={loading}>{loading ? "Sending…" : "Send reset link"}</Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => setSearchParams({})}>Back to sign in</Button>
              </form>
            ) : (
              <>
                <Tabs defaultValue="signin">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="signin">Sign in</TabsTrigger>
                    <TabsTrigger value="signup">Create account</TabsTrigger>
                  </TabsList>
                  <TabsContent value="signin">
                    <form onSubmit={handleSignIn} className="space-y-4">
                      <AuthInput id="signin-email" label="Email" type="email" value={email} error={errors.email} onChange={setEmail} />
                      <AuthInput id="signin-password" label="Password" type="password" value={password} error={errors.password} onChange={setPassword} />
                      <Button className="w-full" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</Button>
                      <button type="button" className="w-full text-sm text-muted-foreground underline underline-offset-4" onClick={() => setSearchParams({ mode: "reset" })}>Forgot your password?</button>
                    </form>
                  </TabsContent>
                  <TabsContent value="signup">
                    <form onSubmit={handleSignUp} className="space-y-4">
                      <AuthInput id="signup-name" label="Full name" value={fullName} error={errors.fullName} onChange={setFullName} />
                      <AuthInput id="signup-email" label="Email" type="email" value={email} error={errors.email} onChange={setEmail} />
                      <AuthInput id="signup-password" label="Password" type="password" value={password} error={errors.password} onChange={setPassword} />
                      <Button className="w-full" disabled={loading}>{loading ? "Creating…" : "Create account"}</Button>
                    </form>
                  </TabsContent>
                </Tabs>
                <div className="relative my-5">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">Or</span></div>
                </div>
                <Button type="button" variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={loading}>Continue with Google</Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

interface AuthInputProps {
  id: string;
  label: string;
  type?: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

const AuthInput = ({ id, label, type = "text", value, error, onChange }: AuthInputProps) => (
  <div className="space-y-2">
    <Label htmlFor={id}>{label}</Label>
    <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} />
    {error && <p id={`${id}-error`} className="text-sm text-destructive">{error}</p>}
  </div>
);

export default Auth;
