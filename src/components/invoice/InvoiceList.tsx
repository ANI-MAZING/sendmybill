import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { FileText, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { canTransitionInvoiceStatus, isInvoiceStatus } from "@/lib/invoice";
import { formatCurrency } from "@/lib/currencies";
import type { InvoiceStatus } from "@/types/domain";
import { ErrorState, PageLoader } from "@/components/shared/AsyncState";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type Invoice = Pick<Tables<"invoices">, "id" | "invoice_number" | "client_name" | "total" | "status" | "created_at" | "due_date" | "currency">;

const InvoiceList = () => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase.from("invoices").select("id, invoice_number, client_name, total, status, created_at, due_date, currency").order("created_at", { ascending: false });
    if (fetchError) setError("Your invoices couldn’t be loaded. Check your connection and try again.");
    else setInvoices(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void fetchInvoices(); }, [fetchInvoices]);

  const filteredInvoices = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return invoices.filter((invoice) => {
      const matchesSearch = !search || invoice.invoice_number.toLowerCase().includes(search) || invoice.client_name.toLowerCase().includes(search);
      return matchesSearch && (statusFilter === "all" || invoice.status === statusFilter);
    });
  }, [invoices, searchTerm, statusFilter]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from("invoices").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    if (deleteError) {
      toast.error("Invoice couldn’t be deleted. Please retry.");
      return;
    }
    setInvoices((current) => current.filter(({ id }) => id !== deleteTarget.id));
    setDeleteTarget(null);
    toast.success("Invoice deleted.");
  };

  const handleStatusChange = async (invoice: Invoice, nextValue: string) => {
    if (!isInvoiceStatus(invoice.status) || !isInvoiceStatus(nextValue) || !canTransitionInvoiceStatus(invoice.status, nextValue)) {
      toast.error("That status change is not allowed.");
      return;
    }
    const previousStatus = invoice.status;
    setInvoices((current) => current.map((item) => item.id === invoice.id ? { ...item, status: nextValue } : item));
    const { error: updateError } = await supabase.from("invoices").update({ status: nextValue }).eq("id", invoice.id);
    if (updateError) {
      setInvoices((current) => current.map((item) => item.id === invoice.id ? { ...item, status: previousStatus } : item));
      toast.error("Status couldn’t be updated. Please retry.");
    } else toast.success("Invoice status updated.");
  };

  if (loading) return <PageLoader label="Loading invoices…" />;
  if (error) return <ErrorState message={error} onRetry={() => void fetchInvoices()} />;

  return (
    <div className="space-y-4">
      {invoices.length > 0 && (
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search invoices" placeholder="Search by invoice number or client name…" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="pl-10" /></div>
          <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Filter by status" /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="draft">Draft</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="paid">Paid</SelectItem></SelectContent></Select>
        </div>
      )}

      {filteredInvoices.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="text-xl font-semibold">{invoices.length === 0 ? "Create your first invoice" : "No matching invoices"}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{invoices.length === 0 ? "Start with a guided invoice, preview it in real time, and save it to your workspace." : "Try a different search or status filter."}</p>
            {invoices.length === 0 && <Button className="mt-6" onClick={() => navigate("/dashboard/create")}><Plus className="mr-2 h-4 w-4" />Create first invoice</Button>}
          </CardContent>
        </Card>
      ) : filteredInvoices.map((invoice) => (
        <Card key={invoice.id}>
          <CardHeader>
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
              <div><CardTitle className="text-lg">{invoice.invoice_number}</CardTitle><CardDescription>{invoice.client_name}</CardDescription></div>
              <div className="flex items-center gap-2">
                <Select value={invoice.status} onValueChange={(value) => void handleStatusChange(invoice, value)}><SelectTrigger className="h-8 w-[110px]"><SelectValue /></SelectTrigger><SelectContent>{statusOptions(invoice.status).map((status) => <SelectItem key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</SelectItem>)}</SelectContent></Select>
                <Button aria-label={`Edit ${invoice.invoice_number}`} variant="ghost" size="icon" onClick={() => navigate(`/dashboard/edit/${invoice.id}`)}><Pencil className="h-4 w-4" /></Button>
                <Button aria-label={`Delete ${invoice.invoice_number}`} variant="ghost" size="icon" onClick={() => setDeleteTarget(invoice)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          </CardHeader>
          <CardContent><div className="flex items-center justify-between text-sm"><div className="space-y-1 text-muted-foreground"><p>Created: {format(new Date(invoice.created_at), "MMM dd, yyyy")}</p><p>Due: {format(new Date(`${invoice.due_date}T00:00:00`), "MMM dd, yyyy")}</p></div><p className="text-2xl font-bold">{formatCurrency(invoice.total, invoice.currency)}</p></div></CardContent>
        </Card>
      ))}

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete invoice {deleteTarget?.invoice_number}?</AlertDialogTitle><AlertDialogDescription>This permanently removes the invoice from your workspace. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleting}>Keep invoice</AlertDialogCancel><AlertDialogAction disabled={deleting} onClick={(event) => { event.preventDefault(); void handleDelete(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{deleting ? "Deleting…" : "Delete invoice"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const statusOptions = (status: string): InvoiceStatus[] => {
  if (status === "draft") return ["draft", "pending"];
  if (status === "paid") return ["pending", "paid"];
  return ["draft", "pending", "paid"];
};

export default InvoiceList;
