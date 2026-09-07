import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Eye, FileText, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { ErrorState, PageLoader } from "@/components/shared/AsyncState";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { formatCurrency } from "@/lib/currencies";
import { canTransitionInvoiceStatus, getInvoiceDisplayStatus, isDatabaseSchemaCompatibilityError, isInvoiceStatus } from "@/lib/invoice";

type Invoice = Pick<
  Tables<"invoices">,
  "id" | "invoice_number" | "client_name" | "total" | "status" | "issue_date" | "due_date" | "currency" | "archived_at" | "document_type" | "proforma_status" | "expiry_date"
>;

const invoiceStatus = (invoice: Invoice): string => {
  if (invoice.archived_at) return "archived";
  if (invoice.document_type === "proforma") {
    if (invoice.proforma_status === "draft" && invoice.expiry_date && invoice.expiry_date < new Date().toISOString().slice(0, 10)) {
      return "expired";
    }
    return invoice.proforma_status ?? "draft";
  }
  return getInvoiceDisplayStatus(invoice);
};

const statusLabel = (status: string): string => status[0].toUpperCase() + status.slice(1);
const formatDate = (value: string): string => format(new Date(`${value}T00:00:00`), "MMM dd, yyyy");
const proformaStatuses = ["draft", "sent", "viewed", "accepted", "rejected", "expired", "converted"];

const ManageInvoices = () => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyInvoiceId, setBusyInvoiceId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);

    const currentResult = await supabase
      .from("invoices")
      .select("id, invoice_number, client_name, total, status, issue_date, due_date, currency, archived_at, document_type, proforma_status, expiry_date")
      .order("issue_date", { ascending: false });

    if (!currentResult.error) {
      setInvoices(currentResult.data ?? []);
      setLoading(false);
      return;
    }

    if (!isDatabaseSchemaCompatibilityError(currentResult.error)) {
      setError("Your invoices couldn’t be loaded. Check your connection and try again.");
      setLoading(false);
      return;
    }

    const legacyResult = await supabase
      .from("invoices")
      .select("id, invoice_number, client_name, total, status, issue_date, due_date, currency")
      .order("issue_date", { ascending: false });
    let legacyData = legacyResult.data;
    let legacyError = legacyResult.error;

    if (legacyError && isDatabaseSchemaCompatibilityError(legacyError)) {
      const originalResult = await supabase
        .from("invoices")
        .select("id, invoice_number, client_name, total, status, issue_date, due_date")
        .order("issue_date", { ascending: false });
      legacyError = originalResult.error;
      legacyData = originalResult.error
        ? null
        : (originalResult.data ?? []).map((invoice) => ({ ...invoice, currency: "USD" }));
    }

    if (legacyError) {
      setError("Your invoices couldn’t be loaded. Check your connection and try again.");
    } else {
      setInvoices((legacyData ?? []).map((invoice) => ({
        ...invoice,
        archived_at: null,
        document_type: "invoice",
        proforma_status: null,
        expiry_date: null,
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchInvoices();
  }, [fetchInvoices]);

  const filteredInvoices = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    if (!search) return invoices;
    return invoices.filter((invoice) =>
      invoice.id.toLowerCase().includes(search)
      || invoice.client_name.toLowerCase().includes(search)
      || invoice.invoice_number.toLowerCase().includes(search),
    );
  }, [invoices, searchTerm]);

  const handleStatusChange = async (invoice: Invoice, nextStatus: string) => {
    if (invoice.archived_at) return;

    setBusyInvoiceId(invoice.id);
    if (invoice.document_type === "proforma") {
      if (!proformaStatuses.includes(nextStatus)) {
        setBusyInvoiceId(null);
        return;
      }
      const previousStatus = invoice.proforma_status;
      setInvoices((current) => current.map((item) => item.id === invoice.id ? { ...item, proforma_status: nextStatus } : item));
      const { error: updateError } = await supabase.from("invoices").update({ proforma_status: nextStatus }).eq("id", invoice.id);
      setBusyInvoiceId(null);
      if (updateError) {
        setInvoices((current) => current.map((item) => item.id === invoice.id ? { ...item, proforma_status: previousStatus } : item));
        toast.error("Status couldn’t be updated. Please retry.");
      } else {
        toast.success("Invoice status updated.");
      }
      return;
    }

    if (!isInvoiceStatus(invoice.status) || !isInvoiceStatus(nextStatus) || !canTransitionInvoiceStatus(invoice.status, nextStatus)) {
      setBusyInvoiceId(null);
      toast.error("That status change is not allowed.");
      return;
    }

    const previousStatus = invoice.status;
    setInvoices((current) => current.map((item) => item.id === invoice.id ? { ...item, status: nextStatus } : item));
    const { error: updateError } = await supabase.from("invoices").update({ status: nextStatus }).eq("id", invoice.id);
    setBusyInvoiceId(null);
    if (updateError) {
      setInvoices((current) => current.map((item) => item.id === invoice.id ? { ...item, status: previousStatus } : item));
      toast.error("Status couldn’t be updated. Please retry.");
    } else {
      toast.success("Invoice status updated.");
    }
  };

  const deleteInvoice = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from("invoices").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    if (deleteError) {
      toast.error("Invoice couldn’t be deleted. Remove any payment allocations first.");
      return;
    }
    setInvoices((current) => current.filter(({ id }) => id !== deleteTarget.id));
    setDeleteTarget(null);
    toast.success("Invoice deleted.");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-bold">Manage invoices</h1>
            <p className="mt-1 text-muted-foreground">Review every invoice and open a record for more details.</p>
          </div>
          <Button onClick={() => navigate("/dashboard/create")}>
            <Plus className="mr-2 h-4 w-4" />Create invoice
          </Button>
        </div>

        {loading ? (
          <PageLoader label="Loading invoices…" />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void fetchInvoices()} />
        ) : (
          <>
            <div className="relative max-w-xl">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search managed invoices"
                className="pl-10"
                placeholder="Search by ID, client, or serial number…"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>

            {filteredInvoices.length === 0 ? (
              <Card>
                <CardContent className="py-14 text-center">
                  <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                  <h2 className="text-xl font-semibold">{invoices.length === 0 ? "No invoices yet" : "No matching invoices"}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {invoices.length === 0 ? "Create your first invoice to see it here." : "Try a different search term."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <Table className="min-w-[1050px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Serial no.</TableHead>
                      <TableHead className="text-right">Total value</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Invoice date</TableHead>
                      <TableHead>Due date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((invoice) => {
                      const status = invoiceStatus(invoice);
                      return (
                        <TableRow key={invoice.id}>
                          <TableCell className="whitespace-nowrap font-mono text-xs">
                            <button className="hover:underline" onClick={() => navigate(`/dashboard/invoices/${invoice.id}`)}>
                              {invoice.id}
                            </button>
                          </TableCell>
                          <TableCell className="font-medium">{invoice.client_name}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            <button className="font-medium hover:underline" onClick={() => navigate(`/dashboard/invoices/${invoice.id}`)}>
                              {invoice.invoice_number}
                            </button>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right font-semibold">{formatCurrency(invoice.total, invoice.currency)}</TableCell>
                          <TableCell>
                            {status === "archived" || (invoice.document_type === "invoice" && invoice.status === "paid") ? (
                              <Badge variant={status === "archived" ? "secondary" : "outline"}>{statusLabel(status)}</Badge>
                            ) : (
                              <Select
                                value={invoice.document_type === "proforma" ? invoice.proforma_status ?? "draft" : invoice.status}
                                onValueChange={(value) => void handleStatusChange(invoice, value)}
                                disabled={busyInvoiceId === invoice.id}
                              >
                                <SelectTrigger aria-label={`Change status for ${invoice.invoice_number}`} className="h-8 w-[120px]">
                                  <span>{busyInvoiceId === invoice.id ? "Updating…" : statusLabel(status)}</span>
                                </SelectTrigger>
                                <SelectContent>
                                  {(invoice.document_type === "proforma" ? proformaStatuses : ["draft", "pending"]).map((option) => (
                                    <SelectItem key={option} value={option}>{statusLabel(option)}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{formatDate(invoice.issue_date)}</TableCell>
                          <TableCell className="whitespace-nowrap">{formatDate(invoice.due_date)}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button size="sm" variant="outline">Actions</Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => navigate(`/dashboard/invoices/${invoice.id}`)}><Eye className="mr-2 h-4 w-4" />View details</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => navigate(`/dashboard/edit/${invoice.id}`)}><Pencil className="mr-2 h-4 w-4" />Edit invoice</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDeleteTarget(invoice)}><Trash2 className="mr-2 h-4 w-4" />Delete invoice</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
            )}
          </>
        )}
        <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(value) => !value && !deleting && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete invoice {deleteTarget?.invoice_number}?</AlertDialogTitle>
              <AlertDialogDescription>This permanently removes the invoice. Invoices with allocated payments cannot be deleted until those allocations are removed.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={(event) => { event.preventDefault(); void deleteInvoice(); }}>
                {deleting ? "Deleting…" : "Delete invoice"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default ManageInvoices;
