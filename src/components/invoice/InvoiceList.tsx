import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Archive, ArchiveRestore, Copy, Download, Eye, FileText, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { canTransitionInvoiceStatus, getInvoiceDisplayStatus, isDatabaseSchemaCompatibilityError, isInvoiceStatus } from "@/lib/invoice";
import { formatCurrency } from "@/lib/currencies";
import { createInvoicesCsv } from "@/lib/csv";
import { ErrorState, PageLoader } from "@/components/shared/AsyncState";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Invoice = Pick<
  Tables<"invoices">,
  "id" | "invoice_number" | "client_name" | "total" | "status" | "created_at" | "issue_date" | "due_date" | "currency" | "archived_at" | "document_type" | "proforma_status" | "expiry_date"
>;

type StatusFilter = string;
const proformaStatuses = ["draft", "sent", "viewed", "accepted", "rejected", "expired", "converted"];
const documentStatus = (invoice: Invoice): string => {
  if (invoice.archived_at) return "archived";
  if (invoice.document_type === "proforma") {
    if (invoice.proforma_status === "draft" && invoice.expiry_date && invoice.expiry_date < new Date().toISOString().slice(0, 10)) return "expired";
    return invoice.proforma_status ?? "draft";
  }
  return getInvoiceDisplayStatus(invoice);
};

const InvoiceList = () => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busyInvoiceId, setBusyInvoiceId] = useState<string | null>(null);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(() => new Set());
  const [legacySchema, setLegacySchema] = useState(false);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    const currentResult = await supabase
      .from("invoices")
      .select("id, invoice_number, client_name, total, status, created_at, issue_date, due_date, currency, archived_at, document_type, proforma_status, expiry_date")
      .order("issue_date", { ascending: false });

    if (!currentResult.error) {
      setInvoices(currentResult.data ?? []);
      setLegacySchema(false);
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
      .select("id, invoice_number, client_name, total, status, created_at, issue_date, due_date, currency")
      .order("issue_date", { ascending: false });
    let legacyData = legacyResult.data;
    let legacyError = legacyResult.error;

    if (legacyError && isDatabaseSchemaCompatibilityError(legacyError)) {
      const originalResult = await supabase
        .from("invoices")
        .select("id, invoice_number, client_name, total, status, created_at, issue_date, due_date")
        .order("issue_date", { ascending: false });
      legacyError = originalResult.error;
      legacyData = originalResult.error
        ? null
        : (originalResult.data ?? []).map((invoice) => ({ ...invoice, currency: "USD" }));
    }

    if (legacyError) setError("Your invoices couldn’t be loaded. Check your connection and try again.");
    else {
      setInvoices((legacyData ?? []).map((invoice) => ({
        ...invoice,
        archived_at: null,
        document_type: "invoice",
        proforma_status: null,
        expiry_date: null,
      })));
      setLegacySchema(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchInvoices();
  }, [fetchInvoices]);

  const filteredInvoices = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return invoices.filter((invoice) => {
      const displayStatus = documentStatus(invoice);
      const matchesSearch = !search
        || invoice.invoice_number.toLowerCase().includes(search)
        || invoice.client_name.toLowerCase().includes(search);
      const matchesStatus = statusFilter === "all"
        || (statusFilter === "active" ? displayStatus !== "archived" : displayStatus === statusFilter);
      return matchesSearch && matchesStatus;
    });
  }, [invoices, searchTerm, statusFilter]);

  const selectedInvoices = useMemo(
    () => invoices.filter((invoice) => selectedInvoiceIds.has(invoice.id)),
    [invoices, selectedInvoiceIds],
  );
  const allFilteredSelected = filteredInvoices.length > 0 && filteredInvoices.every((invoice) => selectedInvoiceIds.has(invoice.id));
  const someFilteredSelected = filteredInvoices.some((invoice) => selectedInvoiceIds.has(invoice.id));

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
    setSelectedInvoiceIds((current) => {
      const next = new Set(current);
      next.delete(deleteTarget.id);
      return next;
    });
    setDeleteTarget(null);
    toast.success("Invoice deleted.");
  };

  const handleStatusChange = async (invoice: Invoice, nextValue: string) => {
    if (invoice.archived_at) {
      toast.error("Restore this invoice before changing its status.");
      return;
    }
    if (invoice.document_type === "proforma") {
      if (!proformaStatuses.includes(nextValue)) return toast.error("Unknown proforma status.");
      const previous = invoice.proforma_status;
      setInvoices((current) => current.map((item) => item.id === invoice.id ? { ...item, proforma_status: nextValue } : item));
      const { error } = await supabase.from("invoices").update({ proforma_status: nextValue }).eq("id", invoice.id);
      if (error) { setInvoices((current) => current.map((item) => item.id === invoice.id ? { ...item, proforma_status: previous } : item)); toast.error("Status couldn’t be updated."); }
      else toast.success("Proforma status updated.");
      return;
    }
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

  const handleArchiveChange = async (invoice: Invoice, shouldArchive: boolean) => {
    const previousArchivedAt = invoice.archived_at;
    const archivedAt = shouldArchive ? new Date().toISOString() : null;
    setBusyInvoiceId(invoice.id);
    setInvoices((current) => current.map((item) => item.id === invoice.id ? { ...item, archived_at: archivedAt } : item));

    const { error: updateError } = await supabase.from("invoices").update({ archived_at: archivedAt }).eq("id", invoice.id);
    setBusyInvoiceId(null);
    if (updateError) {
      setInvoices((current) => current.map((item) => item.id === invoice.id ? { ...item, archived_at: previousArchivedAt } : item));
      toast.error(`Invoice couldn’t be ${shouldArchive ? "archived" : "restored"}. Please retry.`);
      return;
    }
    toast.success(shouldArchive ? "Invoice archived." : "Invoice restored.");
  };

  const handleDuplicate = async (invoice: Invoice) => {
    setBusyInvoiceId(invoice.id);
    const { data: duplicatedInvoiceId, error: duplicateError } = await supabase.rpc("duplicate_invoice", {
      p_source_invoice_id: invoice.id,
    });
    setBusyInvoiceId(null);

    if (duplicateError || !duplicatedInvoiceId) {
      toast.error("Invoice couldn’t be duplicated. Please retry.");
      return;
    }

    toast.success("Draft invoice created from the original.");
    navigate(`/dashboard/edit/${duplicatedInvoiceId}`);
  };

  const toggleInvoiceSelection = (invoiceId: string, selected: boolean) => {
    setSelectedInvoiceIds((current) => {
      const next = new Set(current);
      if (selected) next.add(invoiceId);
      else next.delete(invoiceId);
      return next;
    });
  };

  const toggleFilteredSelection = (selected: boolean) => {
    setSelectedInvoiceIds((current) => {
      const next = new Set(current);
      filteredInvoices.forEach(({ id }) => selected ? next.add(id) : next.delete(id));
      return next;
    });
  };

  const handleCsvExport = () => {
    if (selectedInvoices.length === 0) return;
    const blob = new Blob(["\uFEFF", createInvoicesCsv(selectedInvoices)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`${selectedInvoices.length} invoice${selectedInvoices.length === 1 ? "" : "s"} exported.`);
  };

  if (loading) return <PageLoader label="Loading invoices…" />;
  if (error) return <ErrorState message={error} onRetry={() => void fetchInvoices()} />;

  return (
    <div className="space-y-4">
      {legacySchema && (
        <Card className="border-amber-300 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/20">
          <CardContent className="py-4 text-sm text-amber-950 dark:text-amber-100">
            Your existing invoices are safe and available. New Phase 1 actions such as duplicate and archive will appear after the workspace database update is deployed.
          </CardContent>
        </Card>
      )}
      {invoices.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search invoices"
                placeholder="Search by invoice number or client name…"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Filter by status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active invoices</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
                <SelectItem value="sent">Proforma: Sent</SelectItem>
                <SelectItem value="viewed">Proforma: Viewed</SelectItem>
                <SelectItem value="accepted">Proforma: Accepted</SelectItem>
                <SelectItem value="rejected">Proforma: Rejected</SelectItem>
                <SelectItem value="expired">Proforma: Expired</SelectItem>
                <SelectItem value="converted">Proforma: Converted</SelectItem>
                <SelectItem value="all">All statuses</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col justify-between gap-3 rounded-lg border bg-card px-4 py-3 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={allFilteredSelected ? true : someFilteredSelected ? "indeterminate" : false}
                onCheckedChange={(checked) => toggleFilteredSelection(checked === true)}
              />
              Select all matching ({filteredInvoices.length})
            </label>
            <Button variant="outline" size="sm" disabled={selectedInvoices.length === 0} onClick={handleCsvExport}>
              <Download className="mr-2 h-4 w-4" />Export selected CSV ({selectedInvoices.length})
            </Button>
          </div>
        </div>
      )}

      {filteredInvoices.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="text-xl font-semibold">{invoices.length === 0 ? "Create your first invoice" : "No matching invoices"}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              {invoices.length === 0
                ? "Start with a guided invoice, preview it in real time, and save it to your workspace."
                : "Try a different search or status filter."}
            </p>
            {invoices.length === 0 && (
              <Button className="mt-6" onClick={() => navigate("/dashboard/create")}>
                <Plus className="mr-2 h-4 w-4" />Create first invoice
              </Button>
            )}
          </CardContent>
        </Card>
      ) : filteredInvoices.map((invoice) => {
        const displayStatus = documentStatus(invoice);
        const isBusy = busyInvoiceId === invoice.id;
        return (
          <Card key={invoice.id} className={displayStatus === "archived" ? "opacity-75" : undefined}>
            <CardHeader>
              <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Checkbox
                      aria-label={`Select ${invoice.invoice_number}`}
                      checked={selectedInvoiceIds.has(invoice.id)}
                      onCheckedChange={(checked) => toggleInvoiceSelection(invoice.id, checked === true)}
                    />
                    <CardTitle className="text-lg">
                      <button className="text-left hover:underline" onClick={() => navigate(`/dashboard/invoices/${invoice.id}`)}>
                        {invoice.invoice_number}
                      </button>
                    </CardTitle>
                    {invoice.document_type === "proforma" && <Badge variant="outline">PROFORMA</Badge>}
                    {(displayStatus === "overdue" || displayStatus === "archived") && (
                      <Badge variant={displayStatus === "overdue" ? "destructive" : "secondary"}>{statusLabel(displayStatus)}</Badge>
                    )}
                  </div>
                  <CardDescription>{invoice.client_name}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {displayStatus !== "archived" && (invoice.document_type === "proforma" || (isInvoiceStatus(invoice.status) && invoice.status !== "paid")) && (
                    <Select value={invoice.document_type === "proforma" ? invoice.proforma_status ?? "draft" : invoice.status} onValueChange={(value) => void handleStatusChange(invoice, value)} disabled={isBusy}>
                      <SelectTrigger className="h-8 w-[110px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(invoice.document_type === "proforma" ? proformaStatuses : statusOptions(invoice.status)).map((status) => (
                          <SelectItem key={status} value={status}>{statusLabel(status)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {invoice.document_type === "invoice" && invoice.status === "paid" && <Badge variant="outline">Paid by allocations</Badge>}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button aria-label={`Actions for ${invoice.invoice_number}`} variant="ghost" size="icon" disabled={isBusy}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => navigate(`/dashboard/invoices/${invoice.id}`)}>
                        <Eye className="mr-2 h-4 w-4" />View details
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => navigate(`/dashboard/edit/${invoice.id}`)}>
                        <Pencil className="mr-2 h-4 w-4" />Edit
                      </DropdownMenuItem>
                      {!legacySchema && (
                        <>
                          <DropdownMenuItem onSelect={() => void handleDuplicate(invoice)}>
                            <Copy className="mr-2 h-4 w-4" />Duplicate as draft
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => void handleArchiveChange(invoice, !invoice.archived_at)}>
                            {invoice.archived_at
                              ? <ArchiveRestore className="mr-2 h-4 w-4" />
                              : <Archive className="mr-2 h-4 w-4" />}
                            {invoice.archived_at ? "Restore" : "Archive"}
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDeleteTarget(invoice)}>
                        <Trash2 className="mr-2 h-4 w-4" />Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm">
                <div className="space-y-1 text-muted-foreground">
                  <p>Invoice date: {format(new Date(`${invoice.issue_date}T00:00:00`), "MMM dd, yyyy")}</p>
                  <p>{invoice.document_type === "proforma" && invoice.expiry_date ? "Valid until" : "Due"}: {format(new Date(`${invoice.document_type === "proforma" && invoice.expiry_date ? invoice.expiry_date : invoice.due_date}T00:00:00`), "MMM dd, yyyy")}</p>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(invoice.total, invoice.currency)}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete invoice {deleteTarget?.invoice_number}?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the invoice from your workspace. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep invoice</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete invoice"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const statusOptions = (status: string): string[] => {
  if (status === "draft") return ["draft", "pending"];
  return ["draft", "pending"];
};

const statusLabel = (status: string): string => status[0].toUpperCase() + status.slice(1);

export default InvoiceList;
