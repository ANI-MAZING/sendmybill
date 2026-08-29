import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Plus, Search, Trash2, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { PageLoader } from "@/components/shared/AsyncState";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { escapeCsvCell } from "@/lib/csv";
import { currencies, formatCurrency } from "@/lib/currencies";

type Payment = Tables<"payments">;
type Allocation = Tables<"payment_allocations">;
type Expense = Tables<"expenses">;
type Invoice = Pick<Tables<"invoices">, "id" | "invoice_number" | "client_name" | "project_id" | "total" | "currency" | "document_type">;
type Project = Pick<Tables<"projects">, "id" | "name" | "client_id" | "currency">;
type Client = Pick<Tables<"clients">, "id" | "client_name">;
type Category = Tables<"expense_categories">;
type Audit = Tables<"financial_audit_log">;
type DeleteTarget = { kind: "payment"; record: Payment } | { kind: "expense"; record: Expense };

const paymentInitial = { payment_date: new Date().toISOString().slice(0, 10), amount: 0, currency: "USD", method: "bank_transfer", reference: "", payer: "", notes: "", attachment_path: "", client_id: "none", project_id: "none" };
const expenseInitial = { expense_date: new Date().toISOString().slice(0, 10), amount: 0, tax_amount: 0, currency: "USD", vendor: "", notes: "", receipt_path: "", project_id: "none", category: "General", is_recurring: false, recurrence_note: "" };

const Ledger = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [dialog, setDialog] = useState<"payment" | "expense" | null>(null);
  const [paymentForm, setPaymentForm] = useState(paymentInitial);
  const [expenseForm, setExpenseForm] = useState(expenseInitial);
  const [allocationRows, setAllocationRows] = useState<Array<{ invoice_id: string; amount: number }>>([]);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const results = await Promise.all([
      supabase.from("payments").select("*").order("payment_date", { ascending: false }),
      supabase.from("payment_allocations").select("*"),
      supabase.from("expenses").select("*").order("expense_date", { ascending: false }),
      supabase.from("invoices").select("id, invoice_number, client_name, project_id, total, currency, document_type"),
      supabase.from("projects").select("id, name, client_id, currency").order("name"),
      supabase.from("clients").select("id, client_name").order("client_name"),
      supabase.from("expense_categories").select("*"),
      supabase.from("financial_audit_log").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    setPayments(results[0].data ?? []); setAllocations(results[1].data ?? []); setExpenses(results[2].data ?? []);
    setInvoices(results[3].data ?? []); setProjects(results[4].data ?? []); setClients(results[5].data ?? []);
    setCategories(results[6].data ?? []); setAudit(results[7].data ?? []); setLoading(false);
  }, []);
  useEffect(() => { void fetchData(); }, [fetchData]);

  const allocatedByPayment = useMemo(() => allocations.reduce<Record<string, number>>((map, allocation) => { map[allocation.payment_id] = (map[allocation.payment_id] ?? 0) + allocation.amount; return map; }, {}), [allocations]);
  const allocatedByInvoice = useMemo(() => allocations.reduce<Record<string, number>>((map, allocation) => { map[allocation.invoice_id] = (map[allocation.invoice_id] ?? 0) + allocation.amount; return map; }, {}), [allocations]);
  const projectName = (id: string | null) => projects.find((project) => project.id === id)?.name ?? "No project";
  const clientName = (id: string | null) => clients.find((client) => client.id === id)?.client_name ?? "Unknown client";
  const categoryName = (id: string | null) => categories.find((category) => category.id === id)?.name ?? "Uncategorized";
  const query = search.trim().toLowerCase();
  const filteredPayments = payments.filter((payment) => (!query || [payment.payer, payment.reference ?? "", payment.notes ?? ""].some((value) => value.toLowerCase().includes(query))) && (projectFilter === "all" || payment.project_id === projectFilter));
  const filteredExpenses = expenses.filter((expense) => (!query || [expense.vendor, expense.notes ?? "", categoryName(expense.category_id)].some((value) => value.toLowerCase().includes(query))) && (projectFilter === "all" || expense.project_id === projectFilter));
  const availableInvoices = invoices.filter((invoice) => invoice.document_type === "invoice" && Math.max(invoice.total - (allocatedByInvoice[invoice.id] ?? 0), 0) > 0 && (paymentForm.project_id === "none" || invoice.project_id === paymentForm.project_id));
  const allocationTotal = allocationRows.reduce((sum, row) => sum + row.amount, 0);

  const createPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (paymentForm.amount <= 0 || !paymentForm.payer.trim()) return toast.error("Enter a positive amount and payer.");
    if (allocationTotal > paymentForm.amount) return toast.error("Allocations cannot exceed the payment amount.");
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
    setSaving(true);
    const { data, error } = await supabase.from("payments").insert({ user_id: user.id, payment_date: paymentForm.payment_date, amount: paymentForm.amount, currency: paymentForm.currency, method: paymentForm.method, reference: paymentForm.reference || null, payer: paymentForm.payer.trim(), notes: paymentForm.notes || null, attachment_path: paymentForm.attachment_path || null, client_id: paymentForm.client_id === "none" ? null : paymentForm.client_id, project_id: paymentForm.project_id === "none" ? null : paymentForm.project_id }).select("id").single();
    if (!error && data && allocationRows.length) {
      const allocationResult = await supabase.from("payment_allocations").insert(allocationRows.filter((row) => row.invoice_id && row.amount > 0).map((row) => ({ user_id: user.id, payment_id: data.id, invoice_id: row.invoice_id, amount: row.amount })));
      if (allocationResult.error) { setSaving(false); return toast.error("Payment saved, but allocations failed validation."); }
    }
    setSaving(false); if (error) return toast.error("Payment couldn’t be recorded.");
    toast.success("Incoming payment recorded."); setDialog(null); setPaymentForm(paymentInitial); setAllocationRows([]); void fetchData();
  };

  const createExpense = async (event: React.FormEvent) => {
    event.preventDefault(); if (expenseForm.amount <= 0 || !expenseForm.vendor.trim()) return toast.error("Enter a positive amount and vendor.");
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
    let categoryId = categories.find((category) => category.name.toLowerCase() === expenseForm.category.trim().toLowerCase())?.id ?? null;
    if (!categoryId) { const result = await supabase.from("expense_categories").insert({ user_id: user.id, name: expenseForm.category.trim() || "General" }).select("id").single(); categoryId = result.data?.id ?? null; }
    setSaving(true);
    const { error } = await supabase.from("expenses").insert({ user_id: user.id, project_id: expenseForm.project_id === "none" ? null : expenseForm.project_id, category_id: categoryId, expense_date: expenseForm.expense_date, amount: expenseForm.amount, tax_amount: expenseForm.tax_amount, currency: expenseForm.currency, vendor: expenseForm.vendor.trim(), notes: expenseForm.notes || null, receipt_path: expenseForm.receipt_path || null, is_recurring: expenseForm.is_recurring, recurrence_note: expenseForm.is_recurring ? expenseForm.recurrence_note || null : null });
    setSaving(false); if (error) return toast.error("Expense couldn’t be recorded."); toast.success("Outgoing expense recorded."); setDialog(null); setExpenseForm(expenseInitial); void fetchData();
  };

  const deleteEntry = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = deleteTarget.kind === "payment"
      ? await supabase.from("payments").delete().eq("id", deleteTarget.record.id)
      : await supabase.from("expenses").delete().eq("id", deleteTarget.record.id);
    setDeleting(false);
    if (error) return toast.error(`${deleteTarget.kind === "payment" ? "Payment" : "Expense"} couldn’t be deleted. Please retry.`);
    toast.success(`${deleteTarget.kind === "payment" ? "Payment" : "Expense"} deleted.`);
    setDeleteTarget(null);
    void fetchData();
  };

  const exportLedger = () => {
    const rows: Array<Array<string | number>> = [["Type","Date","Party","Project","Category/Method","Currency","Amount","Allocated/Tax","Notes"], ...filteredPayments.map((payment) => ["Income",payment.payment_date,payment.payer,projectName(payment.project_id),payment.method,payment.currency,payment.amount,allocatedByPayment[payment.id] ?? 0,payment.notes ?? ""]), ...filteredExpenses.map((expense) => ["Outgoing",expense.expense_date,expense.vendor,projectName(expense.project_id),categoryName(expense.category_id),expense.currency,expense.amount,expense.tax_amount,expense.notes ?? ""])];
    const blob = new Blob(["\uFEFF", rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `cash-ledger-${new Date().toISOString().slice(0,10)}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  if (loading) return <DashboardLayout><PageLoader label="Loading cash ledger…" /></DashboardLayout>;
  return <DashboardLayout><div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h1 className="text-3xl font-bold">Income & outgoings</h1><p className="mt-1 text-muted-foreground">Manual operational cash tracking before payment-gateway integration.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={exportLedger}><Download className="mr-2 h-4 w-4" />Export CSV</Button><Button onClick={() => setDialog("payment")}><Plus className="mr-2 h-4 w-4" />Incoming payment</Button><Button variant="secondary" onClick={() => setDialog("expense")}><Plus className="mr-2 h-4 w-4" />Outgoing expense</Button></div></div>
    <Alert><WalletCards className="h-4 w-4" /><AlertTitle>Operational ledger only</AlertTitle><AlertDescription>This is not bank reconciliation, bookkeeping, tax filing, or accounting-grade financial statements. Entries are manual and should be verified against your books.</AlertDescription></Alert>
    <div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-10" placeholder="Search payer, vendor, category, reference, or notes…" value={search} onChange={(event) => setSearch(event.target.value)} /></div><Select value={projectFilter} onValueChange={setProjectFilter}><SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All projects</SelectItem>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></div>
    <Tabs defaultValue="income"><TabsList><TabsTrigger value="income">Income</TabsTrigger><TabsTrigger value="outgoings">Outgoings</TabsTrigger><TabsTrigger value="balances">Invoice balances</TabsTrigger><TabsTrigger value="audit">Audit log</TabsTrigger></TabsList>
      <TabsContent value="income"><LedgerCard title="Incoming payments">{filteredPayments.map((payment) => { const allocated = allocatedByPayment[payment.id] ?? 0; return <LedgerRow key={payment.id} title={payment.payer} detail={`${payment.payment_date} · ${projectName(payment.project_id)} · ${pretty(payment.method)}`} amount={formatCurrency(payment.amount, payment.currency)}><Badge variant={allocated === 0 ? "destructive" : allocated < payment.amount ? "secondary" : "outline"}>{formatCurrency(payment.amount - allocated, payment.currency)} unallocated</Badge><Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget({ kind: "payment", record: payment })}><Trash2 className="mr-2 h-4 w-4" />Delete</Button></LedgerRow>; })}</LedgerCard></TabsContent>
      <TabsContent value="outgoings"><LedgerCard title="Business outgoings">{filteredExpenses.map((expense) => <LedgerRow key={expense.id} title={expense.vendor} detail={`${expense.expense_date} · ${categoryName(expense.category_id)} · ${projectName(expense.project_id)}${expense.is_recurring ? ` · Recurring: ${expense.recurrence_note || "schedule not configured"}` : ""}`} amount={formatCurrency(expense.amount + expense.tax_amount, expense.currency)}><Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget({ kind: "expense", record: expense })}><Trash2 className="mr-2 h-4 w-4" />Delete</Button></LedgerRow>)}</LedgerCard></TabsContent>
      <TabsContent value="balances"><LedgerCard title="Balances calculated from allocations">{invoices.filter(({ document_type }) => document_type === "invoice").map((invoice) => { const paid = allocatedByInvoice[invoice.id] ?? 0; return <LedgerRow key={invoice.id} title={`${invoice.invoice_number} · ${invoice.client_name}`} detail={`${formatCurrency(paid, invoice.currency)} allocated of ${formatCurrency(invoice.total, invoice.currency)}`} amount={`${formatCurrency(Math.max(invoice.total - paid, 0), invoice.currency)} due`} />; })}</LedgerCard></TabsContent>
      <TabsContent value="audit"><LedgerCard title="Immutable financial change history">{audit.map((entry) => <LedgerRow key={entry.id} title={`${pretty(entry.action)} ${entry.table_name}`} detail={`${new Date(entry.created_at).toLocaleString()} · ${entry.record_id}`} amount="" />)}</LedgerCard></TabsContent>
    </Tabs>
    <Dialog open={Boolean(dialog)} onOpenChange={(open) => !open && setDialog(null)}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{dialog === "payment" ? "Record incoming payment" : "Record outgoing expense"}</DialogTitle></DialogHeader>{dialog === "payment" ? <form className="space-y-4" onSubmit={createPayment}><div className="grid gap-3 sm:grid-cols-2"><Field label="Payment date" type="date" value={paymentForm.payment_date} onChange={(payment_date) => setPaymentForm({ ...paymentForm, payment_date })} /><Field label="Amount" type="number" value={String(paymentForm.amount)} onChange={(value) => setPaymentForm({ ...paymentForm, amount: Number(value) })} /></div><Currency value={paymentForm.currency} onChange={(currency) => setPaymentForm({ ...paymentForm, currency })} /><Field label="Payer" value={paymentForm.payer} onChange={(payer) => setPaymentForm({ ...paymentForm, payer })} /><div className="grid gap-3 sm:grid-cols-2"><Choice label="Method" value={paymentForm.method} onChange={(method) => setPaymentForm({ ...paymentForm, method })} options={["bank_transfer","cash","card","cheque","wallet","other"]} /><Choice label="Client" value={paymentForm.client_id} onChange={(client_id) => setPaymentForm({ ...paymentForm, client_id })} options={["none",...clients.map(({ id }) => id)]} labels={Object.fromEntries(clients.map((client) => [client.id, client.client_name]))} /></div><Choice label="Project" value={paymentForm.project_id} onChange={(project_id) => { const project = projects.find(({ id }) => id === project_id); setPaymentForm({ ...paymentForm, project_id, client_id: project?.client_id ?? paymentForm.client_id, currency: project?.currency ?? paymentForm.currency }); }} options={["none",...projects.map(({ id }) => id)]} labels={Object.fromEntries(projects.map((project) => [project.id, project.name]))} /><Field label="Reference" value={paymentForm.reference} onChange={(reference) => setPaymentForm({ ...paymentForm, reference })} /><Area label="Notes" value={paymentForm.notes} onChange={(notes) => setPaymentForm({ ...paymentForm, notes })} /><Field label="Attachment path or URL (optional)" value={paymentForm.attachment_path} onChange={(attachment_path) => setPaymentForm({ ...paymentForm, attachment_path })} /><div className="space-y-3 rounded border p-3"><div className="flex justify-between"><Label>Allocate across invoices</Label><Button type="button" size="sm" variant="outline" onClick={() => setAllocationRows([...allocationRows, { invoice_id: availableInvoices[0]?.id ?? "", amount: 0 }])}>Add allocation</Button></div>{allocationRows.map((row, index) => <div key={index} className="grid grid-cols-[1fr_130px] gap-2"><Select value={row.invoice_id} onValueChange={(invoice_id) => setAllocationRows(allocationRows.map((item, rowIndex) => rowIndex === index ? { ...item, invoice_id } : item))}><SelectTrigger><SelectValue placeholder="Invoice" /></SelectTrigger><SelectContent>{availableInvoices.map((invoice) => <SelectItem key={invoice.id} value={invoice.id}>{invoice.invoice_number} · {formatCurrency(Math.max(invoice.total - (allocatedByInvoice[invoice.id] ?? 0), 0), invoice.currency)} due</SelectItem>)}</SelectContent></Select><Input type="number" min="0" step="0.01" value={row.amount} onChange={(event) => setAllocationRows(allocationRows.map((item, rowIndex) => rowIndex === index ? { ...item, amount: Number(event.target.value) } : item))} /></div>)}<p className="text-sm text-muted-foreground">Allocated {formatCurrency(allocationTotal, paymentForm.currency)} · Unallocated {formatCurrency(Math.max(paymentForm.amount - allocationTotal, 0), paymentForm.currency)}</p></div><Button className="w-full" disabled={saving}>{saving ? "Saving…" : "Record payment"}</Button></form> : <form className="space-y-4" onSubmit={createExpense}><div className="grid gap-3 sm:grid-cols-2"><Field label="Expense date" type="date" value={expenseForm.expense_date} onChange={(expense_date) => setExpenseForm({ ...expenseForm, expense_date })} /><Field label="Amount" type="number" value={String(expenseForm.amount)} onChange={(value) => setExpenseForm({ ...expenseForm, amount: Number(value) })} /></div><div className="grid gap-3 sm:grid-cols-2"><Field label="Tax amount" type="number" value={String(expenseForm.tax_amount)} onChange={(value) => setExpenseForm({ ...expenseForm, tax_amount: Number(value) })} /><Currency value={expenseForm.currency} onChange={(currency) => setExpenseForm({ ...expenseForm, currency })} /></div><Field label="Vendor" value={expenseForm.vendor} onChange={(vendor) => setExpenseForm({ ...expenseForm, vendor })} /><Field label="Category" value={expenseForm.category} onChange={(category) => setExpenseForm({ ...expenseForm, category })} /><Choice label="Project" value={expenseForm.project_id} onChange={(project_id) => setExpenseForm({ ...expenseForm, project_id, currency: projects.find(({ id }) => id === project_id)?.currency ?? expenseForm.currency })} options={["none",...projects.map(({ id }) => id)]} labels={Object.fromEntries(projects.map((project) => [project.id, project.name]))} /><Area label="Notes" value={expenseForm.notes} onChange={(notes) => setExpenseForm({ ...expenseForm, notes })} /><Field label="Receipt path or URL (optional)" value={expenseForm.receipt_path} onChange={(receipt_path) => setExpenseForm({ ...expenseForm, receipt_path })} /><label className="flex items-center gap-2"><Checkbox checked={expenseForm.is_recurring} onCheckedChange={(value) => setExpenseForm({ ...expenseForm, is_recurring: value === true })} />Recurring expense record (does not generate invoices)</label>{expenseForm.is_recurring && <Field label="Recurrence note" value={expenseForm.recurrence_note} onChange={(recurrence_note) => setExpenseForm({ ...expenseForm, recurrence_note })} />}<Button className="w-full" disabled={saving}>{saving ? "Saving…" : "Record expense"}</Button></form>}</DialogContent></Dialog>
    <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete {deleteTarget?.kind === "payment" ? "incoming payment" : "outgoing expense"}?</AlertDialogTitle><AlertDialogDescription>{deleteTarget?.kind === "payment" ? "This permanently removes the payment and its invoice allocations. Any affected paid invoice may return to Pending." : "This permanently removes the expense from the operational ledger."} The deletion remains recorded in the audit log.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel><AlertDialogAction disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={(event) => { event.preventDefault(); void deleteEntry(); }}>{deleting ? "Deleting…" : "Delete entry"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div></DashboardLayout>;
};

const pretty = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
const LedgerCard = ({ title, children }: { title: string; children: React.ReactNode }) => <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent>{children}</CardContent></Card>;
const LedgerRow = ({ title, detail, amount, children }: { title: string; detail: string; amount: string; children?: React.ReactNode }) => <div className="flex flex-col justify-between gap-2 border-b py-4 last:border-0 sm:flex-row sm:items-center"><div><p className="font-medium">{title}</p><p className="text-sm text-muted-foreground">{detail}</p></div><div className="flex items-center gap-3"><span className="font-semibold">{amount}</span>{children}</div></div>;
const Field = ({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) => <div className="space-y-2"><Label>{label}</Label><Input type={type} min={type === "number" ? 0 : undefined} step={type === "number" ? "0.01" : undefined} value={value} onChange={(event) => onChange(event.target.value)} /></div>;
const Area = ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => <div className="space-y-2"><Label>{label}</Label><Textarea value={value} onChange={(event) => onChange(event.target.value)} /></div>;
const Choice = ({ label, value, onChange, options, labels = {} }: { label: string; value: string; onChange: (value: string) => void; options: string[]; labels?: Record<string,string> }) => <div className="space-y-2"><Label>{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option} value={option}>{labels[option] ?? pretty(option)}</SelectItem>)}</SelectContent></Select></div>;
const Currency = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => <div className="space-y-2"><Label>Currency</Label><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{currencies.map((currency) => <SelectItem key={currency.code} value={currency.code}>{currency.code}</SelectItem>)}</SelectContent></Select></div>;

export default Ledger;
