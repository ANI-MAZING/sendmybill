import { describe, expect, it } from "vitest";
import { formatCurrency, getCurrencySymbol } from "@/lib/currencies";

describe("currency formatting", () => {
  it("uses the configured symbol and two decimal places", () => {
    expect(formatCurrency(1250.5, "INR")).toBe("₹1250.50");
    expect(getCurrencySymbol("EUR")).toBe("€");
  });

  it("falls back safely for an unknown currency", () => {
    expect(formatCurrency(10, "UNKNOWN")).toBe("$10.00");
  });
});
