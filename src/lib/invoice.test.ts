import { describe, expect, it } from "vitest";
import {
  canTransitionInvoiceStatus,
  getInvoiceDisplayStatus,
  invoiceSchema,
  isDatabaseSchemaCompatibilityError,
  normalizeInvoice,
} from "@/lib/invoice";
import type { InvoiceFormData } from "@/types/domain";

const validInvoice = (): InvoiceFormData => ({
  clientId: null,
  projectId: null,
  documentType: "invoice",
  invoiceNumber: "INV-0001",
  clientName: "Acme Studio",
  clientEmail: "billing@acme.test",
  clientAddress: "Mumbai",
  issueDate: new Date(2026, 7, 28),
  dueDate: new Date(2026, 8, 27),
  expiryDate: null,
  items: [{ description: "Design work", quantity: 2, rate: 250, amount: 1 }],
  taxRate: 18,
  notes: "Thank you",
  paymentTerms: "Due within 30 days",
  lateFeeNotes: "Late balances may incur a fee",
  footerText: "Thank you for your business",
  templateId: "modern",
  currency: "INR",
});

describe("invoice validation", () => {
  it("accepts a complete invoice", () => {
    expect(invoiceSchema.safeParse(validInvoice()).success).toBe(true);
  });

  it("rejects missing line-item details, invalid tax, and unsupported currency", () => {
    const invoice = validInvoice();
    invoice.items[0].description = "";
    invoice.taxRate = 101;
    invoice.currency = "XYZ";
    const result = invoiceSchema.safeParse(invoice);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map(({ path }) => path.join("."))).toEqual(expect.arrayContaining(["items.0.description", "taxRate", "currency"]));
  });

  it("rejects a due date earlier than the issue date", () => {
    const invoice = validInvoice();
    invoice.dueDate = new Date(2026, 7, 27);
    expect(invoiceSchema.safeParse(invoice).success).toBe(false);
  });

  it("normalizes text and recomputes every line amount", () => {
    const invoice = validInvoice();
    invoice.clientEmail = "  BILLING@ACME.TEST ";
    expect(normalizeInvoice(invoice).clientEmail).toBe("billing@acme.test");
    expect(normalizeInvoice(invoice).items[0].amount).toBe(500);
  });
});

describe("invoice status transitions", () => {
  it("allows the supported workflow", () => {
    expect(canTransitionInvoiceStatus("draft", "pending")).toBe(true);
    expect(canTransitionInvoiceStatus("paid", "pending")).toBe(true);
  });

  it("prevents skipping directly from draft to paid", () => {
    expect(canTransitionInvoiceStatus("draft", "paid")).toBe(false);
    expect(canTransitionInvoiceStatus("pending", "paid")).toBe(false);
  });
});

describe("invoice display status", () => {
  const today = new Date(2026, 7, 29, 15, 30);

  it("marks an unpaid invoice overdue after its due date", () => {
    expect(getInvoiceDisplayStatus({ archived_at: null, due_date: "2026-08-28", status: "pending" }, today)).toBe("overdue");
  });

  it("does not mark an invoice overdue on its due date", () => {
    expect(getInvoiceDisplayStatus({ archived_at: null, due_date: "2026-08-29", status: "pending" }, today)).toBe("pending");
  });

  it("keeps an unsent draft in draft even after its due date", () => {
    expect(getInvoiceDisplayStatus({ archived_at: null, due_date: "2026-08-01", status: "draft" }, today)).toBe("draft");
  });

  it("keeps paid invoices paid even when their due date has passed", () => {
    expect(getInvoiceDisplayStatus({ archived_at: null, due_date: "2026-08-01", status: "paid" }, today)).toBe("paid");
  });

  it("gives archived invoices precedence over payment status", () => {
    expect(getInvoiceDisplayStatus({ archived_at: "2026-08-29T10:00:00Z", due_date: "2026-08-01", status: "paid" }, today)).toBe("archived");
  });
});

describe("database schema compatibility", () => {
  it("recognizes missing-column responses that can use a legacy invoice query", () => {
    expect(isDatabaseSchemaCompatibilityError({ code: "42703", message: "column invoices.archived_at does not exist" })).toBe(true);
    expect(isDatabaseSchemaCompatibilityError({ code: "PGRST204", message: "Could not find a column in the schema cache" })).toBe(true);
  });

  it("does not hide authentication or connection failures behind the fallback", () => {
    expect(isDatabaseSchemaCompatibilityError({ code: "42501", message: "permission denied" })).toBe(false);
    expect(isDatabaseSchemaCompatibilityError({ message: "Failed to fetch" })).toBe(false);
  });
});
