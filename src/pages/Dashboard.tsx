import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, CalendarClock, WalletCards } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { PageLoader } from "@/components/shared/AsyncState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currencies";
import { getInvoiceDisplayStatus, isDatabaseSchemaCompatibilityError } from "@/lib/invoice";
import { formatEstimate, formatScheduledAt, isSameLocalDay, taskStatusLabel } from "@/lib/schedule";

type Invoice = Pick<Tables<"invoices">, "id" | "invoice_number" | "client_name" | "document_type" | "status" | "due_date" | "total" | "currency">;
type Project = Pick<Tables<"projects">, "id" | "name" | "client_id">;
type Client = Pick<Tables<"clients">, "id" | "client_name">;
type Payment = Pick<Tables<"payments">, "amount" | "currency" | "payment_date">;
type Allocation = Pick<Tables<"payment_allocations">, "invoice_id" | "amount">;
type Expense = Pick<Tables<"expenses">, "amount" | "tax_amount" | "currency" | "expense_date">;
type Task = Pick<Tables<"project_tasks">, "id" | "project_id" | "title" | "status" | "scheduled_at" | "estimated_minutes">;

const Dashboard = () => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const currentInvoiceResult = await supabase
      .from("invoices")
      .select("id, invoice_number, client_name, document_type, status, due_date, total, currency");
    let invoiceData: Invoice[] = currentInvoiceResult.data ?? [];

    if (currentInvoiceResult.error && isDatabaseSchemaCompatibilityError(currentInvoiceResult.error)) {
      const legacyResult = await supabase
        .from("invoices")
        .select("id, invoice_number, client_name, status, due_date, total, currency");
      if (!legacyResult.error) {
        invoiceData = (legacyResult.data ?? []).map((invoice) => ({ ...invoice, document_type: "invoice" }));
      }
    }

    const results = await Promise.all([
      supabase.from("projects").select("id, name, client_id"),
      supabase.from("clients").select("id, client_name"),
      supabase.from("payments").select("amount, currency, payment_date"),
      supabase.from("payment_allocations").select("invoice_id, amount"),
      supabase.from("expenses").select("amount, tax_amount, currency, expense_date"),
      supabase.from("project_tasks").select("id, project_id, title, status, scheduled_at, estimated_minutes"),
      supabase.from("profiles").select("default_currency").eq("id", user.id).single(),
    ]);

    setInvoices(invoiceData);
    setProjects(results[0].data ?? []);
    setClients(results[1].data ?? []);
    setPayments(results[2].data ?? []);
    setAllocations(results[3].data ?? []);
    setExpenses(results[4].data ?? []);
    setTasks(results[5].data ?? []);
    setCurrency(results[6].data?.default_currency ?? invoiceData[0]?.currency ?? "USD");
    setLoading(false);
  }, []);

  useEffect(() => { void fetchDashboard(); }, [fetchDashboard]);

  const summary = useMemo(() => {
    const today = new Date();
    const todayText = today.toISOString().slice(0, 10);
    const month = todayText.slice(0, 7);
    const allocationMap = allocations.reduce<Record<string, number>>((map, allocation) => {
      map[allocation.invoice_id] = (map[allocation.invoice_id] ?? 0) + allocation.amount;
      return map;
    }, {});
    const finalInvoices = invoices.filter((invoice) => invoice.document_type === "invoice" && invoice.currency === currency);
    const outstanding = finalInvoices.reduce((sum, invoice) => sum + Math.max(invoice.total - (allocationMap[invoice.id] ?? 0), 0), 0);
    const incomeMonth = payments.filter((payment) => payment.currency === currency && payment.payment_date.startsWith(month)).reduce((sum, payment) => sum + payment.amount, 0);
    const outflowMonth = expenses.filter((expense) => expense.currency === currency && expense.expense_date.startsWith(month)).reduce((sum, expense) => sum + expense.amount + expense.tax_amount, 0);
    const due = finalInvoices
      .filter((invoice) => invoice.status !== "paid" && invoice.status !== "draft")
      .sort((left, right) => left.due_date.localeCompare(right.due_date))
      .slice(0, 6);
    const now = tasks
      .filter((task) => task.status === "in_progress" || (task.scheduled_at != null && task.status !== "done" && task.status !== "cancelled" && isSameLocalDay(task.scheduled_at, today)))
      .sort((left, right) => (left.scheduled_at ?? "").localeCompare(right.scheduled_at ?? ""));
    return { outstanding, incomeMonth, outflowMonth, net: incomeMonth - outflowMonth, due, now };
  }, [allocations, currency, expenses, invoices, payments, tasks]);

  const projectName = (id: string) => projects.find((project) => project.id === id)?.name ?? "Project";
  const clientName = (projectId: string) => {
    const project = projects.find((item) => item.id === projectId);
    return clients.find((client) => client.id === project?.client_id)?.client_name ?? "Client";
  };

  if (loading) return <DashboardLayout><PageLoader label="Loading today…" /></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-3xl font-bold">Today</h1>
            <p className="mt-1 text-muted-foreground">What is scheduled, what is due, and money moving in {currency}.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate("/dashboard/schedule")}>Open schedule</Button>
            <Button variant="outline" onClick={() => navigate("/dashboard/invoices")}>Invoices</Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Income this month" value={formatCurrency(summary.incomeMonth, currency)} icon={<WalletCards />} />
          <Metric label="Outflows this month" value={formatCurrency(summary.outflowMonth, currency)} icon={<ArrowUpRight />} />
          <Metric label="Net this month" value={formatCurrency(summary.net, currency)} danger={summary.net < 0} />
          <Metric label="Still owed" value={formatCurrency(summary.outstanding, currency)} icon={<CalendarClock />} />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Happening now</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/schedule")}>Schedule</Button>
            </CardHeader>
            <CardContent>
              {summary.now.length === 0 && <p className="py-6 text-sm text-muted-foreground">Nothing is in progress or scheduled for today.</p>}
              {summary.now.map((task) => (
                <button key={task.id} className="flex w-full items-center justify-between gap-3 border-b py-3 text-left last:border-0" onClick={() => navigate(`/dashboard/projects/${task.project_id}`)}>
                  <span>
                    <span className="font-medium">{task.title}</span>
                    <span className="block text-sm text-muted-foreground">{clientName(task.project_id)} · {projectName(task.project_id)} · {formatScheduledAt(task.scheduled_at)}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{formatEstimate(task.estimated_minutes)}</span>
                    <Badge variant="outline">{taskStatusLabel(task.status)}</Badge>
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Invoices due</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/money")}>Money</Button>
            </CardHeader>
            <CardContent>
              {summary.due.length === 0 && <p className="py-6 text-sm text-muted-foreground">No open invoices.</p>}
              {summary.due.map((invoice) => {
                const display = getInvoiceDisplayStatus({ archived_at: null, due_date: invoice.due_date, status: invoice.status });
                return (
                  <button key={invoice.id} className="flex w-full items-center justify-between gap-3 border-b py-3 text-left last:border-0" onClick={() => navigate(`/dashboard/invoices/${invoice.id}`)}>
                    <span>
                      <span className="font-medium">{invoice.invoice_number}</span>
                      <span className="block text-sm text-muted-foreground">{invoice.client_name} · Due {invoice.due_date}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-sm">{formatCurrency(invoice.total, invoice.currency)}</span>
                      <Badge variant={display === "overdue" ? "destructive" : "outline"}>{display}</Badge>
                    </span>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

const Metric = ({ label, value, icon, danger = false }: { label: string; value: string; icon?: React.ReactNode; danger?: boolean }) => (
  <Card>
    <CardContent className="flex items-start justify-between p-5">
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`mt-1 text-xl font-bold ${danger ? "text-destructive" : ""}`}>{value}</p>
      </div>
      {icon && <span className="text-muted-foreground [&>svg]:h-5 [&>svg]:w-5">{icon}</span>}
    </CardContent>
  </Card>
);

export default Dashboard;
