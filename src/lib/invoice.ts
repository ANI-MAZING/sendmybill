import { z } from "zod";
import { currencies } from "@/lib/currencies";
import { calculateLineAmount } from "@/lib/money";
import { INVOICE_STATUSES, type InvoiceFormData, type InvoiceLineItem, type InvoiceStatus } from "@/types/domain";

const supportedCurrencies = new Set(currencies.map(({ code }) => code));

export const invoiceLineItemSchema = z.object({
  description: z.string().trim().min(1, "Enter an item description"),
  quantity: z.number().finite().positive("Quantity must be greater than zero"),
  rate: z.number().finite().nonnegative("Rate cannot be negative"),
  amount: z.number().finite().nonnegative(),
});

export const invoiceSchema = z
  .object({
    invoiceNumber: z.string().trim().min(1, "Invoice number is required").max(80),
    clientName: z.string().trim().min(1, "Client name is required").max(200),
    clientEmail: z.string().trim().min(1, "Client email is required").email("Enter a valid client email"),
    clientAddress: z.string().trim().max(2_000),
    issueDate: z.date({ required_error: "Issue date is required" }).refine((date) => !Number.isNaN(date.getTime()), "Enter a valid issue date"),
    dueDate: z.date({ required_error: "Due date is required" }).refine((date) => !Number.isNaN(date.getTime()), "Enter a valid due date"),
    items: z.array(invoiceLineItemSchema).min(1, "Add at least one line item"),
    taxRate: z.number().finite().min(0, "Tax cannot be negative").max(100, "Tax cannot exceed 100%"),
    notes: z.string().max(5_000),
    templateId: z.enum(["modern", "classic", "minimal"]),
    currency: z.string().refine((code) => supportedCurrencies.has(code), "Choose a supported currency"),
    sellerSnapshot: z.unknown().optional(),
  })
  .superRefine(({ issueDate, dueDate }, context) => {
    if (dueDate < issueDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dueDate"],
        message: "Due date cannot be earlier than the issue date",
      });
    }
  });

export type InvoiceFieldErrors = Record<string, string>;

export const getInvoiceFieldErrors = (error: z.ZodError): InvoiceFieldErrors =>
  error.issues.reduce<InvoiceFieldErrors>((errors, issue) => {
    const path = issue.path.join(".");
    if (path && !errors[path]) errors[path] = issue.message;
    return errors;
  }, {});

export const normalizeInvoice = (invoice: InvoiceFormData): InvoiceFormData => ({
  ...invoice,
  invoiceNumber: invoice.invoiceNumber.trim(),
  clientName: invoice.clientName.trim(),
  clientEmail: invoice.clientEmail.trim().toLowerCase(),
  clientAddress: invoice.clientAddress.trim(),
  notes: invoice.notes.trim(),
  items: invoice.items.map<InvoiceLineItem>((item) => ({
    description: item.description.trim(),
    quantity: item.quantity,
    rate: item.rate,
    amount: calculateLineAmount(item.quantity, item.rate),
  })),
});

const statusTransitions: Record<InvoiceStatus, readonly InvoiceStatus[]> = {
  draft: ["draft", "pending"],
  pending: ["draft", "pending", "paid"],
  paid: ["pending", "paid"],
};

export const canTransitionInvoiceStatus = (from: InvoiceStatus, to: InvoiceStatus): boolean =>
  statusTransitions[from].includes(to);

export const isInvoiceStatus = (value: string): value is InvoiceStatus =>
  (INVOICE_STATUSES as readonly string[]).includes(value);

export const toDateInputValue = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const fromDateInputValue = (value: string): Date => new Date(`${value}T00:00:00`);
