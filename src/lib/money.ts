import type {
  InvoiceFormData,
  InvoiceLineItem,
  InvoiceTotals,
} from "@/types/domain";

const MONEY_PRECISION = 100;

export const roundMoney = (value: number): number =>
  Math.round(
    (value + Math.sign(value) * Number.EPSILON * Math.abs(value)) *
      MONEY_PRECISION,
  ) / MONEY_PRECISION;

export const calculateLineAmount = (quantity: number, rate: number): number =>
  roundMoney(quantity * rate);

export const calculateInvoiceTotals = (
  items: Pick<InvoiceLineItem, "quantity" | "rate">[],
  taxRate: number,
  discountType: InvoiceFormData["discountType"] = "fixed",
  discountValue = 0,
): InvoiceTotals => {
  const subtotal = roundMoney(
    items.reduce(
      (sum, item) => sum + calculateLineAmount(item.quantity, item.rate),
      0,
    ),
  );
  const discountAmount = roundMoney(
    Math.min(
      subtotal,
      discountType === "percentage"
        ? (subtotal * discountValue) / 100
        : discountValue,
    ),
  );
  const taxableSubtotal = roundMoney(subtotal - discountAmount);
  const taxAmount = roundMoney((taxableSubtotal * taxRate) / 100);

  return {
    subtotal,
    discountAmount,
    taxAmount,
    total: roundMoney(taxableSubtotal + taxAmount),
  };
};
