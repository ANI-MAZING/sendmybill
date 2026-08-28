import { describe, expect, it } from "vitest";
import { calculateInvoiceTotals, calculateLineAmount, roundMoney } from "@/lib/money";

describe("invoice money calculations", () => {
  it("calculates line amounts from quantity and rate", () => {
    expect(calculateLineAmount(2.5, 19.99)).toBe(49.98);
  });

  it("recalculates subtotal, tax, and total without trusting submitted amounts", () => {
    expect(calculateInvoiceTotals([
      { quantity: 2, rate: 12.5 },
      { quantity: 3, rate: 4.25 },
    ], 18)).toEqual({ subtotal: 37.75, taxAmount: 6.8, total: 44.55 });
  });

  it("rounds floating-point results to minor units", () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
  });
});
