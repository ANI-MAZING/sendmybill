import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const passwordSchema = z.string().min(8, "Password must be at least 8 characters");

const UpdatePassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = passwordSchema.safeParse(password);
    if (!result.success) {
      setFieldError(result.error.issues[0].message);
      return;
    }
    setFieldError(null);
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: result.data });
    setSaving(false);
    if (error) {
      toast.error(getAuthErrorMessage(error));
      return;
    }
    toast.success("Password updated. You’re signed in.");
    navigate("/dashboard", { replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle>Choose a new password</CardTitle><CardDescription>Use at least 8 characters.</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input id="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} aria-invalid={Boolean(fieldError)} />
              {fieldError && <p className="text-sm text-destructive">{fieldError}</p>}
            </div>
            <Button className="w-full" disabled={saving}>{saving ? "Updating…" : "Update password"}</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
};

export default UpdatePassword;
