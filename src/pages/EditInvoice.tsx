import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import { getInvoiceFieldErrors, invoiceLineItemSchema, invoiceSchema, normalizeInvoice, toDateInputValue, type InvoiceFieldErrors } from "@/lib/invoice";
import { toSellerSnapshot } from "@/lib/profile";
import type { InvoiceFormData, SellerSnapshot } from "@/types/domain";
import { z } from "zod";

const emptyInvoice: InvoiceFormData = {
  clientId: null,
  projectId: null,
  documentType: "invoice",
  invoiceNumber: "",
  clientName: "",
  clientEmail: "",
  clientAddress: "",
  issueDate: new Date(),
  dueDate: new Date(),
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

const EditInvoice = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<InvoiceFieldErrors>({});
  const [formData, setFormData] = useState<InvoiceFormData>(emptyInvoice);

  const fetchInvoice = useCallback(async () => {
    if (!id) {
      navigate("/unauthorized", { replace: true });
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.from("invoices").select("*").eq("id", id).maybeSingle();
    if (error || !data) {
      navigate("/unauthorized", { replace: true });
      return;
    }
    const itemResult = z.array(invoiceLineItemSchema).safeParse(data.items);
    if (!itemResult.success) {
      toast.error("This invoice contains invalid line items and cannot be edited safely.");
      navigate("/dashboard", { replace: true });
      return;
    }
    const rawSnapshot = data.seller_snapshot && typeof data.seller_snapshot === "object" && !Array.isArray(data.seller_snapshot)
      ? data.seller_snapshot as Partial<Record<keyof SellerSnapshot, string | null>>
      : {};
    setFormData({
      clientId: data.client_id,
      projectId: data.project_id,
      documentType: data.document_type as InvoiceFormData["documentType"],
      invoiceNumber: data.invoice_number,
      clientName: data.client_name,
      clientEmail: data.client_email,
      clientAddress: data.client_address || "",
      issueDate: new Date(`${data.issue_date}T00:00:00`),
      dueDate: new Date(`${data.due_date}T00:00:00`),
      expiryDate: data.expiry_date ? new Date(`${data.expiry_date}T00:00:00`) : null,
      items: itemResult.data.map((item) => ({
        description: item.description ?? "",
        quantity: item.quantity ?? 0,
        rate: item.rate ?? 0,
        amount: item.amount ?? 0,
      })),
      discountType: data.discount_type as InvoiceFormData["discountType"] ?? "fixed",
      discountValue: data.discount_value ?? 0,
      taxRate: data.tax_rate,
      notes: data.notes || "",
      paymentTerms: data.payment_terms ?? "",
      lateFeeNotes: data.late_fee_notes ?? "",
      footerText: data.footer_text ?? "",
      templateId: data.template_id as InvoiceFormData["templateId"],
      currency: data.currency || "USD",
      sellerSnapshot: toSellerSnapshot(rawSnapshot),
    });
    setLoading(false);
  }, [id, navigate]);

  useEffect(() => { void fetchInvoice(); }, [fetchInvoice]);

  const totals = calculateInvoiceTotals(formData.items, formData.taxRate, formData.discountType, formData.discountValue);
  const clearError = (path: string) => setErrors((current) => {
    const nextErrors = { ...current };
    delete nextErrors[path];
    return nextErrors;
  });

  const handleUpdate = async () => {
    const validation = invoiceSchema.safeParse(formData);
    if (!validation.success) {
      setErrors(getInvoiceFieldErrors(validation.error));
      toast.error("Please correct the highlighted fields.");
      return;
    }
    const invoice = normalizeInvoice(formData);
    const recalculatedTotals = calculateInvoiceTotals(invoice.items, invoice.taxRate, invoice.discountType, invoice.discountValue);
    setErrors({});
    setSaving(true);
    const { error } = await supabase.from("invoices").update({
      invoice_number: invoice.invoiceNumber,
      client_name: invoice.clientName,
      client_email: invoice.clientEmail,
      client_address: invoice.clientAddress || null,
      client_id: invoice.clientId,
      project_id: invoice.projectId,
      issue_date: toDateInputValue(invoice.issueDate),
      due_date: toDateInputValue(invoice.dueDate),
      expiry_date: invoice.expiryDate ? toDateInputValue(invoice.expiryDate) : null,
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
      currency: invoice.currency,
    }).eq("id", id ?? "");
    setSaving(false);

    if (error) {
      if (error.code === "23505") {
        setErrors({ invoiceNumber: "This invoice number is already in use" });
        toast.error("Choose a unique invoice number.");
      } else {
        toast.error("Invoice couldn’t be updated. Please retry.");
      }
      return;
    }
    toast.success("Invoice updated.");
    navigate(`/dashboard/invoices/${id}`);
  };

  if (loading) return <DashboardLayout><PageLoader label="Loading invoice…" /></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div><h1 className="text-3xl font-bold">Edit Invoice</h1><p className="mt-1 text-muted-foreground">Update invoice details</p></div>
          <div className="flex gap-2"><Button variant="outline" onClick={() => navigate(`/dashboard/invoices/${id}`)}>Cancel</Button><Button onClick={handleUpdate} disabled={saving}>{saving ? "Updating…" : "Update Invoice"}</Button></div>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-6"><InvoiceForm formData={formData} setFormData={setFormData} errors={errors} clearError={clearError} /></Card>
          <div className="lg:sticky lg:top-6 lg:self-start"><InvoicePreview formData={formData} totals={totals} /></div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default EditInvoice;
