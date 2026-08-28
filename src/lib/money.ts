import type { InvoiceLineItem, InvoiceTotals } from "@/types/domain";

const MONEY_PRECISION = 100;

export const roundMoney = (value: number): number =>
  Math.round((value + Math.sign(value) * Number.EPSILON * Math.abs(value)) * MONEY_PRECISION) / MONEY_PRECISION;

export const calculateLineAmount = (quantity: number, rate: number): number =>
  roundMoney(quantity * rate);

export const calculateInvoiceTotals = (
  items: Pick<InvoiceLineItem, "quantity" | "rate">[],
  taxRate: number,
): InvoiceTotals => {
  const subtotal = roundMoney(
    items.reduce((sum, item) => sum + calculateLineAmount(item.quantity, item.rate), 0),
  );
  const taxAmount = roundMoney((subtotal * taxRate) / 100);

  return {
    subtotal,
    taxAmount,
    total: roundMoney(subtotal + taxAmount),
  };
};
