import { z } from "zod";
import { currencies } from "@/lib/currencies";
import { calculateLineAmount } from "@/lib/money";
import {
  INVOICE_STATUSES,
  type InvoiceFormData,
  type InvoiceLineItem,
  type InvoiceStatus,
} from "@/types/domain";

const supportedCurrencies = new Set(currencies.map(({ code }) => code));

export const invoiceLineItemSchema = z.object({
  description: z.string().trim().min(1, "Enter an item description"),
  quantity: z.number().finite().positive("Quantity must be greater than zero"),
  rate: z.number().finite().nonnegative("Rate cannot be negative"),
  amount: z.number().finite().nonnegative(),
});

export const invoiceSchema = z
  .object({
    clientId: z.string().uuid().nullable(),
    projectId: z.string().uuid().nullable(),
    documentType: z.enum(["invoice", "proforma"]),
    invoiceNumber: z
      .string()
      .trim()
      .min(1, "Invoice number is required")
      .max(80),
    clientName: z.string().trim().min(1, "Client name is required").max(200),
    clientEmail: z
      .string()
      .trim()
      .min(1, "Client email is required")
      .email("Enter a valid client email"),
    clientAddress: z.string().trim().max(2_000),
    issueDate: z
      .date({ required_error: "Issue date is required" })
      .refine(
        (date) => !Number.isNaN(date.getTime()),
        "Enter a valid issue date",
      ),
    dueDate: z
      .date({ required_error: "Due date is required" })
      .refine(
        (date) => !Number.isNaN(date.getTime()),
        "Enter a valid due date",
      ),
    expiryDate: z.date().nullable(),
    items: z.array(invoiceLineItemSchema).min(1, "Add at least one line item"),
    discountType: z.enum(["fixed", "percentage"]),
    discountValue: z
      .number()
      .finite()
      .nonnegative("Discount cannot be negative"),
    taxRate: z
      .number()
      .finite()
      .min(0, "Tax cannot be negative")
      .max(100, "Tax cannot exceed 100%"),
    notes: z.string().max(5_000),
    paymentTerms: z.string().max(5_000),
    lateFeeNotes: z.string().max(5_000),
    footerText: z.string().max(5_000),
    templateId: z.enum(["modern", "classic", "minimal"]),
    currency: z
      .string()
      .refine(
        (code) => supportedCurrencies.has(code),
        "Choose a supported currency",
      ),
    sellerSnapshot: z.unknown().optional(),
  })
  .superRefine(
    (
      { issueDate, dueDate, expiryDate, discountType, discountValue },
      context,
    ) => {
      if (dueDate < issueDate) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["dueDate"],
          message: "Due date cannot be earlier than the issue date",
        });
      }
      if (expiryDate && expiryDate < issueDate) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["expiryDate"],
          message: "Expiry date cannot be earlier than the issue date",
        });
      }
      if (discountType === "percentage" && discountValue > 100) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["discountValue"],
          message: "Percentage discount cannot exceed 100%",
        });
      }
    },
  );

export type InvoiceFieldErrors = Record<string, string>;

export const getInvoiceFieldErrors = (error: z.ZodError): InvoiceFieldErrors =>
  error.issues.reduce<InvoiceFieldErrors>((errors, issue) => {
    const path = issue.path.join(".");
    if (path && !errors[path]) errors[path] = issue.message;
    return errors;
  }, {});

export const normalizeInvoice = (
  invoice: InvoiceFormData,
): InvoiceFormData => ({
  ...invoice,
  invoiceNumber: invoice.invoiceNumber.trim(),
  clientName: invoice.clientName.trim(),
  clientEmail: invoice.clientEmail.trim().toLowerCase(),
  clientAddress: invoice.clientAddress.trim(),
  notes: invoice.notes.trim(),
  paymentTerms: invoice.paymentTerms.trim(),
  lateFeeNotes: invoice.lateFeeNotes.trim(),
  footerText: invoice.footerText.trim(),
  items: invoice.items.map<InvoiceLineItem>((item) => ({
    description: item.description.trim(),
    quantity: item.quantity,
    rate: item.rate,
    amount: calculateLineAmount(item.quantity, item.rate),
  })),
});

const statusTransitions: Record<InvoiceStatus, readonly InvoiceStatus[]> = {
  draft: ["draft", "pending"],
  pending: ["draft", "pending"],
  paid: ["pending", "paid"],
};

export const canTransitionInvoiceStatus = (
  from: InvoiceStatus,
  to: InvoiceStatus,
): boolean => statusTransitions[from].includes(to);

export const isInvoiceStatus = (value: string): value is InvoiceStatus =>
  (INVOICE_STATUSES as readonly string[]).includes(value);

interface DatabaseErrorLike {
  code?: string | null;
  message?: string | null;
}

/**
 * PostgREST rejects the complete select when a newly requested column has not
 * reached the deployed database yet. Recognize only schema-shape failures so a
 * legacy select can recover old invoices without masking auth or network errors.
 */
export const isDatabaseSchemaCompatibilityError = (
  error: DatabaseErrorLike | null,
): boolean => {
  if (!error) return false;
  if (["42703", "PGRST204", "PGRST205"].includes(error.code ?? "")) return true;

  const message = error.message?.toLowerCase() ?? "";
  return message.includes("does not exist") || message.includes("schema cache");
};

export type InvoiceDisplayStatus = InvoiceStatus | "overdue" | "archived";

interface InvoiceLifecycleFields {
  archived_at: string | null;
  due_date: string;
  status: string;
}

export const getInvoiceDisplayStatus = (
  invoice: InvoiceLifecycleFields,
  today = new Date(),
): InvoiceDisplayStatus => {
  if (invoice.archived_at) return "archived";
  if (invoice.status === "paid") return "paid";

  const dueDate = fromDateInputValue(invoice.due_date);
  const currentDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  if (invoice.status === "pending" && dueDate < currentDate) return "overdue";

  return isInvoiceStatus(invoice.status) ? invoice.status : "draft";
};

export const toDateInputValue = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const fromDateInputValue = (value: string): Date =>
  new Date(`${value}T00:00:00`);
