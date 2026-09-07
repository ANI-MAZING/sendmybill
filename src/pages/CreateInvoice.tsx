import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import InvoiceForm from "@/components/invoice/InvoiceForm";
import InvoicePreview from "@/components/invoice/InvoicePreview";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageLoader } from "@/components/shared/AsyncState";
import { calculateInvoiceTotals } from "@/lib/money";
import {
  getInvoiceFieldErrors,
  invoiceSchema,
  normalizeInvoice,
  toDateInputValue,
  type InvoiceFieldErrors,
} from "@/lib/invoice";
import { toSellerSnapshot } from "@/lib/profile";
import type { InvoiceFormData } from "@/types/domain";

const today = new Date();

const initialFormData: InvoiceFormData = {
  clientId: null,
  projectId: null,
  documentType: "invoice",
  invoiceNumber: "INV-0001",
  clientName: "",
  clientEmail: "",
  clientAddress: "",
  issueDate: today,
  dueDate: new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 30,
  ),
  expiryDate: null,
  items: [{ description: "", quantity: 1, rate: 0, amount: 0 }],
  discountType: "fixed",
  discountValue: 0,
  taxRate: 0,
  notes: "",
  paymentTerms: "",
  lateFeeNotes: "",
  footerText: "",
  templateId: "modern",
  currency: "USD",
};

const CreateInvoice = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState<InvoiceFormData>(initialFormData);
  const [errors, setErrors] = useState<InvoiceFieldErrors>({});
  const [loadingDefaults, setLoadingDefaults] = useState(true);
  const [saving, setSaving] = useState(false);
  const [numberSequence, setNumberSequence] = useState<{
    generated: string;
    next: number;
    kind: "invoice" | "proforma";
  } | null>(null);
  const [sourceTimeEntryIds, setSourceTimeEntryIds] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    const loadDefaults = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "company_name, company_address, company_phone, company_email, tax_id, bank_name, bank_account_number, bank_routing_number, bank_swift_code, company_logo_url, signature_url, invoice_accent_color, invoice_font, default_currency, default_payment_terms, default_tax_rate, invoice_prefix, invoice_next_number, proforma_prefix, proforma_next_number",
        )
        .eq("id", user.id)
        .single();
      if (!mounted) return;
      if (error || !data) {
        toast.error(
          "Invoice defaults couldn’t be loaded. You can still enter them manually.",
        );
        setLoadingDefaults(false);
        return;
      }
      const documentType =
        searchParams.get("type") === "proforma" ? "proforma" : "invoice";
      const nextNumber =
        documentType === "proforma"
          ? data.proforma_next_number
          : data.invoice_next_number;
      const prefix =
        documentType === "proforma"
          ? data.proforma_prefix
          : data.invoice_prefix;
      const generatedNumber = `${prefix}${String(nextNumber).padStart(4, "0")}`;
      const issueDate = new Date();
      const paymentTerms = data.default_payment_terms ?? 30;
      setFormData((current) => ({
        ...current,
        documentType,
        invoiceNumber: generatedNumber,
        currency: data.default_currency ?? "USD",
        taxRate: data.default_tax_rate ?? 0,
        issueDate,
        dueDate: new Date(
          issueDate.getFullYear(),
          issueDate.getMonth(),
          issueDate.getDate() + paymentTerms,
        ),
        sellerSnapshot: toSellerSnapshot(data),
      }));
      setNumberSequence({
        generated: generatedNumber,
        next: nextNumber,
        kind: documentType,
      });

      const projectId = searchParams.get("project");
      const clientId = searchParams.get("client");
      if (projectId) {
        const { data: project } = await supabase
          .from("projects")
          .select("id, client_id, currency")
          .eq("id", projectId)
          .maybeSingle();
        if (project) {
          const { data: client } = await supabase
            .from("clients")
            .select("id, client_name, client_email, client_address")
            .eq("id", project.client_id)
            .maybeSingle();
          if (client && mounted)
            setFormData((current) => ({
              ...current,
              projectId: project.id,
              clientId: client.id,
              clientName: client.client_name,
              clientEmail: client.client_email,
              clientAddress: client.client_address ?? "",
              currency: project.currency,
            }));
        }
      } else if (clientId) {
        const { data: client } = await supabase
          .from("clients")
          .select("id, client_name, client_email, client_address")
          .eq("id", clientId)
          .maybeSingle();
        if (client && mounted)
          setFormData((current) => ({
            ...current,
            clientId: client.id,
            clientName: client.client_name,
            clientEmail: client.client_email,
            clientAddress: client.client_address ?? "",
          }));
      }

      const timeEntryIds = (searchParams.get("timeEntries") ?? "")
        .split(",")
        .filter(Boolean);
      if (timeEntryIds.length) {
        const { data: entries } = await supabase
          .from("time_entries")
          .select("id, project_id, duration_minutes, hourly_rate, notes")
          .in("id", timeEntryIds)
          .is("invoice_id", null)
          .eq("billable", true);
        if (entries?.length && mounted) {
          setSourceTimeEntryIds(entries.map(({ id }) => id));
          setFormData((current) => ({
            ...current,
            projectId: current.projectId ?? entries[0].project_id,
            items: entries.map((entry) => ({
              description: entry.notes || `Time entry ${entry.id.slice(0, 8)}`,
              quantity: entry.duration_minutes / 60,
              rate: entry.hourly_rate,
              amount: (entry.duration_minutes / 60) * entry.hourly_rate,
            })),
          }));
        }
      }
      setLoadingDefaults(false);
    };
    void loadDefaults();
    return () => {
      mounted = false;
    };
  }, [searchParams]);

  const totals = calculateInvoiceTotals(
    formData.items,
    formData.taxRate,
    formData.discountType,
    formData.discountValue,
  );

  const clearError = (path: string) =>
    setErrors((current) => {
      if (!current[path]) return current;
      const nextErrors = { ...current };
      delete nextErrors[path];
      return nextErrors;
    });

  const handleSave = async () => {
    const validation = invoiceSchema.safeParse(formData);
    if (!validation.success) {
      setErrors(getInvoiceFieldErrors(validation.error));
      toast.error("Please correct the highlighted fields.");
      return;
    }

    const invoice = normalizeInvoice(formData);
    const recalculatedTotals = calculateInvoiceTotals(
      invoice.items,
      invoice.taxRate,
      invoice.discountType,
      invoice.discountValue,
    );
    setErrors({});
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      toast.error("Your session has expired. Please sign in again.");
      navigate("/auth", { replace: true });
      return;
    }

    const { data: createdInvoice, error } = await supabase
      .from("invoices")
      .insert({
        user_id: user.id,
        client_id: invoice.clientId,
        project_id: invoice.projectId,
        document_type: invoice.documentType,
        proforma_status: invoice.documentType === "proforma" ? "draft" : null,
        invoice_number: invoice.invoiceNumber,
        client_name: invoice.clientName,
        client_email: invoice.clientEmail,
        client_address: invoice.clientAddress || null,
        issue_date: toDateInputValue(invoice.issueDate),
        due_date: toDateInputValue(invoice.dueDate),
        expiry_date: invoice.expiryDate
          ? toDateInputValue(invoice.expiryDate)
          : null,
        items: invoice.items as unknown as Json,
        subtotal: recalculatedTotals.subtotal,
        discount_type: invoice.discountType,
        discount_value: invoice.discountValue,
        discount_amount: recalculatedTotals.discountAmount,
        tax_rate: invoice.taxRate,
        tax_amount: recalculatedTotals.taxAmount,
        total: recalculatedTotals.total,
        notes: invoice.notes || null,
        payment_terms: invoice.paymentTerms || null,
        late_fee_notes: invoice.lateFeeNotes || null,
        footer_text: invoice.footerText || null,
        template_id: invoice.templateId,
        status: "draft",
        currency: invoice.currency,
        seller_snapshot: (invoice.sellerSnapshot ?? {}) as unknown as Json,
      })
      .select("id")
      .single();

    if (!error && numberSequence?.generated === invoice.invoiceNumber) {
      if (numberSequence.kind === "proforma")
        await supabase
          .from("profiles")
          .update({ proforma_next_number: numberSequence.next + 1 })
          .eq("id", user.id)
          .eq("proforma_next_number", numberSequence.next);
      else
        await supabase
          .from("profiles")
          .update({ invoice_next_number: numberSequence.next + 1 })
          .eq("id", user.id)
          .eq("invoice_next_number", numberSequence.next);
    }
    setSaving(false);

    if (error) {
      if (error.code === "23505") {
        setErrors({ invoiceNumber: "This invoice number is already in use" });
        toast.error("Choose a unique invoice number.");
      } else {
        toast.error("Invoice couldn’t be saved. Please retry.");
      }
      return;
    }
    if (createdInvoice && sourceTimeEntryIds.length)
      await supabase
        .from("time_entries")
        .update({ invoice_id: createdInvoice.id })
        .in("id", sourceTimeEntryIds)
        .is("invoice_id", null);
    toast.success(
      invoice.documentType === "proforma"
        ? "Proforma saved."
        : "Invoice saved.",
    );
    navigate(
      createdInvoice
        ? `/dashboard/invoices/${createdInvoice.id}`
        : "/dashboard",
    );
  };

  if (loadingDefaults)
    return (
      <DashboardLayout>
        <PageLoader label="Preparing your invoice…" />
      </DashboardLayout>
    );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">
              Create{" "}
              {formData.documentType === "proforma" ? "Proforma" : "Invoice"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
              Fill in the details below
            </p>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button
              variant="outline"
              onClick={() => navigate("/dashboard")}
              className="flex-1 sm:flex-none"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 sm:flex-none"
            >
              {saving
                ? "Saving…"
                : `Save ${formData.documentType === "proforma" ? "Proforma" : "Invoice"}`}
            </Button>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-4 sm:p-6">
            <InvoiceForm
              formData={formData}
              setFormData={setFormData}
              errors={errors}
              clearError={clearError}
            />
          </Card>
          <div className="lg:sticky lg:top-6 lg:self-start">
            <InvoicePreview formData={formData} totals={totals} />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CreateInvoice;
