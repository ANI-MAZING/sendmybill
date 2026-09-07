import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BriefcaseBusiness, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { ErrorState, PageLoader } from "@/components/shared/AsyncState";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { currencies, formatCurrency } from "@/lib/currencies";

type Project = Tables<"projects">;
type Client = Pick<Tables<"clients">, "id" | "client_name">;

const initialProject = {
  client_id: "", name: "", description: "", billing_model: "fixed", status: "planned",
  start_date: new Date().toISOString().slice(0, 10), end_date: "", currency: "USD",
  budget: 0, billing_rate: 0, internal_notes: "",
};

const ProjectsManagement = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState({ ...initialProject, client_id: searchParams.get("client") ?? "" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [projectResult, clientResult] = await Promise.all([
      supabase.from("projects").select("*").order("created_at", { ascending: false }),
      supabase.from("clients").select("id, client_name").order("client_name"),
    ]);
    if (projectResult.error || clientResult.error) setError("Projects couldn’t be loaded. Apply the Phase 1 migration and retry.");
    else { setProjects(projectResult.data ?? []); setClients(clientResult.data ?? []); }
    setLoading(false);
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);
  useEffect(() => { if (searchParams.get("client")) setOpen(true); }, [searchParams]);

  const clientNames = useMemo(() => Object.fromEntries(clients.map((client) => [client.id, client.client_name])), [clients]);
  const clientName = useCallback((clientId: string) => clientNames[clientId] ?? "Unknown client", [clientNames]);
  const filtered = useMemo(() => projects.filter((project) => {
    const query = search.trim().toLowerCase();
    return (!query || project.name.toLowerCase().includes(query) || clientName(project.client_id).toLowerCase().includes(query)) && (statusFilter === "all" || project.status === statusFilter);
  }), [clientName, projects, search, statusFilter]);

  const resetForm = (clientId = "") => {
    setEditingProject(null);
    setForm({ ...initialProject, client_id: clientId });
  };

  const openNewProject = () => {
    resetForm(searchParams.get("client") ?? "");
    setOpen(true);
  };

  const openEditProject = (project: Project) => {
    setEditingProject(project);
    setForm({
      client_id: project.client_id,
      name: project.name,
      description: project.description ?? "",
      billing_model: project.billing_model,
      status: project.status,
      start_date: project.start_date,
      end_date: project.end_date ?? "",
      currency: project.currency,
      budget: project.budget,
      billing_rate: project.billing_rate,
      internal_notes: project.internal_notes ?? "",
    });
    setOpen(true);
  };

  const saveProject = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.client_id || !form.name.trim()) return toast.error("Choose a client and enter a project name.");
    if (form.end_date && form.end_date < form.start_date) return toast.error("End date cannot be before start date.");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSaving(true);
    const payload = {
      client_id: form.client_id, name: form.name.trim(), description: form.description || null,
      billing_model: form.billing_model, status: form.status, start_date: form.start_date, end_date: form.end_date || null,
      currency: form.currency, budget: form.budget, billing_rate: form.billing_rate, internal_notes: form.internal_notes || null,
    };
    if (editingProject) {
      const { error: saveError } = await supabase.from("projects").update(payload).eq("id", editingProject.id);
      setSaving(false);
      if (saveError) return toast.error("Project couldn’t be updated.");
      toast.success("Project updated.");
      setOpen(false);
      resetForm();
      void fetchData();
      return;
    }
    const { data, error: saveError } = await supabase.from("projects").insert({ user_id: user.id, ...payload }).select("id").single();
    setSaving(false);
    if (saveError || !data) return toast.error("Project couldn’t be created.");
    toast.success("Project created.");
    setOpen(false);
    resetForm();
    navigate(`/dashboard/projects/${data.id}`);
  };

  const deleteProject = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from("projects").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    if (deleteError) return toast.error("Project couldn’t be deleted. Please retry.");
    setProjects((current) => current.filter(({ id }) => id !== deleteTarget.id));
    setDeleteTarget(null);
    toast.success("Project deleted.");
  };

  if (loading) return <DashboardLayout><PageLoader label="Loading projects…" /></DashboardLayout>;
  if (error) return <DashboardLayout><ErrorState message={error} onRetry={() => void fetchData()} /></DashboardLayout>;

  return <DashboardLayout><div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h1 className="text-3xl font-bold">Projects</h1><p className="mt-1 text-muted-foreground">Organize delivery, billing, time, and profitability by client.</p></div><Button onClick={openNewProject}><Plus className="mr-2 h-4 w-4" />New project</Button></div>
    <div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-10" placeholder="Search projects or clients…" value={search} onChange={(event) => setSearch(event.target.value)} /></div><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{["planned","active","on_hold","completed","cancelled"].map((status) => <SelectItem key={status} value={status}>{label(status)}</SelectItem>)}</SelectContent></Select></div>
    {filtered.length === 0 ? <Card><CardContent className="py-14 text-center"><BriefcaseBusiness className="mx-auto mb-3 h-12 w-12 text-muted-foreground" /><p>No matching projects.</p></CardContent></Card> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((project) => <Card key={project.id} className="cursor-pointer hover:bg-muted/30" onClick={() => navigate(`/dashboard/projects/${project.id}`)}><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>{project.name}</CardTitle><p className="text-sm text-muted-foreground">{clientName(project.client_id)}</p></div><Badge variant="outline">{label(project.status)}</Badge></div></CardHeader><CardContent className="space-y-3"><div className="flex justify-between text-sm"><span className="text-muted-foreground">Billing</span><span>{label(project.billing_model)}</span></div><div className="flex justify-between text-sm"><span className="text-muted-foreground">Budget</span><span className="font-semibold">{formatCurrency(project.budget, project.currency)}</span></div><p className="line-clamp-2 text-sm text-muted-foreground">{project.description || "No description"}</p><div className="flex gap-2 pt-2"><Button size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); openEditProject(project); }}><Pencil className="mr-2 h-4 w-4" />Edit</Button><Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={(event) => { event.stopPropagation(); setDeleteTarget(project); }}><Trash2 className="mr-2 h-4 w-4" />Delete</Button></div></CardContent></Card>)}</div>}
    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) resetForm(); }}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{editingProject ? "Edit project" : "Create project"}</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={saveProject}>
      <FieldLabel label="Client"><Select value={form.client_id} onValueChange={(value) => setForm({ ...form, client_id: value })}><SelectTrigger><SelectValue placeholder="Choose client" /></SelectTrigger><SelectContent>{clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.client_name}</SelectItem>)}</SelectContent></Select></FieldLabel>
      <Field label="Project name" value={form.name} onChange={(name) => setForm({ ...form, name })} />
      <FieldLabel label="Description"><Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></FieldLabel>
      <div className="grid gap-4 sm:grid-cols-2"><FieldLabel label="Billing model"><Select value={form.billing_model} onValueChange={(billing_model) => setForm({ ...form, billing_model })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["fixed","hourly","milestone","retainer"].map((model) => <SelectItem key={model} value={model}>{label(model)}</SelectItem>)}</SelectContent></Select></FieldLabel><FieldLabel label="Status"><Select value={form.status} onValueChange={(status) => setForm({ ...form, status })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["planned","active","on_hold","completed","cancelled"].map((status) => <SelectItem key={status} value={status}>{label(status)}</SelectItem>)}</SelectContent></Select></FieldLabel></div>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Start date" type="date" value={form.start_date} onChange={(start_date) => setForm({ ...form, start_date })} /><Field label="End date (optional)" type="date" value={form.end_date} onChange={(end_date) => setForm({ ...form, end_date })} /></div>
      <div className="grid gap-4 sm:grid-cols-3"><FieldLabel label="Currency"><Select value={form.currency} onValueChange={(currency) => setForm({ ...form, currency })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{currencies.map((currency) => <SelectItem key={currency.code} value={currency.code}>{currency.code}</SelectItem>)}</SelectContent></Select></FieldLabel><Field label="Budget / contract value" type="number" value={String(form.budget)} onChange={(value) => setForm({ ...form, budget: Number(value) })} /><Field label="Billing rate" type="number" value={String(form.billing_rate)} onChange={(value) => setForm({ ...form, billing_rate: Number(value) })} /></div>
      <FieldLabel label="Internal notes"><Textarea value={form.internal_notes} onChange={(event) => setForm({ ...form, internal_notes: event.target.value })} /></FieldLabel>
      <Button className="w-full" disabled={saving}>{saving ? "Saving…" : editingProject ? "Save changes" : "Create project"}</Button>
    </form></DialogContent></Dialog>
    <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(value) => !value && !deleting && setDeleteTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete project {deleteTarget?.name}?</AlertDialogTitle><AlertDialogDescription>This permanently deletes the project and its milestones, tasks, time entries, files, and activity. Linked invoices and financial records are retained.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel><AlertDialogAction disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={(event) => { event.preventDefault(); void deleteProject(); }}>{deleting ? "Deleting…" : "Delete project"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div></DashboardLayout>;
};

const label = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
const FieldLabel = ({ label: text, children }: { label: string; children: React.ReactNode }) => <div className="space-y-2"><Label>{text}</Label>{children}</div>;
const Field = ({ label: text, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) => <FieldLabel label={text}><Input type={type} min={type === "number" ? 0 : undefined} step={type === "number" ? "0.01" : undefined} value={value} onChange={(event) => onChange(event.target.value)} /></FieldLabel>;

export default ProjectsManagement;
