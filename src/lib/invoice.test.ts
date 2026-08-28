import { describe, expect, it } from "vitest";
import { canTransitionInvoiceStatus, invoiceSchema, normalizeInvoice } from "@/lib/invoice";
import type { InvoiceFormData } from "@/types/domain";

const validInvoice = (): InvoiceFormData => ({
  invoiceNumber: "INV-0001",
  clientName: "Acme Studio",
  clientEmail: "billing@acme.test",
  clientAddress: "Mumbai",
  issueDate: new Date(2026, 7, 28),
  dueDate: new Date(2026, 8, 27),
  items: [{ description: "Design work", quantity: 2, rate: 250, amount: 1 }],
  taxRate: 18,
  notes: "Thank you",
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
    expect(canTransitionInvoiceStatus("pending", "paid")).toBe(true);
    expect(canTransitionInvoiceStatus("paid", "pending")).toBe(true);
  });

  it("prevents skipping directly from draft to paid", () => {
    expect(canTransitionInvoiceStatus("draft", "paid")).toBe(false);
  });
});
