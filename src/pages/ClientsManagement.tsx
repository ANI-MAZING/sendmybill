import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Download, FileUp, History, Pencil, Plus, ReceiptText, Search, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { ErrorState, PageLoader } from "@/components/shared/AsyncState";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createClientsCsv, parseCsv } from "@/lib/csv";
import { formatCurrency } from "@/lib/currencies";

const clientSchema = z.object({
  client_name: z.string().trim().min(1, "Client name is required").max(200),
  client_email: z.string().trim().min(1, "Client email is required").email("Enter a valid email"),
  client_address: z.string().trim().max(2_000),
  phone: z.string().trim().max(50),
  notes: z.string().trim().max(5_000),
  tags: z.string().max(500),
});

type Client = Tables<"clients">;
type Invoice = Pick<Tables<"invoices">, "id" | "client_id" | "client_email" | "invoice_number" | "issue_date" | "due_date" | "total" | "currency" | "document_type">;
type Payment = Pick<Tables<"payments">, "id" | "client_id" | "payment_date">;
type Allocation = Pick<Tables<"payment_allocations">, "invoice_id" | "amount">;
type ClientForm = z.infer<typeof clientSchema>;

const emptyForm: ClientForm = { client_name: "", client_email: "", client_address: "", phone: "", notes: "", tags: "" };

const ClientsManagement = () => {
  const navigate = useNavigate();
  const importRef = useRef<HTMLInputElement>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [detailClient, setDetailClient] = useState<Client | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<ClientForm>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ClientForm, string>>>({});
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("all");
  const [balanceFilter, setBalanceFilter] = useState("all");
  const [sort, setSort] = useState("name");

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const [clientResult, invoiceResult, paymentResult, allocationResult] = await Promise.all([
      supabase.from("clients").select("*").order("client_name"),
      supabase.from("invoices").select("id, client_id, client_email, invoice_number, issue_date, due_date, total, currency, document_type"),
      supabase.from("payments").select("id, client_id, payment_date"),
      supabase.from("payment_allocations").select("invoice_id, amount"),
    ]);
    if (clientResult.error || invoiceResult.error || paymentResult.error || allocationResult.error) {
      setLoadError("Your client workspace couldn’t be loaded. Check your connection and try again.");
    } else {
      setClients(clientResult.data ?? []);
      setInvoices(invoiceResult.data ?? []);
      setPayments(paymentResult.data ?? []);
      setAllocations(allocationResult.data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void fetchClients(); }, [fetchClients]);

  const allocationsByInvoice = useMemo(() => allocations.reduce<Record<string, number>>((totals, allocation) => {
    totals[allocation.invoice_id] = (totals[allocation.invoice_id] ?? 0) + allocation.amount;
    return totals;
  }, {}), [allocations]);

  const clientInvoices = useCallback((client: Client) => invoices.filter((invoice) => invoice.document_type === "invoice" && (
    invoice.client_id === client.id || (!invoice.client_id && invoice.client_email.toLowerCase() === client.client_email.toLowerCase())
  )), [invoices]);

  const clientMetrics = useCallback((client: Client) => {
    const history = clientInvoices(client);
    const outstanding = history.reduce((sum, invoice) => sum + Math.max(invoice.total - (allocationsByInvoice[invoice.id] ?? 0), 0), 0);
    const lastInvoiceDate = history.map(({ issue_date }) => issue_date).sort().slice(-1)[0] ?? null;
    const lastPaymentDate = payments.filter(({ client_id }) => client_id === client.id).map(({ payment_date }) => payment_date).sort().slice(-1)[0] ?? null;
    return { history, outstanding, lastInvoiceDate, lastPaymentDate };
  }, [allocationsByInvoice, clientInvoices, payments]);

  const allTags = useMemo(() => [...new Set(clients.flatMap(({ tags }) => tags))].sort(), [clients]);
  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();
    return clients.filter((client) => {
      const metrics = clientMetrics(client);
      const matchesSearch = !query || [client.client_name, client.client_email, client.phone ?? "", client.notes ?? "", ...client.tags].some((value) => value.toLowerCase().includes(query));
      const matchesTag = tagFilter === "all" || client.tags.includes(tagFilter);
      const matchesBalance = balanceFilter === "all" || (balanceFilter === "outstanding" ? metrics.outstanding > 0 : metrics.outstanding === 0);
      return matchesSearch && matchesTag && matchesBalance;
    }).sort((left, right) => {
      if (sort === "outstanding") return clientMetrics(right).outstanding - clientMetrics(left).outstanding;
      if (sort === "recent") return (clientMetrics(right).lastInvoiceDate ?? "").localeCompare(clientMetrics(left).lastInvoiceDate ?? "");
      return left.client_name.localeCompare(right.client_name);
    });
  }, [balanceFilter, clientMetrics, clients, search, sort, tagFilter]);

  const duplicateClient = clients.find((client) => client.id !== editingClient?.id && client.client_email.toLowerCase() === formData.client_email.trim().toLowerCase());

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingClient(null);
    setFieldErrors({});
    setDuplicateAcknowledged(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validation = clientSchema.safeParse(formData);
    if (!validation.success) {
      const nextErrors: Partial<Record<keyof ClientForm, string>> = {};
      validation.error.issues.forEach((issue) => { const field = issue.path[0] as keyof ClientForm; nextErrors[field] ??= issue.message; });
      setFieldErrors(nextErrors);
      return;
    }
    if (duplicateClient && !duplicateAcknowledged) {
      setDuplicateAcknowledged(true);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return toast.error("Your session has expired.");
    setSaving(true);
    const payload = {
      client_name: validation.data.client_name,
      client_email: validation.data.client_email.toLowerCase(),
      client_address: validation.data.client_address || null,
      phone: validation.data.phone || null,
      notes: validation.data.notes || null,
      tags: validation.data.tags.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean),
    };
    const result = editingClient
      ? await supabase.from("clients").update(payload).eq("id", editingClient.id)
      : await supabase.from("clients").insert({ ...payload, user_id: user.id });
    setSaving(false);
    if (result.error) return toast.error("Client couldn’t be saved. Please retry.");
    toast.success(editingClient ? "Client updated." : "Client added.");
    setOpen(false);
    resetForm();
    void fetchClients();
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      client_name: client.client_name, client_email: client.client_email,
      client_address: client.client_address ?? "", phone: client.phone ?? "",
      notes: client.notes ?? "", tags: client.tags.join(", "),
    });
    setOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("clients").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    if (error) return toast.error("This client may still have projects. Archive those relationships before deleting the client.");
    setClients((current) => current.filter(({ id }) => id !== deleteTarget.id));
    setDeleteTarget(null);
    toast.success("Client deleted.");
  };

  const downloadClients = () => {
    const blob = new Blob(["\uFEFF", createClientsCsv(filteredClients)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `clients-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importClients = async (file: File) => {
    const rows = parseCsv(await file.text());
    const headers = rows[0]?.map((header) => header.trim().toLowerCase().replace(/^\uFEFF/, "")) ?? [];
    const nameIndex = headers.indexOf("client_name");
    const emailIndex = headers.indexOf("client_email");
    if (nameIndex < 0 || emailIndex < 0) return toast.error("CSV must include client_name and client_email columns.");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const existingEmails = new Set(clients.map(({ client_email }) => client_email.toLowerCase()));
    const records = rows.slice(1).flatMap((row) => {
      const parsed = clientSchema.safeParse({
        client_name: row[nameIndex] ?? "", client_email: row[emailIndex] ?? "",
        phone: row[headers.indexOf("phone")] ?? "", client_address: row[headers.indexOf("client_address")] ?? "",
        notes: row[headers.indexOf("notes")] ?? "", tags: (row[headers.indexOf("tags")] ?? "").replace(/\|/g, ","),
      });
      if (!parsed.success || existingEmails.has(parsed.data.client_email.toLowerCase())) return [];
      existingEmails.add(parsed.data.client_email.toLowerCase());
      return [{ user_id: user.id, client_name: parsed.data.client_name, client_email: parsed.data.client_email.toLowerCase(), phone: parsed.data.phone || null, client_address: parsed.data.client_address || null, notes: parsed.data.notes || null, tags: parsed.data.tags.split(",").map((tag) => tag.trim()).filter(Boolean) }];
    });
    if (!records.length) return toast.info("No new valid clients found; duplicate emails were skipped.");
    const { error } = await supabase.from("clients").insert(records);
    if (error) return toast.error("Clients couldn’t be imported.");
    toast.success(`${records.length} clients imported; invalid or duplicate rows were skipped.`);
    void fetchClients();
  };

  if (loading) return <DashboardLayout><PageLoader label="Loading clients…" /></DashboardLayout>;
  if (loadError) return <DashboardLayout><ErrorState message={loadError} onRetry={() => void fetchClients()} /></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div><h1 className="text-3xl font-bold">Clients</h1><p className="mt-1 text-muted-foreground">Search clients, review balances, and start their next invoice.</p></div>
          <div className="flex flex-wrap gap-2">
            <input ref={importRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importClients(file); event.target.value = ""; }} />
            <Button variant="outline" onClick={() => importRef.current?.click()}><FileUp className="mr-2 h-4 w-4" />Import</Button>
            <Button variant="outline" onClick={downloadClients}><Download className="mr-2 h-4 w-4" />Export</Button>
            <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) resetForm(); }}>
              <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add client</Button></DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editingClient ? "Edit client" : "Add client"}</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <FormField label="Client name" name="client_name" value={formData.client_name} error={fieldErrors.client_name} onChange={(value) => setFormData({ ...formData, client_name: value })} />
                  <FormField label="Email" name="client_email" type="email" value={formData.client_email} error={fieldErrors.client_email} onChange={(value) => { setFormData({ ...formData, client_email: value }); setDuplicateAcknowledged(false); }} />
                  {duplicateClient && <Alert><AlertTitle>Possible duplicate</AlertTitle><AlertDescription>{duplicateClient.client_name} already uses this email. {duplicateAcknowledged ? "Submit again to save anyway." : "Review before saving."}</AlertDescription></Alert>}
                  <FormField label="Phone" name="phone" value={formData.phone} error={fieldErrors.phone} onChange={(value) => setFormData({ ...formData, phone: value })} />
                  <div><Label htmlFor="client_address">Address</Label><Textarea id="client_address" value={formData.client_address} onChange={(event) => setFormData({ ...formData, client_address: event.target.value })} /></div>
                  <div><Label htmlFor="notes">Internal notes</Label><Textarea id="notes" value={formData.notes} onChange={(event) => setFormData({ ...formData, notes: event.target.value })} /></div>
                  <FormField label="Tags (comma separated)" name="tags" value={formData.tags} error={fieldErrors.tags} onChange={(value) => setFormData({ ...formData, tags: value })} />
                  <Button disabled={saving} className="w-full">{saving ? "Saving…" : duplicateClient && duplicateAcknowledged ? "Save duplicate anyway" : "Save client"}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-4">
          <div className="relative lg:col-span-2"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search clients" className="pl-10" placeholder="Search name, email, phone, notes, or tags…" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
          <Select value={tagFilter} onValueChange={setTagFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All tags</SelectItem>{allTags.map((tag) => <SelectItem key={tag} value={tag}>{tag}</SelectItem>)}</SelectContent></Select>
          <div className="flex gap-2"><Select value={balanceFilter} onValueChange={setBalanceFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All balances</SelectItem><SelectItem value="outstanding">Outstanding</SelectItem><SelectItem value="clear">No balance</SelectItem></SelectContent></Select><Select value={sort} onValueChange={setSort}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="name">Name</SelectItem><SelectItem value="outstanding">Balance</SelectItem><SelectItem value="recent">Recent</SelectItem></SelectContent></Select></div>
        </div>

        {filteredClients.length === 0 ? <Card><CardContent className="py-14 text-center"><Users className="mx-auto mb-3 h-12 w-12 text-muted-foreground" /><p>No matching clients.</p></CardContent></Card> : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filteredClients.map((client) => {
            const metrics = clientMetrics(client);
            const currency = metrics.history[0]?.currency ?? "USD";
            return <Card key={client.id}>
              <CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>{client.client_name}</CardTitle><p className="text-sm text-muted-foreground">{client.client_email}</p></div><div className="flex"><Button size="icon" variant="ghost" aria-label={`Edit ${client.client_name}`} onClick={() => handleEdit(client)}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label={`Delete ${client.client_name}`} onClick={() => setDeleteTarget(client)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></div></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-1">{client.tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}</div>
                <div className="grid grid-cols-2 gap-3 text-sm"><div><p className="text-muted-foreground">Outstanding</p><p className="font-semibold">{formatCurrency(metrics.outstanding, currency)}</p></div><div><p className="text-muted-foreground">Invoices</p><p className="font-semibold">{metrics.history.length}</p></div><div><p className="text-muted-foreground">Last invoice</p><p>{metrics.lastInvoiceDate ?? "—"}</p></div><div><p className="text-muted-foreground">Last payment</p><p>{metrics.lastPaymentDate ?? "—"}</p></div></div>
                {client.notes && <p className="line-clamp-2 text-sm text-muted-foreground">{client.notes}</p>}
                <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => navigate(`/dashboard/create?client=${client.id}`)}><ReceiptText className="mr-2 h-4 w-4" />Create invoice</Button><Button size="sm" variant="outline" onClick={() => navigate(`/dashboard/projects?client=${client.id}`)}>New project</Button><Button size="sm" variant="outline" onClick={() => setDetailClient(client)}><History className="mr-2 h-4 w-4" />History</Button></div>
              </CardContent>
            </Card>;
          })}</div>
        )}

        <Dialog open={Boolean(detailClient)} onOpenChange={(value) => !value && setDetailClient(null)}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{detailClient?.client_name} invoice history</DialogTitle></DialogHeader><div className="max-h-[60vh] space-y-2 overflow-y-auto">{detailClient && clientMetrics(detailClient).history.length ? clientMetrics(detailClient).history.map((invoice) => <button key={invoice.id} className="flex w-full items-center justify-between rounded border p-3 text-left hover:bg-muted" onClick={() => navigate(`/dashboard/invoices/${invoice.id}`)}><span><span className="font-medium">{invoice.invoice_number}</span><span className="block text-sm text-muted-foreground">Issued {invoice.issue_date} · Due {invoice.due_date}</span></span><span>{formatCurrency(Math.max(invoice.total - (allocationsByInvoice[invoice.id] ?? 0), 0), invoice.currency)} due</span></button>) : <p className="py-8 text-center text-muted-foreground">No invoices yet.</p>}</div></DialogContent></Dialog>

        <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(value) => !value && !deleting && setDeleteTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete {deleteTarget?.client_name}?</AlertDialogTitle><AlertDialogDescription>Existing invoice snapshots remain, but clients with projects cannot be deleted.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep client</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={(event) => { event.preventDefault(); void handleDelete(); }}>{deleting ? "Deleting…" : "Delete client"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      </div>
    </DashboardLayout>
  );
};

const FormField = ({ label, name, value, onChange, error, type = "text" }: { label: string; name: string; value: string; onChange: (value: string) => void; error?: string; type?: string }) => <div><Label htmlFor={name}>{label}</Label><Input id={name} type={type} value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} />{error && <p className="text-sm text-destructive">{error}</p>}</div>;

export default ClientsManagement;
