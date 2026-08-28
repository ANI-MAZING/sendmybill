import { useCallback, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Upload, X, Image, PenTool } from "lucide-react";
import { currencies } from "@/lib/currencies";
import { getCompanyAssetExtension, getCompanyAssetPath, validateCompanyAsset } from "@/lib/storage";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const profileSchema = z.object({
  full_name: z.string().optional(),
  company_name: z.string().optional(),
  company_address: z.string().optional(),
  company_phone: z.string().optional(),
  company_email: z.string().email().optional().or(z.literal("")),
  tax_id: z.string().optional(),
  bank_name: z.string().optional(),
  bank_account_number: z.string().optional(),
  bank_routing_number: z.string().optional(),
  bank_swift_code: z.string().optional(),
  default_currency: z.string().min(3),
  default_payment_terms: z.coerce.number().int().min(0).max(365),
  invoice_prefix: z.string().trim().min(1).max(20).regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers, and hyphens only"),
  invoice_next_number: z.coerce.number().int().positive(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const signedUrlFor = async (pathOrUrl: string | null) => {
  if (!pathOrUrl || pathOrUrl.startsWith("http")) return pathOrUrl;
  const { data, error } = await supabase.storage.from("company-assets").createSignedUrl(pathOrUrl, 60 * 60);
  return error ? null : data.signedUrl;
};

export default function ProfileSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [signaturePath, setSignaturePath] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: "",
      company_name: "",
      company_address: "",
      company_phone: "",
      company_email: "",
      tax_id: "",
      bank_name: "",
      bank_account_number: "",
      bank_routing_number: "",
      bank_swift_code: "",
      default_currency: "USD",
      default_payment_terms: 30,
      invoice_prefix: "INV-",
      invoice_next_number: 1,
    },
  });

  const fetchProfile = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      if (data) {
        form.reset({
          full_name: data.full_name || "",
          company_name: data.company_name || "",
          company_address: data.company_address || "",
          company_phone: data.company_phone || "",
          company_email: data.company_email || "",
          tax_id: data.tax_id || "",
          bank_name: data.bank_name || "",
          bank_account_number: data.bank_account_number || "",
          bank_routing_number: data.bank_routing_number || "",
          bank_swift_code: data.bank_swift_code || "",
          default_currency: data.default_currency || "USD",
          default_payment_terms: data.default_payment_terms ?? 30,
          invoice_prefix: data.invoice_prefix || "INV-",
          invoice_next_number: data.invoice_next_number ?? 1,
        });
        const nextLogoPath = getCompanyAssetPath(data.company_logo_url);
        const nextSignaturePath = getCompanyAssetPath(data.signature_url);
        setLogoPath(nextLogoPath);
        setSignaturePath(nextSignaturePath);
        const [nextLogoUrl, nextSignatureUrl] = await Promise.all([
          signedUrlFor(data.company_logo_url),
          signedUrlFor(data.signature_url),
        ]);
        setLogoUrl(nextLogoUrl);
        setSignatureUrl(nextSignatureUrl);
      }
    } catch {
      toast.error("Error loading profile");
    } finally {
      setLoading(false);
    }
  }, [form, navigate]);

  useEffect(() => { void fetchProfile(); }, [fetchProfile]);

  const uploadFile = async (file: File, type: "logo" | "signature") => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const validationError = validateCompanyAsset(file);
    if (validationError) throw new Error(validationError);
    const fileName = `${user.id}/${type}-${Date.now()}.${getCompanyAssetExtension(file)}`;

    const { error: uploadError } = await supabase.storage
      .from("company-assets")
      .upload(fileName, file, { upsert: true, contentType: file.type, cacheControl: "3600" });

    if (uploadError) throw uploadError;

    const { data, error: signedUrlError } = await supabase.storage.from("company-assets").createSignedUrl(fileName, 60 * 60);
    if (signedUrlError) {
      await supabase.storage.from("company-assets").remove([fileName]);
      throw signedUrlError;
    }
    return { path: fileName, signedUrl: data.signedUrl };
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingLogo(true);
      const uploaded = await uploadFile(file, "logo");

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from("profiles")
          .update({ company_logo_url: uploaded.path })
          .eq("id", user.id);
        if (error) {
          await supabase.storage.from("company-assets").remove([uploaded.path]);
          throw error;
        }
      }
      if (logoPath && logoPath !== uploaded.path) await supabase.storage.from("company-assets").remove([logoPath]);
      setLogoPath(uploaded.path);
      setLogoUrl(uploaded.signedUrl);
      toast.success("Logo uploaded successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error uploading logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingSignature(true);
      const uploaded = await uploadFile(file, "signature");

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from("profiles")
          .update({ signature_url: uploaded.path })
          .eq("id", user.id);
        if (error) {
          await supabase.storage.from("company-assets").remove([uploaded.path]);
          throw error;
        }
      }
      if (signaturePath && signaturePath !== uploaded.path) await supabase.storage.from("company-assets").remove([signaturePath]);
      setSignaturePath(uploaded.path);
      setSignatureUrl(uploaded.signedUrl);
      toast.success("Signature uploaded successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error uploading signature");
    } finally {
      setUploadingSignature(false);
    }
  };

  const removeLogo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from("profiles")
          .update({ company_logo_url: null })
          .eq("id", user.id);
        if (error) throw error;
      }
      if (logoPath) await supabase.storage.from("company-assets").remove([logoPath]);
      setLogoPath(null);
      setLogoUrl(null);
      toast.success("Logo removed");
    } catch (error) {
      toast.error("Error removing logo");
    }
  };

  const removeSignature = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from("profiles")
          .update({ signature_url: null })
          .eq("id", user.id);
        if (error) throw error;
      }
      if (signaturePath) await supabase.storage.from("company-assets").remove([signaturePath]);
      setSignaturePath(null);
      setSignatureUrl(null);
      toast.success("Signature removed");
    } catch (error) {
      toast.error("Error removing signature");
    }
  };

  const onSubmit = async (values: ProfileFormValues) => {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("profiles")
        .update({ ...values, invoice_prefix: values.invoice_prefix.toUpperCase() })
        .eq("id", user.id);

      if (error) throw error;

      toast.success("Profile updated successfully");
    } catch {
      toast.error("Error updating profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 max-w-4xl mx-auto p-4 sm:p-6">
          <div className="space-y-2">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-5 w-96" />
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
              <Skeleton className="h-24 w-full" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto p-4 sm:p-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Profile Settings</h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">
            Manage your company information and bank details for invoices
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Logo and Signature Card */}
            <Card>
              <CardHeader>
                <CardTitle>Branding</CardTitle>
                <CardDescription>
                  Upload your company logo and signature for invoices
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Logo Upload */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Image className="h-4 w-4" />
                      Company Logo
                    </label>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    {logoUrl ? (
                      <div className="relative w-full h-32 border border-border rounded-lg overflow-hidden bg-muted">
                        <img
                          src={logoUrl}
                          alt="Company Logo"
                          className="w-full h-full object-contain p-2"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-6 w-6"
                          onClick={removeLogo}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full h-32 border-dashed"
                        onClick={() => logoInputRef.current?.click()}
                        disabled={uploadingLogo}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <Upload className="h-6 w-6 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {uploadingLogo ? "Uploading..." : "Upload Logo"}
                          </span>
                        </div>
                      </Button>
                    )}
                  </div>

                  {/* Signature Upload */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <PenTool className="h-4 w-4" />
                      Signature
                    </label>
                    <input
                      ref={signatureInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleSignatureUpload}
                      className="hidden"
                    />
                    {signatureUrl ? (
                      <div className="relative w-full h-32 border border-border rounded-lg overflow-hidden bg-muted">
                        <img
                          src={signatureUrl}
                          alt="Signature"
                          className="w-full h-full object-contain p-2"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-6 w-6"
                          onClick={removeSignature}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full h-32 border-dashed"
                        onClick={() => signatureInputRef.current?.click()}
                        disabled={uploadingSignature}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <Upload className="h-6 w-6 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {uploadingSignature ? "Uploading..." : "Upload Signature"}
                          </span>
                        </div>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
                <CardDescription>
                  This information will appear on all your invoices
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="full_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Your Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="company_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Acme Inc." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="company_address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Address</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="123 Business St, Suite 100&#10;City, State 12345&#10;Country"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="company_phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input placeholder="+1 (555) 123-4567" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="company_email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="contact@company.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="tax_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax ID / Business Registration</FormLabel>
                      <FormControl>
                        <Input placeholder="123-45-6789" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Invoice Defaults</CardTitle>
                <CardDescription>
                  New invoices use these values. You can still change them on each invoice.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="default_currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Currency</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent className="max-h-64">{currencies.map((currency) => <SelectItem key={currency.code} value={currency.code}>{currency.code} — {currency.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="default_payment_terms"
                    render={({ field }) => (
                      <FormItem><FormLabel>Default Payment Terms (days)</FormLabel><FormControl><Input type="number" min="0" max="365" {...field} /></FormControl><FormMessage /></FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="invoice_prefix"
                    render={({ field }) => (
                      <FormItem><FormLabel>Invoice Prefix</FormLabel><FormControl><Input placeholder="INV-" {...field} /></FormControl><FormMessage /></FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="invoice_next_number"
                    render={({ field }) => (
                      <FormItem><FormLabel>Next Invoice Number</FormLabel><FormControl><Input type="number" min="1" {...field} /></FormControl><FormMessage /></FormItem>
                    )}
                  />
                </div>
                <p className="text-sm text-muted-foreground">Example: {form.watch("invoice_prefix") || "INV-"}{String(form.watch("invoice_next_number") || 1).padStart(4, "0")}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Bank Details</CardTitle>
                <CardDescription>
                  Optional payment information displayed on invoices. Only store it if clients need it to pay you.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="bank_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bank Name</FormLabel>
                      <FormControl>
                        <Input placeholder="First National Bank" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="bank_account_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Number</FormLabel>
                        <FormControl>
                          <Input placeholder="1234567890" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bank_routing_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Routing Number</FormLabel>
                        <FormControl>
                          <Input placeholder="021000021" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="bank_swift_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SWIFT/BIC Code (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="ABCDUS33XXX" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => navigate("/dashboard")}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </DashboardLayout>
  );
}
