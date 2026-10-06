import { z } from "zod";
import { invoiceLineItemSchema } from "@/lib/invoice";
import { toSellerSnapshot } from "@/lib/profile";
import type { InvoiceFormData, SellerSnapshot } from "@/types/domain";

/** The fields needed to render an invoice, shared by the owner and public views. */
export interface RenderableInvoice {
  client_id?: string | null;
  project_id?: string | null;
  document_type: string;
  invoice_number: string;
  client_name: string;
  client_email: string;
  client_address: string | null;
  issue_date: string;
  due_date: string;
  expiry_date: string | null;
  items: unknown;
  discount_type: string | null;
  discount_value: number | null;
  tax_rate: number;
  notes: string | null;
  payment_terms: string | null;
  late_fee_notes: string | null;
  footer_text: string | null;
  template_id: string;
  currency: string;
  seller_snapshot: unknown;
}

const asDate = (value: string) => new Date(`${value}T00:00:00`);

/** Returns null when the stored line items are not safe to render. */
export const toInvoiceFormData = (record: RenderableInvoice): InvoiceFormData | null => {
  const items = z.array(invoiceLineItemSchema).safeParse(record.items);
  if (!items.success) return null;

  const snapshot =
    record.seller_snapshot && typeof record.seller_snapshot === "object" && !Array.isArray(record.seller_snapshot)
      ? (record.seller_snapshot as Partial<Record<keyof SellerSnapshot, string | null>>)
      : {};

  return {
    clientId: record.client_id ?? null,
    projectId: record.project_id ?? null,
    documentType: record.document_type as InvoiceFormData["documentType"],
    invoiceNumber: record.invoice_number,
    clientName: record.client_name,
    clientEmail: record.client_email,
    clientAddress: record.client_address ?? "",
    issueDate: asDate(record.issue_date),
    dueDate: asDate(record.due_date),
    expiryDate: record.expiry_date ? asDate(record.expiry_date) : null,
    items: items.data,
    discountType: (record.discount_type as InvoiceFormData["discountType"]) ?? "fixed",
    discountValue: record.discount_value ?? 0,
    taxRate: record.tax_rate,
    notes: record.notes ?? "",
    paymentTerms: record.payment_terms ?? "",
    lateFeeNotes: record.late_fee_notes ?? "",
    footerText: record.footer_text ?? "",
    templateId: record.template_id as InvoiceFormData["templateId"],
    currency: record.currency,
    sellerSnapshot: toSellerSnapshot(snapshot),
  };
};

export const buildShareUrl = (token: string): string => `${window.location.origin}/i/${token}`;
