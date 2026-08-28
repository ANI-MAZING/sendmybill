import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowUpRight, BriefcaseBusiness, CalendarClock, Plus, Users, WalletCards } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import InvoiceList from "@/components/invoice/InvoiceList";
import { PageLoader } from "@/components/shared/AsyncState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currencies";
import { getInvoiceDisplayStatus, isDatabaseSchemaCompatibilityError } from "@/lib/invoice";

type Invoice = Pick<Tables<"invoices">, "id" | "invoice_number" | "client_name" | "project_id" | "document_type" | "status" | "due_date" | "issue_date" | "total" | "currency" | "updated_at">;
type Project = Pick<Tables<"projects">, "id" | "name" | "billing_model" | "status" | "budget" | "currency">;
type Milestone = Pick<Tables<"project_milestones">, "id" | "project_id" | "name" | "due_date" | "status">;
type Payment = Pick<Tables<"payments">, "id" | "amount" | "currency" | "payment_date">;
type Allocation = Pick<Tables<"payment_allocations">, "payment_id" | "invoice_id" | "amount">;
type Expense = Pick<Tables<"expenses">, "project_id" | "amount" | "tax_amount" | "currency" | "expense_date">;
type TimeEntry = Pick<Tables<"time_entries">, "project_id" | "duration_minutes" | "hourly_rate">;

const Dashboard = () => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [clientCount, setClientCount] = useState(0);
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const currentInvoiceResult = await supabase
      .from("invoices")
      .select("id, invoice_number, client_name, project_id, document_type, status, due_date, issue_date, total, currency, updated_at");
    let invoiceData: Invoice[] = currentInvoiceResult.data ?? [];

    if (currentInvoiceResult.error && isDatabaseSchemaCompatibilityError(currentInvoiceResult.error)) {
      const legacyResult = await supabase
        .from("invoices")
        .select("id, invoice_number, client_name, status, due_date, issue_date, total, currency, updated_at");
      let legacyData = legacyResult.data;
      let legacyError = legacyResult.error;
      if (legacyError && isDatabaseSchemaCompatibilityError(legacyError)) {
        const originalResult = await supabase
          .from("invoices")
          .select("id, invoice_number, client_name, status, due_date, issue_date, total, updated_at");
        legacyError = originalResult.error;
        legacyData = originalResult.error
          ? null
          : (originalResult.data ?? []).map((invoice) => ({ ...invoice, currency: "USD" }));
      }
      if (!legacyError) {
        invoiceData = (legacyData ?? []).map((invoice) => ({
          ...invoice,
          project_id: null,
          document_type: "invoice",
        }));
      }
    }

    const results = await Promise.all([
      supabase.from("projects").select("id, name, billing_model, status, budget, currency"),
      supabase.from("project_milestones").select("id, project_id, name, due_date, status"),
      supabase.from("payments").select("id, amount, currency, payment_date"),
      supabase.from("payment_allocations").select("payment_id, invoice_id, amount"),
      supabase.from("expenses").select("project_id, amount, tax_amount, currency, expense_date"),
      supabase.from("time_entries").select("project_id, duration_minutes, hourly_rate"),
      supabase.from("clients").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("default_currency").eq("id", user.id).single(),
    ]);
    setInvoices(invoiceData); setProjects(results[0].data ?? []); setMilestones(results[1].data ?? []);
    setPayments(results[2].data ?? []); setAllocations(results[3].data ?? []); setExpenses(results[4].data ?? []);
    setTimeEntries(results[5].data ?? []); setClientCount(results[6].count ?? 0);
    setCurrency(results[7].data?.default_currency ?? invoiceData[0]?.currency ?? "USD");
    setLoading(false);
  }, []);
  useEffect(() => { void fetchDashboard(); }, [fetchDashboard]);

  const summary = useMemo(() => {
    const today = new Date(); const todayText = today.toISOString().slice(0, 10); const month = todayText.slice(0, 7);
    const allocationMap = allocations.reduce<Record<string,number>>((map, allocation) => { map[allocation.invoice_id] = (map[allocation.invoice_id] ?? 0) + allocation.amount; return map; }, {});
    const finalInvoices = invoices.filter((invoice) => invoice.document_type === "invoice" && invoice.currency === currency);
    const outstanding = finalInvoices.reduce((sum, invoice) => sum + Math.max(invoice.total - (allocationMap[invoice.id] ?? 0), 0), 0);
    const overdue = finalInvoices.filter((invoice) => getInvoiceDisplayStatus({ archived_at: null, due_date: invoice.due_date, status: invoice.status }) === "overdue").reduce((sum, invoice) => sum + Math.max(invoice.total - (allocationMap[invoice.id] ?? 0), 0), 0);
    const paidMonth = payments.filter((payment) => payment.currency === currency && payment.payment_date.startsWith(month)).reduce((sum, payment) => sum + payment.amount, 0);
    const draftValue = finalInvoices.filter(({ status }) => status === "draft").reduce((sum, invoice) => sum + invoice.total, 0);
    const activeProjects = projects.filter(({ status }) => status === "active");
    const retainersDue = activeProjects.filter(({ billing_model, id }) => billing_model === "retainer" && !finalInvoices.some((invoice) => invoice.project_id === id && invoice.issue_date.startsWith(month)));
    const projectSpend = (projectId: string) => expenses.filter((expense) => expense.project_id === projectId && expense.currency === currency).reduce((sum, expense) => sum + expense.amount + expense.tax_amount, 0) + timeEntries.filter((entry) => entry.project_id === projectId).reduce((sum, entry) => sum + entry.duration_minutes / 60 * entry.hourly_rate, 0);
    const overBudget = activeProjects.filter((project) => project.currency === currency && project.budget > 0 && projectSpend(project.id) > project.budget);
    const expenseMonth = expenses.filter((expense) => expense.currency === currency && expense.expense_date.startsWith(month)).reduce((sum, expense) => sum + expense.amount + expense.tax_amount, 0);
    const unallocated = payments.filter((payment) => payment.currency === currency).reduce((sum, payment) => sum + Math.max(payment.amount - allocations.filter((allocation) => allocation.payment_id === payment.id).reduce((value, allocation) => value + allocation.amount, 0), 0), 0);
    const upcomingInvoices = finalInvoices.filter((invoice) => invoice.status !== "paid" && invoice.due_date >= todayText).sort((a,b) => a.due_date.localeCompare(b.due_date)).slice(0,5);
    const upcomingMilestones = milestones.filter((milestone) => milestone.due_date && milestone.due_date >= todayText && !["completed","cancelled"].includes(milestone.status)).sort((a,b) => (a.due_date ?? "").localeCompare(b.due_date ?? "")).slice(0,5);
    return { outstanding, overdue, paidMonth, draftValue, activeProjects, retainersDue, overBudget, expenseMonth, net: paidMonth - expenseMonth, unallocated, upcomingInvoices, upcomingMilestones };
  }, [allocations, currency, expenses, invoices, milestones, payments, projects, timeEntries]);

  const chart = useMemo(() => Array.from({ length: 6 }, (_, index) => { const date = new Date(); date.setMonth(date.getMonth() - (5 - index)); const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`; return { month: date.toLocaleString(undefined,{month:"short"}), invoiced: invoices.filter((invoice) => invoice.document_type === "invoice" && invoice.currency === currency && invoice.issue_date.startsWith(key)).reduce((sum,invoice) => sum + invoice.total,0), payments: payments.filter((payment) => payment.currency === currency && payment.payment_date.startsWith(key)).reduce((sum,payment) => sum + payment.amount,0) }; }), [currency, invoices, payments]);
  const recent = [...invoices].sort((a,b) => b.updated_at.localeCompare(a.updated_at)).slice(0,6);
  if (loading) return <DashboardLayout><PageLoader label="Preparing your business dashboard…" /></DashboardLayout>;

  return <DashboardLayout><div className="space-y-8">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h1 className="text-3xl font-bold">Business overview</h1><p className="mt-1 text-muted-foreground">Invoices, projects, and manual cash movement in {currency}.</p></div><Button onClick={() => navigate("/dashboard/create")}><Plus className="mr-2 h-4 w-4" />Create invoice</Button></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Outstanding" value={formatCurrency(summary.outstanding,currency)} icon={<ArrowUpRight />} /><Metric label="Overdue" value={formatCurrency(summary.overdue,currency)} icon={<AlertTriangle />} danger /><Metric label="Paid this month" value={formatCurrency(summary.paidMonth,currency)} icon={<WalletCards />} /><Metric label="Draft value" value={formatCurrency(summary.draftValue,currency)} icon={<CalendarClock />} /><Metric label="Active clients" value={String(clientCount)} icon={<Users />} /></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Active projects" value={String(summary.activeProjects.length)} icon={<BriefcaseBusiness />} /><Metric label="Retainers due" value={String(summary.retainersDue.length)} icon={<CalendarClock />} /><Metric label="Projects over budget" value={String(summary.overBudget.length)} icon={<AlertTriangle />} danger={summary.overBudget.length > 0} /><Metric label="Unallocated payments" value={formatCurrency(summary.unallocated,currency)} icon={<WalletCards />} /></div>
    <div className="grid gap-4 sm:grid-cols-3"><Metric label="Income this month" value={formatCurrency(summary.paidMonth,currency)} /><Metric label="Outgoings this month" value={formatCurrency(summary.expenseMonth,currency)} /><Metric label="Net cash flow" value={formatCurrency(summary.net,currency)} danger={summary.net < 0} /></div>
    <div className="grid gap-4 xl:grid-cols-2"><Card><CardHeader><CardTitle>Monthly invoiced vs payments</CardTitle></CardHeader><CardContent className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Legend /><Bar dataKey="invoiced" fill="#2563eb" /><Bar dataKey="payments" fill="#16a34a" /></BarChart></ResponsiveContainer></CardContent></Card><Card><CardHeader><CardTitle>Upcoming due dates</CardTitle></CardHeader><CardContent>{summary.upcomingInvoices.map((invoice) => <button key={invoice.id} className="flex w-full justify-between border-b py-3 text-left" onClick={() => navigate(`/dashboard/invoices/${invoice.id}`)}><span>{invoice.invoice_number} · {invoice.client_name}</span><span>{invoice.due_date}</span></button>)}{summary.upcomingMilestones.map((milestone) => <button key={milestone.id} className="flex w-full justify-between border-b py-3 text-left" onClick={() => navigate(`/dashboard/projects/${milestone.project_id}`)}><span>{milestone.name}</span><span>{milestone.due_date}</span></button>)}</CardContent></Card></div>
    <Card><CardHeader><CardTitle>Recent invoice activity</CardTitle></CardHeader><CardContent className="grid gap-2 md:grid-cols-2">{recent.map((invoice) => <button key={invoice.id} className="flex justify-between rounded border p-3 text-left hover:bg-muted" onClick={() => navigate(`/dashboard/invoices/${invoice.id}`)}><span>{invoice.invoice_number}<span className="block text-sm text-muted-foreground">{invoice.client_name}</span></span><Badge variant="outline">{invoice.document_type === "proforma" ? "Proforma" : invoice.status}</Badge></button>)}</CardContent></Card>
    <div><h2 className="mb-4 text-2xl font-bold">Billing documents</h2><InvoiceList /></div>
  </div></DashboardLayout>;
};

const Metric = ({ label, value, icon, danger = false }: { label: string; value: string; icon?: React.ReactNode; danger?: boolean }) => <Card><CardContent className="flex items-start justify-between p-5"><div><p className="text-sm text-muted-foreground">{label}</p><p className={`mt-1 text-xl font-bold ${danger ? "text-destructive" : ""}`}>{value}</p></div>{icon && <span className="text-muted-foreground [&>svg]:h-5 [&>svg]:w-5">{icon}</span>}</CardContent></Card>;

export default Dashboard;
