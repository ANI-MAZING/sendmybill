import { describe, expect, it } from "vitest";
import { createClientsCsv, createInvoicesCsv, escapeCsvCell, parseCsv } from "@/lib/csv";

describe("CSV export", () => {
  it("escapes quotes, commas, and spreadsheet formulas", () => {
    expect(escapeCsvCell('Acme, "West"')).toBe('"Acme, ""West"""');
    expect(escapeCsvCell("=HYPERLINK(\"https://example.test\")")).toBe('"\'=HYPERLINK(""https://example.test"")"');
  });

  it("exports selected invoice fields with derived overdue status", () => {
    const csv = createInvoicesCsv([{
      archived_at: null,
      client_name: "Acme Studio",
      created_at: "2026-08-01T10:00:00Z",
      currency: "INR",
      due_date: "2026-08-28",
      invoice_number: "INV-0001",
      status: "pending",
      total: 1250.5,
    }], new Date(2026, 7, 29));

    expect(csv).toContain('"INV-0001","Acme Studio","overdue","INR","1250.5"');
  });

  it("round-trips client fields containing commas and quotes", () => {
    const csv = createClientsCsv([{
      client_name: 'Acme, "West"', client_email: "billing@acme.test", phone: null,
      client_address: "Mumbai", notes: "Preferred", tags: ["agency", "priority"],
    }]);
    const rows = parseCsv(csv);
    expect(rows[1][0]).toBe('Acme, "West"');
    expect(rows[1][5]).toBe("agency|priority");
  });
});
