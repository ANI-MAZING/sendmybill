import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { FileX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import InvoicePreview from "@/components/invoice/InvoicePreview";
import { ErrorState, PageLoader } from "@/components/shared/AsyncState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currencies";
import { toInvoiceFormData, type RenderableInvoice } from "@/lib/invoice-record";
import { calculateInvoiceTotals } from "@/lib/money";
import { formatEstimate, formatScheduledAt, taskStatusLabel } from "@/lib/schedule";

interface PortalProject {
  id: string;
  name: string;
  status: string;
  description: string | null;
}

interface PortalWork {
  id: string;
  project_id: string;
  project_name: string;
  title: string;
  status: string;
  scheduled_at: string | null;
  estimated_minutes: number;
  is_deliverable: boolean;
}

interface PortalInvoice extends RenderableInvoice {
  id: string;
  total: number;
  status: string;
  amount_paid: number;
}

interface PortalPayload {
  client_name: string;
  company_name: string | null;
  projects: PortalProject[];
  work: PortalWork[];
  invoices: PortalInvoice[];
}

type LoadState =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "error" }
  | { kind: "ready"; portal: PortalPayload };

const ClientPortal = () => {
  const { token } = useParams();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex, nofollow";
    const referrer = document.createElement("meta");
    referrer.name = "referrer";
    referrer.content = "no-referrer";
    document.head.append(robots, referrer);
    return () => {
      robots.remove();
      referrer.remove();
    };
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setState({ kind: "loading" });
      const { data, error } = await supabase.rpc("get_shared_client", { p_token: token ?? "" });
      if (!active) return;
      if (error) return setState({ kind: "error" });
      if (!data || typeof data !== "object" || Array.isArray(data)) return setState({ kind: "missing" });
      const portal = data as unknown as PortalPayload;
      if (!portal.client_name || !Array.isArray(portal.projects) || !Array.isArray(portal.work) || !Array.isArray(portal.invoices)) {
        return setState({ kind: "missing" });
      }
      setState({ kind: "ready", portal });
    };
    void load();
    return () => {
      active = false;
    };
  }, [token, attempt]);

  if (state.kind === "loading") return <PageLoader label="Loading your projects…" />;
  if (state.kind === "error") {
    return <Shell><ErrorState message="We couldn’t load this page. Check your connection and try again." onRetry={() => setAttempt((value) => value + 1)} /></Shell>;
  }
  if (state.kind === "missing") {
    return (
      <Shell>
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <FileX className="mb-4 h-10 w-10 text-muted-foreground" />
            <h1 className="text-lg font-semibold">This link isn’t available</h1>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">Ask the sender for a new link. This page does not require an account.</p>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  const { portal } = state;
  const openInvoice = portal.invoices.find((invoice) => invoice.id === openInvoiceId) ?? null;
  const openForm = openInvoice ? toInvoiceFormData(openInvoice) : null;

  return (
    <Shell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">{portal.company_name || "Project update"}</p>
          <h1 className="text-3xl font-bold">{portal.client_name}</h1>
        </div>

        <Card>
          <CardHeader><CardTitle>Projects</CardTitle></CardHeader>
          <CardContent>
            {portal.projects.length === 0 && <p className="text-sm text-muted-foreground">No projects yet.</p>}
            {portal.projects.map((project) => (
              <div key={project.id} className="border-b py-3 last:border-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{project.name}</p>
                  <Badge variant="outline">{project.status.replace(/_/g, " ")}</Badge>
                </div>
                {project.description && <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Work</CardTitle></CardHeader>
          <CardContent>
            {portal.work.length === 0 && <p className="text-sm text-muted-foreground">Nothing scheduled yet.</p>}
            {portal.work.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 border-b py-3 last:border-0">
                <div>
                  <p className="font-medium">{item.is_deliverable ? "Deliverable: " : ""}{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.project_name} · {formatScheduledAt(item.scheduled_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{formatEstimate(item.estimated_minutes)}</span>
                  <Badge variant="outline">{taskStatusLabel(item.status)}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Invoices</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {portal.invoices.length === 0 && <p className="text-sm text-muted-foreground">No invoices yet.</p>}
            {portal.invoices.map((invoice) => {
              const balance = Math.max(invoice.total - invoice.amount_paid, 0);
              const paid = invoice.document_type === "invoice" && (invoice.status === "paid" || balance === 0);
              return (
                <div key={invoice.id} className="flex items-center justify-between gap-3 border-b py-3 last:border-0">
                  <div>
                    <p className="font-medium">{invoice.invoice_number}</p>
                    <p className="text-sm text-muted-foreground">Due {invoice.due_date} · {paid ? "Paid" : `${formatCurrency(balance, invoice.currency)} due`}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setOpenInvoiceId(invoice.id === openInvoiceId ? null : invoice.id)}>
                    {invoice.id === openInvoiceId ? "Hide" : "View"}
                  </Button>
                </div>
              );
            })}
            {openInvoice && openForm && (
              <InvoicePreview formData={openForm} totals={calculateInvoiceTotals(openForm.items, openForm.taxRate, openForm.discountType, openForm.discountValue)} />
            )}
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
};

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-background px-4 py-6 sm:px-6">
    <div className="mx-auto max-w-3xl">{children}</div>
    <p className="mt-8 text-center text-xs text-muted-foreground">Shared privately with Sendmybill</p>
  </div>
);

export default ClientPortal;
