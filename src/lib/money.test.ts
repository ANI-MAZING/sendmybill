import { describe, expect, it } from "vitest";
import {
  calculateInvoiceTotals,
  calculateLineAmount,
  roundMoney,
} from "@/lib/money";

describe("invoice money calculations", () => {
  it("calculates line amounts from quantity and rate", () => {
    expect(calculateLineAmount(2.5, 19.99)).toBe(49.98);
  });

  it("recalculates subtotal, tax, and total without trusting submitted amounts", () => {
    expect(
      calculateInvoiceTotals(
        [
          { quantity: 2, rate: 12.5 },
          { quantity: 3, rate: 4.25 },
        ],
        18,
      ),
    ).toEqual({
      subtotal: 37.75,
      discountAmount: 0,
      taxAmount: 6.8,
      total: 44.55,
    });
  });

  it("applies fixed and percentage discounts before tax", () => {
    expect(
      calculateInvoiceTotals([{ quantity: 1, rate: 100 }], 10, "fixed", 15),
    ).toEqual({
      subtotal: 100,
      discountAmount: 15,
      taxAmount: 8.5,
      total: 93.5,
    });
    expect(
      calculateInvoiceTotals(
        [{ quantity: 1, rate: 100 }],
        10,
        "percentage",
        25,
      ),
    ).toEqual({
      subtotal: 100,
      discountAmount: 25,
      taxAmount: 7.5,
      total: 82.5,
    });
  });

  it("rounds floating-point results to minor units", () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
  });
});
