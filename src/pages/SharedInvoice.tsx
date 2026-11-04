import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { FileX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import InvoicePreview from "@/components/invoice/InvoicePreview";
import { ErrorState, PageLoader } from "@/components/shared/AsyncState";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currencies";
import { fromDateInputValue } from "@/lib/invoice";
import { toInvoiceFormData, type RenderableInvoice } from "@/lib/invoice-record";
import { calculateInvoiceTotals } from "@/lib/money";
import type { InvoiceFormData } from "@/types/domain";

interface SharedInvoice extends RenderableInvoice {
  total: number;
  status: string;
  amount_paid: number;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "error" }
  | { kind: "ready"; invoice: SharedInvoice; formData: InvoiceFormData };

const SharedInvoicePage = () => {
  const { token } = useParams();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  // Private documents must not be indexed or leak their URL through referrers.
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
      const { data, error } = await supabase.rpc("get_shared_invoice", { p_token: token ?? "" });
      if (!active) return;
      if (error) return setState({ kind: "error" });
      if (!data || typeof data !== "object" || Array.isArray(data)) return setState({ kind: "missing" });
      const invoice = data as unknown as SharedInvoice;
      const formData = toInvoiceFormData(invoice);
      if (!formData) return setState({ kind: "missing" });
      setState({ kind: "ready", invoice, formData });
    };
    void load();
    return () => {
      active = false;
    };
  }, [token, attempt]);

  if (state.kind === "loading") return <PageLoader label="Loading invoice…" />;

  if (state.kind === "error") {
    return (
      <Shell>
        <ErrorState message="We couldn’t load this invoice. Check your connection and try again." onRetry={() => setAttempt((n) => n + 1)} />
      </Shell>
    );
  }

  if (state.kind === "missing") {
    return (
      <Shell>
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <FileX className="mb-4 h-10 w-10 text-muted-foreground" />
            <h1 className="text-lg font-semibold">This link isn’t available</h1>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              The invoice may have been removed or the link was turned off. Please ask the sender for a new link.
            </p>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  const { invoice, formData } = state;
  const totals = calculateInvoiceTotals(formData.items, formData.taxRate, formData.discountType, formData.discountValue);
  const balance = Math.max(invoice.total - invoice.amount_paid, 0);
  const isProforma = invoice.document_type === "proforma";
  const isPaid = !isProforma && (invoice.status === "paid" || balance === 0);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const isOverdue = !isProforma && !isPaid && invoice.status === "pending" && fromDateInputValue(invoice.due_date) < startOfToday;

  return (
    <Shell>
      <div className="space-y-4">
        {!isProforma && (
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <p className="text-sm text-muted-foreground">
                  {formData.sellerSnapshot?.company_name || "Invoice"} · {invoice.invoice_number}
                </p>
                <p className="text-2xl font-bold">
                  {isPaid ? formatCurrency(invoice.total, invoice.currency) : formatCurrency(balance, invoice.currency)}
                </p>
              </div>
              {isPaid ? (
                <Badge>Paid</Badge>
              ) : (
                <Badge variant={isOverdue ? "destructive" : "outline"}>
                  {isOverdue ? "Overdue" : "Due"} {formData.dueDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </Badge>
              )}
            </CardContent>
          </Card>
        )}
        <InvoicePreview formData={formData} totals={totals} />
      </div>
    </Shell>
  );
};

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-background px-4 py-6 sm:px-6">
    <div className="mx-auto max-w-4xl">{children}</div>
    <p className="mt-8 text-center text-xs text-muted-foreground">Created with Sendmybill</p>
  </div>
);

export default SharedInvoicePage;
