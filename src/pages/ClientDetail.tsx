import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Copy, Link2, Plus, RefreshCw, Unlink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { ErrorState, PageLoader } from "@/components/shared/AsyncState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/currencies";
import { buildClientPortalUrl } from "@/lib/invoice-record";
import { formatEstimate, formatScheduledAt, taskStatusLabel } from "@/lib/schedule";

type Client = Tables<"clients">;
type Project = Pick<Tables<"projects">, "id" | "name" | "status" | "currency">;
type Task = Pick<Tables<"project_tasks">, "id" | "project_id" | "title" | "status" | "scheduled_at" | "estimated_minutes">;
type Invoice = Pick<Tables<"invoices">, "id" | "invoice_number" | "issue_date" | "due_date" | "total" | "currency" | "status" | "document_type" | "client_id" | "client_email">;
type Allocation = Pick<Tables<"payment_allocations">, "invoice_id" | "amount">;

const ClientDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const clientResult = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
    if (clientResult.error) {
      setError("This client couldn’t be loaded. Check your connection and try again.");
      setLoading(false);
      return;
    }
    if (!clientResult.data) {
      setMissing(true);
      setLoading(false);
      return;
    }
    const current = clientResult.data;
    const [projectResult, taskResult, invoiceResult, allocationResult] = await Promise.all([
      supabase.from("projects").select("id, name, status, currency").eq("client_id", id).order("name"),
      supabase.from("project_tasks").select("id, project_id, title, status, scheduled_at, estimated_minutes").neq("status", "cancelled"),
      supabase.from("invoices").select("id, invoice_number, issue_date, due_date, total, currency, status, document_type, client_id, client_email"),
      supabase.from("payment_allocations").select("invoice_id, amount"),
    ]);
    if (projectResult.error || taskResult.error || invoiceResult.error || allocationResult.error) {
      setError("This client couldn’t be loaded. Check your connection and try again.");
    } else {
      const projectIds = new Set((projectResult.data ?? []).map((project) => project.id));
      setClient(current);
      setProjects(projectResult.data ?? []);
      setTasks((taskResult.data ?? []).filter((task) => projectIds.has(task.project_id)));
      setInvoices((invoiceResult.data ?? []).filter((invoice) => invoice.document_type === "invoice" && (
        invoice.client_id === current.id || (!invoice.client_id && invoice.client_email.toLowerCase() === current.client_email.toLowerCase())
      )));
      setAllocations(allocationResult.data ?? []);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const outstanding = useMemo(() => {
    const paid = allocations.reduce<Record<string, number>>((map, allocation) => {
      map[allocation.invoice_id] = (map[allocation.invoice_id] ?? 0) + allocation.amount;
      return map;
    }, {});
    return invoices.reduce((sum, invoice) => sum + Math.max(invoice.total - (paid[invoice.id] ?? 0), 0), 0);
  }, [allocations, invoices]);

  const share = async (regenerate = false) => {
    if (!id) return;
    setBusy(true);
    const { data, error: shareError } = await supabase.rpc("enable_client_share", { p_client_id: id, p_regenerate: regenerate });
    setBusy(false);
    if (shareError || !data) {
      toast.error("Couldn’t create the client link. Please try again.");
      return;
    }
    toast.success(regenerate ? "New link created. The old link no longer works." : "Client link is ready.");
    void load();
  };

  const stopSharing = async () => {
    if (!id) return;
    setBusy(true);
    const { error: shareError } = await supabase.rpc("disable_client_share", { p_client_id: id });
    setBusy(false);
    if (shareError) {
      toast.error("Couldn’t turn off the link. Please try again.");
      return;
    }
    toast.success("Client link turned off.");
    void load();
  };

  const copy = async () => {
    if (!client?.share_token) return;
    try {
      await navigator.clipboard.writeText(buildClientPortalUrl(client.share_token));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn’t copy. Select the link and copy it manually.");
    }
  };

  if (loading) return <DashboardLayout><PageLoader label="Loading client…" /></DashboardLayout>;
  if (error) return <DashboardLayout><ErrorState message={error} onRetry={() => void load()} /></DashboardLayout>;
  if (missing || !client) return <DashboardLayout><ErrorState message="This client isn’t available." /></DashboardLayout>;

  const currency = invoices[0]?.currency ?? projects[0]?.currency ?? "USD";
  const upcoming = tasks.filter((task) => task.status !== "done").sort((left, right) => (left.scheduled_at ?? "9999").localeCompare(right.scheduled_at ?? "9999"));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <Button variant="ghost" className="-ml-3" onClick={() => navigate("/dashboard/clients")}><ArrowLeft className="mr-2 h-4 w-4" />Clients</Button>
            <h1 className="text-3xl font-bold">{client.client_name}</h1>
            <p className="mt-1 text-muted-foreground">{client.client_email}{client.phone ? ` · ${client.phone}` : ""}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => navigate(`/dashboard/create?client=${client.id}`)}>Create invoice</Button>
            <Button variant="outline" onClick={() => navigate(`/dashboard/projects?client=${client.id}`)}><Plus className="mr-2 h-4 w-4" />New project</Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Outstanding</p><p className="mt-1 font-semibold">{formatCurrency(outstanding, currency)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Projects</p><p className="mt-1 font-semibold">{projects.length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Open work</p><p className="mt-1 font-semibold">{upcoming.length}</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Private client link</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Anyone with this link can see this client’s projects, scheduled work, and invoices. They do not need an account, and they cannot see your notes or expenses.</p>
            {client.share_token ? (
              <>
                <div className="flex gap-2">
                  <Input readOnly value={buildClientPortalUrl(client.share_token)} onFocus={(event) => event.target.select()} />
                  <Button variant="outline" onClick={() => void copy()}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button>
                </div>
                <p className="text-sm text-muted-foreground">Opened {client.view_count} {client.view_count === 1 ? "time" : "times"}{client.last_viewed_at ? ` · Last opened ${new Date(client.last_viewed_at).toLocaleString()}` : ""}.</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" disabled={busy} onClick={() => void share(true)}><RefreshCw className="mr-2 h-4 w-4" />Replace link</Button>
                  <Button variant="ghost" className="text-destructive hover:text-destructive" disabled={busy} onClick={() => void stopSharing()}><Unlink className="mr-2 h-4 w-4" />Turn off</Button>
                </div>
              </>
            ) : (
              <Button disabled={busy} onClick={() => void share(false)}><Link2 className="mr-2 h-4 w-4" />Create client link</Button>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Projects</CardTitle></CardHeader>
            <CardContent>
              {projects.length === 0 && <p className="text-sm text-muted-foreground">No projects yet.</p>}
              {projects.map((project) => (
                <button key={project.id} className="flex w-full items-center justify-between border-b py-3 text-left last:border-0" onClick={() => navigate(`/dashboard/projects/${project.id}`)}>
                  <span className="font-medium">{project.name}</span>
                  <Badge variant="outline">{project.status.replace(/_/g, " ")}</Badge>
                </button>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Schedule</CardTitle></CardHeader>
            <CardContent>
              {upcoming.length === 0 && <p className="text-sm text-muted-foreground">Nothing scheduled.</p>}
              {upcoming.map((task) => (
                <button key={task.id} className="flex w-full items-center justify-between gap-3 border-b py-3 text-left last:border-0" onClick={() => navigate(`/dashboard/projects/${task.project_id}`)}>
                  <span>
                    <span className="font-medium">{task.title}</span>
                    <span className="block text-sm text-muted-foreground">{formatScheduledAt(task.scheduled_at)}</span>
                  </span>
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    {formatEstimate(task.estimated_minutes)}
                    <Badge variant="outline">{taskStatusLabel(task.status)}</Badge>
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Invoices</CardTitle></CardHeader>
          <CardContent>
            {invoices.length === 0 && <p className="text-sm text-muted-foreground">No invoices yet.</p>}
            {invoices.map((invoice) => (
              <button key={invoice.id} className="flex w-full items-center justify-between border-b py-3 text-left last:border-0" onClick={() => navigate(`/dashboard/invoices/${invoice.id}`)}>
                <span>
                  <span className="font-medium">{invoice.invoice_number}</span>
                  <span className="block text-sm text-muted-foreground">Issued {invoice.issue_date} · Due {invoice.due_date}</span>
                </span>
                <span>{formatCurrency(invoice.total, invoice.currency)}</span>
              </button>
            ))}
          </CardContent>
        </Card>

        {client.notes && (
          <Card>
            <CardHeader><CardTitle>Internal notes</CardTitle></CardHeader>
            <CardContent><p className="whitespace-pre-line text-sm text-muted-foreground">{client.notes}</p></CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ClientDetail;
