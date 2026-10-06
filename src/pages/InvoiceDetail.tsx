import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, Pencil, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import InvoicePreview from "@/components/invoice/InvoicePreview";
import { PageLoader } from "@/components/shared/AsyncState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currencies";
import { getInvoiceDisplayStatus } from "@/lib/invoice";
import { toInvoiceFormData } from "@/lib/invoice-record";
import { calculateInvoiceTotals } from "@/lib/money";
import type { InvoiceFormData } from "@/types/domain";
import ShareInvoicePanel from "@/components/invoice/ShareInvoicePanel";

type InvoiceRecord = Tables<"invoices">;

interface InvoiceDetailState {
  invoice: InvoiceRecord;
  formData: InvoiceFormData;
}

const InvoiceDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [detail, setDetail] = useState<InvoiceDetailState | null>(null);
  const [allocatedAmount, setAllocatedAmount] = useState(0);

  const fetchInvoice = useCallback(async () => {
    if (!id) {
      navigate("/unauthorized", { replace: true });
      return;
    }

    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) {
      navigate("/unauthorized", { replace: true });
      return;
    }

    const formData = toInvoiceFormData(data);
    if (!formData) {
      toast.error(
        "This invoice contains invalid line items and cannot be displayed safely.",
      );
      navigate("/dashboard", { replace: true });
      return;
    }

    setDetail({ invoice: data, formData });
    if (data.document_type === "invoice") {
      const { data: paymentAllocations } = await supabase
        .from("payment_allocations")
        .select("amount")
        .eq("invoice_id", data.id);
      setAllocatedAmount(
        (paymentAllocations ?? []).reduce(
          (sum, allocation) => sum + allocation.amount,
          0,
        ),
      );
    }
  }, [id, navigate]);

  useEffect(() => {
    void fetchInvoice();
  }, [fetchInvoice]);

  if (!detail)
    return (
      <DashboardLayout>
        <PageLoader label="Loading invoice…" />
      </DashboardLayout>
    );

  const { invoice, formData } = detail;
  const displayStatus =
    invoice.document_type === "proforma"
      ? (invoice.proforma_status ?? "draft")
      : getInvoiceDisplayStatus(invoice);
  const totals = calculateInvoiceTotals(
    formData.items,
    formData.taxRate,
    formData.discountType,
    formData.discountValue,
  );
  const convertProforma = async () => {
    const { data, error } = await supabase.rpc("convert_proforma", {
      p_proforma_id: invoice.id,
    });
    if (error || !data) return toast.error("Proforma couldn’t be converted.");
    toast.success("Final invoice created from the proforma snapshot.");
    navigate(`/dashboard/invoices/${data}`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <Button
              variant="ghost"
              className="-ml-3 mb-2"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to invoices
            </Button>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold">{invoice.invoice_number}</h1>
              {invoice.document_type === "proforma" && <Badge>PROFORMA</Badge>}
              <Badge
                variant={
                  displayStatus === "overdue"
                    ? "destructive"
                    : displayStatus === "archived"
                      ? "secondary"
                      : "outline"
                }
              >
                {statusLabel(displayStatus)}
              </Badge>
            </div>
            <p className="mt-1 text-muted-foreground">
              {invoice.document_type === "proforma" ? "Proforma" : "Invoice"}{" "}
              for {invoice.client_name}
            </p>
          </div>
          <div className="flex gap-2">
            {invoice.document_type === "proforma" &&
              invoice.proforma_status !== "converted" && (
                <Button onClick={() => void convertProforma()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Convert to invoice
                </Button>
              )}
            <Button
              variant="outline"
              onClick={() => navigate(`/dashboard/edit/${invoice.id}`)}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit document
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard
            label="Client"
            value={invoice.client_name}
            detail={invoice.client_email}
          />
          <SummaryCard
            label="Issued"
            value={format(formData.issueDate, "MMM dd, yyyy")}
          />
          <SummaryCard
            label="Due"
            value={format(formData.dueDate, "MMM dd, yyyy")}
          />
          <SummaryCard
            label="Total"
            value={formatCurrency(invoice.total, invoice.currency)}
          />
          <SummaryCard
            label={
              invoice.document_type === "proforma"
                ? "Accounting impact"
                : "Balance due"
            }
            value={
              invoice.document_type === "proforma"
                ? "Excluded from revenue"
                : formatCurrency(
                    Math.max(invoice.total - allocatedAmount, 0),
                    invoice.currency,
                  )
            }
          />
        </div>

        {invoice.document_type === "invoice" && (
          <ShareInvoicePanel
            invoiceId={invoice.id}
            token={invoice.share_token}
            viewCount={invoice.view_count}
            lastViewedAt={invoice.last_viewed_at}
            onChange={() => void fetchInvoice()}
          />
        )}

        <div className="mx-auto max-w-5xl">
          <InvoicePreview formData={formData} totals={totals} />
        </div>
      </div>
    </DashboardLayout>
  );
};

const SummaryCard = ({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) => (
  <Card>
    <CardContent className="p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-semibold" title={value}>
        {value}
      </p>
      {detail && (
        <p
          className="mt-1 truncate text-sm text-muted-foreground"
          title={detail}
        >
          {detail}
        </p>
      )}
    </CardContent>
  </Card>
);

const statusLabel = (status: string): string =>
  status[0].toUpperCase() + status.slice(1);

export default InvoiceDetail;
