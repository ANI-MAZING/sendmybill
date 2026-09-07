import { getInvoiceDisplayStatus } from "@/lib/invoice";

interface CsvInvoice {
  archived_at: string | null;
  client_name: string;
  created_at: string;
  currency: string;
  due_date: string;
  invoice_number: string;
  status: string;
  total: number;
  document_type?: string;
  proforma_status?: string | null;
}

const spreadsheetFormulaPrefix = /^[=+\-@\t\r]/;

export const escapeCsvCell = (value: string | number): string => {
  let text = String(value);
  if (spreadsheetFormulaPrefix.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

export const createInvoicesCsv = (invoices: CsvInvoice[], today = new Date()): string => {
  const rows: Array<Array<string | number>> = [
    ["Invoice Number", "Client", "Status", "Currency", "Total", "Created At", "Due Date"],
    ...invoices.map((invoice) => [
      invoice.invoice_number,
      invoice.client_name,
      invoice.document_type === "proforma" ? invoice.proforma_status ?? "draft" : getInvoiceDisplayStatus(invoice, today),
      invoice.currency,
      invoice.total,
      invoice.created_at,
      invoice.due_date,
    ]),
  ];

  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
};

export const createClientsCsv = (clients: Array<{
  client_name: string;
  client_email: string;
  phone: string | null;
  client_address: string | null;
  notes: string | null;
  tags: string[];
}>): string => {
  const rows: Array<Array<string | number>> = [
    ["client_name", "client_email", "phone", "client_address", "notes", "tags"],
    ...clients.map((client) => [
      client.client_name,
      client.client_email,
      client.phone ?? "",
      client.client_address ?? "",
      client.notes ?? "",
      client.tags.join("|"),
    ]),
  ];
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
};

export const parseCsv = (input: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted && character === '"' && input[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = "";
    } else cell += character;
  }
  row.push(cell);
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
};
