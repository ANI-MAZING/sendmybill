import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Check, FileText } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { currencies } from "@/lib/currencies";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const countries = [
  ["IN", "India"], ["US", "United States"], ["GB", "United Kingdom"],
  ["CA", "Canada"], ["AU", "Australia"], ["SG", "Singapore"],
  ["AE", "United Arab Emirates"], ["DE", "Germany"], ["FR", "France"],
] as const;

const onboardingSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your name"),
  billingMode: z.enum(["business", "personal"]),
  countryCode: z.string().length(2),
  defaultCurrency: z.string().min(3),
  companyName: z.string().trim().max(200),
  companyEmail: z.string().trim().email("Enter a valid company email").or(z.literal("")),
  companyPhone: z.string().trim().max(50),
  paymentTerms: z.number().int().min(0).max(365),
  invoicePrefix: z.string().trim().min(1, "Enter an invoice prefix").max(20).regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers, and hyphens only"),
  startingNumber: z.number().int().positive().max(999_999_999),
  nextAction: z.enum(["client", "invoice"]),
  clientName: z.string().trim().max(200),
  clientEmail: z.string().trim(),
}).superRefine(({ nextAction, clientName, clientEmail }, context) => {
  if (nextAction === "client" && clientName.length > 0) {
    if (!z.string().email().safeParse(clientEmail).success) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["clientEmail"], message: "Enter a valid client email" });
    }
  }
});

type OnboardingData = z.infer<typeof onboardingSchema>;
type OnboardingErrors = Partial<Record<keyof OnboardingData, string>>;

const steps = ["About you", "Defaults", "Business", "First invoice"];

const Onboarding = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<OnboardingErrors>({});
  const [data, setData] = useState<OnboardingData>({
    fullName: user?.user_metadata.full_name ?? user?.user_metadata.name ?? "",
    billingMode: "business",
    countryCode: "IN",
    defaultCurrency: "INR",
    companyName: "",
    companyEmail: user?.email ?? "",
    companyPhone: "",
    paymentTerms: 30,
    invoicePrefix: "INV-",
    startingNumber: 1,
    nextAction: "invoice",
    clientName: "",
    clientEmail: "",
  });

  const update = <Key extends keyof OnboardingData>(key: Key, value: OnboardingData[Key]) => {
    setData((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const validateCurrentStep = (): boolean => {
    const result = onboardingSchema.safeParse(data);
    if (result.success) return true;
    const fieldsByStep: Array<Array<keyof OnboardingData>> = [
      ["fullName", "billingMode"],
      ["countryCode", "defaultCurrency"],
      ["companyName", "companyEmail", "companyPhone", "paymentTerms"],
      ["invoicePrefix", "startingNumber", "clientName", "clientEmail"],
    ];
    const currentFields = fieldsByStep[step];
    const nextErrors: OnboardingErrors = {};
    result.error.issues.forEach((issue) => {
      const field = issue.path[0] as keyof OnboardingData;
      if (currentFields.includes(field) && !nextErrors[field]) nextErrors[field] = issue.message;
    });
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const next = () => {
    if (validateCurrentStep()) setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const completeOnboarding = async () => {
    const result = onboardingSchema.safeParse(data);
    if (!result.success || !user) {
      validateCurrentStep();
      return;
    }
    setSaving(true);
    const { error: profileError } = await supabase.from("profiles").update({
      full_name: result.data.fullName,
      billing_mode: result.data.billingMode,
      country_code: result.data.countryCode,
      default_currency: result.data.defaultCurrency,
      company_name: result.data.companyName || null,
      company_email: result.data.companyEmail || null,
      company_phone: result.data.companyPhone || null,
      default_payment_terms: result.data.paymentTerms,
      invoice_prefix: result.data.invoicePrefix.toUpperCase(),
      invoice_next_number: result.data.startingNumber,
      onboarding_completed: true,
    }).eq("id", user.id);

    let clientError: Error | null = null;
    if (!profileError && result.data.nextAction === "client" && result.data.clientName) {
      const response = await supabase.from("clients").insert({
        user_id: user.id,
        client_name: result.data.clientName,
        client_email: result.data.clientEmail,
      });
      clientError = response.error;
    }
    setSaving(false);

    if (profileError || clientError) {
      toast.error("We couldn’t finish setup. Your entries are still here—please try again.");
      return;
    }
    toast.success("Your Sendmybill workspace is ready.");
    navigate(result.data.nextAction === "invoice" ? "/dashboard/create" : "/dashboard", { replace: true });
  };

  return (
    <main className="min-h-screen bg-muted/40 p-4 sm:p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center gap-2"><FileText className="h-7 w-7" /><span className="text-xl font-bold">Sendmybill</span></div>
        <ol className="mb-6 grid grid-cols-4 gap-2" aria-label="Setup progress">
          {steps.map((label, index) => (
            <li key={label} className="text-xs sm:text-sm">
              <div className={`mb-2 h-1 ${index <= step ? "bg-primary" : "bg-border"}`} />
              <span className={index === step ? "font-semibold" : "text-muted-foreground"}>{index < step ? <Check className="inline h-3 w-3" /> : index + 1}. {label}</span>
            </li>
          ))}
        </ol>
        <Card>
          <CardHeader>
            <CardTitle>{steps[step]}</CardTitle>
            <CardDescription>{step === 0 ? "Tell us how you bill clients." : step === 1 ? "These defaults keep invoice creation fast." : step === 2 ? "This information appears on new invoices." : "Choose how your numbering starts, then create or add your first client."}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {step === 0 && <AboutStep data={data} errors={errors} update={update} />}
            {step === 1 && <DefaultsStep data={data} errors={errors} update={update} />}
            {step === 2 && <BusinessStep data={data} errors={errors} update={update} />}
            {step === 3 && <FirstInvoiceStep data={data} errors={errors} update={update} />}
            <div className="flex justify-between pt-3">
              <Button variant="outline" disabled={step === 0 || saving} onClick={() => setStep((current) => current - 1)}>Back</Button>
              {step < steps.length - 1 ? <Button onClick={next}>Continue</Button> : <Button onClick={completeOnboarding} disabled={saving}>{saving ? "Finishing…" : "Finish setup"}</Button>}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

type StepProps = {
  data: OnboardingData;
  errors: OnboardingErrors;
  update: <Key extends keyof OnboardingData>(key: Key, value: OnboardingData[Key]) => void;
};

const FieldError = ({ error }: { error?: string }) => error ? <p className="text-sm text-destructive">{error}</p> : null;

const AboutStep = ({ data, errors, update }: StepProps) => <>
  <div className="space-y-2"><Label htmlFor="full-name">Your name</Label><Input id="full-name" value={data.fullName} onChange={(event) => update("fullName", event.target.value)} /><FieldError error={errors.fullName} /></div>
  <div className="space-y-3"><Label>Billing mode</Label><RadioGroup value={data.billingMode} onValueChange={(value) => update("billingMode", value as OnboardingData["billingMode"])} className="grid sm:grid-cols-2">
    <Label htmlFor="business" className="flex cursor-pointer items-center gap-3 border p-4"><RadioGroupItem id="business" value="business" />Business or agency</Label>
    <Label htmlFor="personal" className="flex cursor-pointer items-center gap-3 border p-4"><RadioGroupItem id="personal" value="personal" />Personal or freelance</Label>
  </RadioGroup></div>
</>;

const DefaultsStep = ({ data, errors, update }: StepProps) => <>
  <div className="space-y-2"><Label>Country</Label><Select value={data.countryCode} onValueChange={(value) => update("countryCode", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{countries.map(([code, name]) => <SelectItem key={code} value={code}>{name}</SelectItem>)}</SelectContent></Select><FieldError error={errors.countryCode} /></div>
  <div className="space-y-2"><Label>Default currency</Label><Select value={data.defaultCurrency} onValueChange={(value) => update("defaultCurrency", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent className="max-h-64">{currencies.map((currency) => <SelectItem key={currency.code} value={currency.code}>{currency.code} — {currency.name}</SelectItem>)}</SelectContent></Select><FieldError error={errors.defaultCurrency} /></div>
</>;

const BusinessStep = ({ data, errors, update }: StepProps) => <>
  <div className="space-y-2"><Label htmlFor="company-name">Company name <span className="text-muted-foreground">(optional)</span></Label><Input id="company-name" value={data.companyName} onChange={(event) => update("companyName", event.target.value)} /></div>
  <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="company-email">Billing email</Label><Input id="company-email" type="email" value={data.companyEmail} onChange={(event) => update("companyEmail", event.target.value)} /><FieldError error={errors.companyEmail} /></div><div className="space-y-2"><Label htmlFor="company-phone">Phone</Label><Input id="company-phone" value={data.companyPhone} onChange={(event) => update("companyPhone", event.target.value)} /></div></div>
  <div className="space-y-2"><Label htmlFor="payment-terms">Default payment terms (days)</Label><Input id="payment-terms" type="number" min="0" max="365" value={data.paymentTerms} onChange={(event) => update("paymentTerms", Number(event.target.value))} /><FieldError error={errors.paymentTerms} /></div>
</>;

const FirstInvoiceStep = ({ data, errors, update }: StepProps) => <>
  <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="invoice-prefix">Invoice prefix</Label><Input id="invoice-prefix" value={data.invoicePrefix} onChange={(event) => update("invoicePrefix", event.target.value)} /><FieldError error={errors.invoicePrefix} /></div><div className="space-y-2"><Label htmlFor="starting-number">Starting number</Label><Input id="starting-number" type="number" min="1" value={data.startingNumber} onChange={(event) => update("startingNumber", Number(event.target.value))} /><FieldError error={errors.startingNumber} /></div></div>
  <RadioGroup value={data.nextAction} onValueChange={(value) => update("nextAction", value as OnboardingData["nextAction"])} className="grid sm:grid-cols-2"><Label htmlFor="create-invoice" className="flex cursor-pointer items-center gap-3 border p-4"><RadioGroupItem id="create-invoice" value="invoice" />Create an invoice next</Label><Label htmlFor="add-client" className="flex cursor-pointer items-center gap-3 border p-4"><RadioGroupItem id="add-client" value="client" />Add my first client</Label></RadioGroup>
  {data.nextAction === "client" && <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="client-name">Client name <span className="text-muted-foreground">(optional)</span></Label><Input id="client-name" value={data.clientName} onChange={(event) => update("clientName", event.target.value)} /></div><div className="space-y-2"><Label htmlFor="client-email">Client email</Label><Input id="client-email" type="email" value={data.clientEmail} onChange={(event) => update("clientEmail", event.target.value)} /><FieldError error={errors.clientEmail} /></div></div>}
</>;

export default Onboarding;
