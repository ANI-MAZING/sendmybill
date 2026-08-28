export const INVOICE_STATUSES = ["draft", "pending", "paid"] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface SellerSnapshot {
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  tax_id: string;
  bank_name: string;
  bank_account_number: string;
  bank_routing_number: string;
  bank_swift_code: string;
  company_logo_url: string | null;
  signature_url: string | null;
}

export interface InvoiceFormData {
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  clientAddress: string;
  issueDate: Date;
  dueDate: Date;
  items: InvoiceLineItem[];
  taxRate: number;
  notes: string;
  templateId: "modern" | "classic" | "minimal";
  currency: string;
  sellerSnapshot?: SellerSnapshot;
}

export interface InvoiceTotals {
  subtotal: number;
  taxAmount: number;
  total: number;
}

export interface ProfileData extends SellerSnapshot {
  full_name?: string;
  billing_mode?: "business" | "personal";
  country_code?: string;
  default_currency?: string;
  default_payment_terms?: number;
  invoice_prefix?: string;
  invoice_next_number?: number;
  onboarding_completed?: boolean;
}
