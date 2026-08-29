import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Clock3, FilePlus2, Pause, Pencil, Play, Plus, ReceiptText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { PageLoader } from "@/components/shared/AsyncState";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/currencies";

type Project = Tables<"projects">;
type Milestone = Tables<"project_milestones">;
type Task = Tables<"project_tasks">;
type TimeEntry = Tables<"time_entries">;
type Invoice = Pick<Tables<"invoices">, "id" | "invoice_number" | "document_type" | "total" | "currency" | "status" | "proforma_status">;
type Payment = Pick<Tables<"payments">, "id" | "amount" | "payment_date" | "payer">;
type Allocation = Pick<Tables<"payment_allocations">, "invoice_id" | "amount">;
type Expense = Pick<Tables<"expenses">, "id" | "amount" | "tax_amount" | "expense_date" | "vendor">;
type Attachment = Tables<"attachments">;
type Event = Tables<"project_events">;

const ProjectDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [clientName, setClientName] = useState("");
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<"milestone" | "task" | "time" | null>(null);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [deleteMilestoneTarget, setDeleteMilestoneTarget] = useState<Milestone | null>(null);
  const [deletingMilestone, setDeletingMilestone] = useState(false);
  const [selectedTime, setSelectedTime] = useState<Set<string>>(() => new Set());
  const [timerStartedAt, setTimerStartedAt] = useState<Date | null>(null);
  const [timerMember, setTimerMember] = useState("Me");
  const [milestoneForm, setMilestoneForm] = useState({ name: "", due_date: "", value: 0, billing_trigger: false });
  const [taskForm, setTaskForm] = useState({ title: "", description: "", due_date: "", is_deliverable: false });
  const [timeForm, setTimeForm] = useState({ entry_date: new Date().toISOString().slice(0, 10), duration_hours: 1, member_name: "Me", billable: true, hourly_rate: 0, notes: "" });

  const fetchProject = useCallback(async () => {
    if (!id) return;
    const projectResult = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
    if (!projectResult.data) { navigate("/unauthorized", { replace: true }); return; }
    const current = projectResult.data;
    const [client, milestone, task, time, invoice, payment, allocation, expense, attachment, event] = await Promise.all([
      supabase.from("clients").select("client_name").eq("id", current.client_id).maybeSingle(),
      supabase.from("project_milestones").select("*").eq("project_id", id).order("due_date"),
      supabase.from("project_tasks").select("*").eq("project_id", id).order("created_at"),
      supabase.from("time_entries").select("*").eq("project_id", id).order("entry_date", { ascending: false }),
      supabase.from("invoices").select("id, invoice_number, document_type, total, currency, status, proforma_status").eq("project_id", id),
      supabase.from("payments").select("id, amount, payment_date, payer").eq("project_id", id),
      supabase.from("payment_allocations").select("invoice_id, amount"),
      supabase.from("expenses").select("id, amount, tax_amount, expense_date, vendor").eq("project_id", id),
      supabase.from("attachments").select("*").eq("project_id", id).order("created_at", { ascending: false }),
      supabase.from("project_events").select("*").eq("project_id", id).order("created_at", { ascending: false }).limit(50),
    ]);
    setProject(current); setClientName(client.data?.client_name ?? "Unknown client");
    setMilestones(milestone.data ?? []); setTasks(task.data ?? []); setTimeEntries(time.data ?? []);
    setInvoices(invoice.data ?? []); setPayments(payment.data ?? []); setAllocations(allocation.data ?? []);
    setExpenses(expense.data ?? []); setAttachments(attachment.data ?? []); setEvents(event.data ?? []);
    setTimeForm((form) => ({ ...form, hourly_rate: current.billing_rate }));
    setLoading(false);
  }, [id, navigate]);

  useEffect(() => { void fetchProject(); }, [fetchProject]);

  const financials = useMemo(() => {
    const finalInvoices = invoices.filter(({ document_type }) => document_type === "invoice");
    const invoiceIds = new Set(finalInvoices.map(({ id }) => id));
    const invoiced = finalInvoices.reduce((sum, invoice) => sum + invoice.total, 0);
    const received = allocations.filter(({ invoice_id }) => invoiceIds.has(invoice_id)).reduce((sum, allocation) => sum + allocation.amount, 0);
    const spent = expenses.reduce((sum, expense) => sum + expense.amount + expense.tax_amount, 0);
    return { invoiced, received, outstanding: Math.max(invoiced - received, 0), spent, margin: received - spent };
  }, [allocations, expenses, invoices]);

  const userId = async () => (await supabase.auth.getUser()).data.user?.id;
  const addMilestone = async (event: React.FormEvent) => {
    event.preventDefault(); const user = await userId(); if (!user || !id || !milestoneForm.name.trim()) return;
    const payload = { name: milestoneForm.name.trim(), due_date: milestoneForm.due_date || null, value: milestoneForm.value, billing_trigger: milestoneForm.billing_trigger };
    const { error } = editingMilestone
      ? await supabase.from("project_milestones").update(payload).eq("id", editingMilestone.id)
      : await supabase.from("project_milestones").insert({ user_id: user, project_id: id, ...payload });
    if (error) return toast.error(`Milestone couldn’t be ${editingMilestone ? "updated" : "added"}.`);
    toast.success(editingMilestone ? "Milestone updated." : "Milestone added.");
    setDialog(null); setEditingMilestone(null); setMilestoneForm({ name: "", due_date: "", value: 0, billing_trigger: false }); void fetchProject();
  };
  const editMilestone = (milestone: Milestone) => {
    setEditingMilestone(milestone);
    setMilestoneForm({ name: milestone.name, due_date: milestone.due_date ?? "", value: milestone.value, billing_trigger: milestone.billing_trigger });
    setDialog("milestone");
  };
  const deleteMilestone = async () => {
    if (!deleteMilestoneTarget) return;
    setDeletingMilestone(true);
    const { error } = await supabase.from("project_milestones").delete().eq("id", deleteMilestoneTarget.id);
    setDeletingMilestone(false);
    if (error) return toast.error("Milestone couldn’t be deleted.");
    setMilestones((current) => current.filter(({ id: milestoneId }) => milestoneId !== deleteMilestoneTarget.id));
    setDeleteMilestoneTarget(null);
    toast.success("Milestone deleted.");
  };
  const addTask = async (event: React.FormEvent) => {
    event.preventDefault(); const user = await userId(); if (!user || !id || !taskForm.title.trim()) return;
    const { error } = await supabase.from("project_tasks").insert({ user_id: user, project_id: id, title: taskForm.title.trim(), description: taskForm.description || null, due_date: taskForm.due_date || null, is_deliverable: taskForm.is_deliverable });
    if (error) return toast.error("Task couldn’t be added."); setDialog(null); setTaskForm({ title: "", description: "", due_date: "", is_deliverable: false }); void fetchProject();
  };
  const addTime = async (event: React.FormEvent) => {
    event.preventDefault(); const user = await userId(); if (!user || !id) return;
    const { error } = await supabase.from("time_entries").insert({ user_id: user, project_id: id, entry_date: timeForm.entry_date, duration_minutes: Math.max(1, Math.round(timeForm.duration_hours * 60)), member_name: timeForm.member_name, billable: timeForm.billable, hourly_rate: timeForm.hourly_rate, notes: timeForm.notes || null });
    if (error) return toast.error("Time entry couldn’t be added."); setDialog(null); void fetchProject();
  };
  const stopTimer = async () => {
    if (!timerStartedAt || !id) return; const user = await userId(); if (!user) return;
    const minutes = Math.max(1, Math.round((Date.now() - timerStartedAt.getTime()) / 60_000));
    const { error } = await supabase.from("time_entries").insert({ user_id: user, project_id: id, entry_date: new Date().toISOString().slice(0, 10), duration_minutes: minutes, member_name: timerMember || "Me", billable: true, hourly_rate: project?.billing_rate ?? 0, notes: "Timer entry", timer_started_at: timerStartedAt.toISOString() });
    if (error) return toast.error("Timer entry couldn’t be saved."); setTimerStartedAt(null); toast.success(`${minutes} minute timer entry saved.`); void fetchProject();
  };
  const updateStatus = async (table: "project_milestones" | "project_tasks", recordId: string, status: string) => {
    const { error } = await supabase.from(table).update({ status }).eq("id", recordId); if (error) toast.error("Status couldn’t be updated."); else void fetchProject();
  };
  const uploadAttachment = async (file: File) => {
    if (!id || file.size > 10 * 1024 * 1024) return toast.error("Files must be 10 MB or smaller."); const user = await userId(); if (!user) return;
    const path = `${user}/projects/${id}/${crypto.randomUUID()}-${file.name.replace(/[^A-Za-z0-9._-]/g, "-")}`;
    const upload = await supabase.storage.from("company-assets").upload(path, file, { contentType: file.type, upsert: false });
    if (upload.error) return toast.error("File couldn’t be uploaded. Check the bucket file-type policy.");
    const result = await supabase.from("attachments").insert({ user_id: user, project_id: id, record_type: "project", record_id: id, file_name: file.name, storage_path: path, mime_type: file.type, file_size: file.size });
    if (result.error) return toast.error("File metadata couldn’t be saved."); toast.success("File attached."); void fetchProject();
  };
  const openAttachment = async (attachment: Attachment) => { const { data, error } = await supabase.storage.from("company-assets").createSignedUrl(attachment.storage_path, 300); if (error) toast.error("File couldn’t be opened."); else window.open(data.signedUrl, "_blank", "noopener,noreferrer"); };

  if (loading || !project) return <DashboardLayout><PageLoader label="Loading project…" /></DashboardLayout>;
  const unbilledSelected = [...selectedTime].filter((entryId) => timeEntries.some((entry) => entry.id === entryId && entry.billable && !entry.invoice_id));

  return <DashboardLayout><div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center"><div><Button variant="ghost" className="-ml-3" onClick={() => navigate("/dashboard/projects")}><ArrowLeft className="mr-2 h-4 w-4" />Projects</Button><div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-bold">{project.name}</h1><Badge>{pretty(project.billing_model)}</Badge><Select value={project.status} onValueChange={async (status) => { await supabase.from("projects").update({ status }).eq("id", project.id); void fetchProject(); }}><SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger><SelectContent>{["planned","active","on_hold","completed","cancelled"].map((status) => <SelectItem key={status} value={status}>{pretty(status)}</SelectItem>)}</SelectContent></Select></div><p className="text-muted-foreground">{clientName} · {project.start_date}{project.end_date ? ` to ${project.end_date}` : ""}</p></div><div className="flex flex-wrap gap-2"><Button onClick={() => navigate(`/dashboard/create?project=${project.id}`)}><ReceiptText className="mr-2 h-4 w-4" />Create invoice</Button><Button variant="outline" onClick={() => navigate(`/dashboard/create?project=${project.id}&type=proforma`)}>Create proforma</Button></div></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6"><Metric label="Contract / retainer" value={formatCurrency(project.budget, project.currency)} /><Metric label="Invoiced" value={formatCurrency(financials.invoiced, project.currency)} /><Metric label="Received" value={formatCurrency(financials.received, project.currency)} /><Metric label="Outstanding" value={formatCurrency(financials.outstanding, project.currency)} /><Metric label="Expenses" value={formatCurrency(financials.spent, project.currency)} /><Metric label="Estimated margin" value={formatCurrency(financials.margin, project.currency)} /></div>
    <Tabs defaultValue="overview"><TabsList className="flex h-auto flex-wrap justify-start"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="milestones">Milestones</TabsTrigger><TabsTrigger value="tasks">Tasks</TabsTrigger><TabsTrigger value="time">Time</TabsTrigger><TabsTrigger value="billing">Billing</TabsTrigger><TabsTrigger value="files">Files & activity</TabsTrigger></TabsList>
      <TabsContent value="overview" className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle>Project brief</CardTitle></CardHeader><CardContent className="space-y-3"><p>{project.description || "No description."}</p><div><p className="text-sm font-medium">Internal notes</p><p className="whitespace-pre-line text-sm text-muted-foreground">{project.internal_notes || "None"}</p></div><div className="rounded border p-3 text-sm"><p className="font-medium">Original billing snapshot</p><pre className="mt-1 overflow-x-auto text-xs text-muted-foreground">{JSON.stringify(project.billing_snapshot, null, 2)}</pre></div></CardContent></Card><Card><CardHeader><CardTitle>Upcoming milestones</CardTitle></CardHeader><CardContent className="space-y-2">{milestones.filter(({ status }) => status !== "completed" && status !== "cancelled").slice(0, 5).map((milestone) => <div key={milestone.id} className="flex justify-between border-b py-2"><span>{milestone.name}</span><span className="text-sm text-muted-foreground">{milestone.due_date ?? "No due date"}</span></div>)}{milestones.length === 0 && <p className="text-muted-foreground">No milestones.</p>}</CardContent></Card></TabsContent>
      <TabsContent value="milestones"><Section title="Milestones" action={<Button size="sm" onClick={() => { setEditingMilestone(null); setMilestoneForm({ name: "", due_date: "", value: 0, billing_trigger: false }); setDialog("milestone"); }}><Plus className="mr-2 h-4 w-4" />Add milestone</Button>}>{milestones.map((milestone) => <Row key={milestone.id} title={milestone.name} detail={`${milestone.due_date ?? "No due date"} · ${formatCurrency(milestone.value, project.currency)}${milestone.billing_trigger ? " · Billing trigger" : ""}`}><div className="flex flex-wrap items-center justify-end gap-2"><Select value={milestone.status} onValueChange={(status) => void updateStatus("project_milestones", milestone.id, status)}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent>{["planned","in_progress","completed","cancelled"].map((status) => <SelectItem key={status} value={status}>{pretty(status)}</SelectItem>)}</SelectContent></Select><Button size="sm" variant="outline" onClick={() => editMilestone(milestone)}><Pencil className="mr-2 h-4 w-4" />Edit</Button><Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteMilestoneTarget(milestone)}><Trash2 className="mr-2 h-4 w-4" />Delete</Button></div></Row>)}</Section></TabsContent>
      <TabsContent value="tasks"><Section title="Tasks and deliverables" action={<Button size="sm" onClick={() => setDialog("task")}><Plus className="mr-2 h-4 w-4" />Add task</Button>}>{tasks.map((task) => <Row key={task.id} title={`${task.is_deliverable ? "Deliverable: " : ""}${task.title}`} detail={task.due_date ?? task.description ?? "No due date"}><Select value={task.status} onValueChange={(status) => void updateStatus("project_tasks", task.id, status)}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent>{["todo","in_progress","done","cancelled"].map((status) => <SelectItem key={status} value={status}>{pretty(status)}</SelectItem>)}</SelectContent></Select></Row>)}</Section></TabsContent>
      <TabsContent value="time" className="space-y-4"><Card><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end"><Field label="Timer member" value={timerMember} onChange={setTimerMember} />{timerStartedAt ? <Button variant="destructive" onClick={() => void stopTimer()}><Pause className="mr-2 h-4 w-4" />Stop timer</Button> : <Button onClick={() => setTimerStartedAt(new Date())}><Play className="mr-2 h-4 w-4" />Start timer</Button>}<Button variant="outline" onClick={() => setDialog("time")}><Clock3 className="mr-2 h-4 w-4" />Manual entry</Button><Button disabled={!unbilledSelected.length} onClick={() => navigate(`/dashboard/create?project=${project.id}&timeEntries=${unbilledSelected.join(",")}`)}>Invoice selected ({unbilledSelected.length})</Button></CardContent></Card><Section title="Time entries">{timeEntries.map((entry) => <Row key={entry.id} title={`${entry.member_name} · ${(entry.duration_minutes / 60).toFixed(2)}h`} detail={`${entry.entry_date} · ${formatCurrency(entry.hourly_rate, project.currency)}/h · ${entry.notes ?? "No notes"}`}><div className="flex items-center gap-2">{entry.invoice_id ? <Badge variant="secondary">Billed</Badge> : entry.billable ? <Checkbox checked={selectedTime.has(entry.id)} onCheckedChange={(checked) => setSelectedTime((current) => { const next = new Set(current); if (checked === true) next.add(entry.id); else next.delete(entry.id); return next; })} /> : <Badge variant="outline">Non-billable</Badge>}</div></Row>)}</Section></TabsContent>
      <TabsContent value="billing" className="grid gap-4 lg:grid-cols-3"><Section title="Billing documents">{invoices.map((invoice) => <button key={invoice.id} className="flex w-full justify-between border-b py-3 text-left" onClick={() => navigate(`/dashboard/invoices/${invoice.id}`)}><span>{invoice.invoice_number}<span className="block text-xs text-muted-foreground">{invoice.document_type === "proforma" ? pretty(invoice.proforma_status ?? "draft") : pretty(invoice.status)}</span></span><span>{formatCurrency(invoice.total, invoice.currency)}</span></button>)}</Section><Section title="Incoming payments">{payments.map((payment) => <Row key={payment.id} title={payment.payer} detail={payment.payment_date}>{formatCurrency(payment.amount, project.currency)}</Row>)}</Section><Section title="Expenses">{expenses.map((expense) => <Row key={expense.id} title={expense.vendor} detail={expense.expense_date}>{formatCurrency(expense.amount + expense.tax_amount, project.currency)}</Row>)}</Section></TabsContent>
      <TabsContent value="files" className="grid gap-4 lg:grid-cols-2"><Section title="Files" action={<><input ref={fileRef} className="hidden" type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadAttachment(file); event.target.value = ""; }} /><Button size="sm" onClick={() => fileRef.current?.click()}><FilePlus2 className="mr-2 h-4 w-4" />Attach</Button></>}>{attachments.map((attachment) => <button key={attachment.id} className="flex w-full justify-between border-b py-3 text-left" onClick={() => void openAttachment(attachment)}><span>{attachment.file_name}</span><span className="text-xs text-muted-foreground">{attachment.file_size ? `${Math.round(attachment.file_size / 1024)} KB` : ""}</span></button>)}</Section><Section title="Activity">{events.map((event) => <Row key={event.id} title={event.title} detail={new Date(event.created_at).toLocaleString()} />)}</Section></TabsContent>
    </Tabs>
    <Dialog open={Boolean(dialog)} onOpenChange={(open) => { if (!open) { setDialog(null); setEditingMilestone(null); } }}><DialogContent><DialogHeader><DialogTitle>{dialog === "milestone" && editingMilestone ? "Edit milestone" : `Add ${dialog}`}</DialogTitle></DialogHeader>{dialog === "milestone" ? <form className="space-y-4" onSubmit={addMilestone}><Field label="Name" value={milestoneForm.name} onChange={(name) => setMilestoneForm({ ...milestoneForm, name })} /><Field label="Due date" type="date" value={milestoneForm.due_date} onChange={(due_date) => setMilestoneForm({ ...milestoneForm, due_date })} /><Field label="Value" type="number" value={String(milestoneForm.value)} onChange={(value) => setMilestoneForm({ ...milestoneForm, value: Number(value) })} /><Check label="Use as billing trigger" checked={milestoneForm.billing_trigger} onChange={(billing_trigger) => setMilestoneForm({ ...milestoneForm, billing_trigger })} /><Button className="w-full">{editingMilestone ? "Save milestone" : "Add milestone"}</Button></form> : dialog === "task" ? <form className="space-y-4" onSubmit={addTask}><Field label="Title" value={taskForm.title} onChange={(title) => setTaskForm({ ...taskForm, title })} /><FieldArea label="Description" value={taskForm.description} onChange={(description) => setTaskForm({ ...taskForm, description })} /><Field label="Due date" type="date" value={taskForm.due_date} onChange={(due_date) => setTaskForm({ ...taskForm, due_date })} /><Check label="This is a deliverable" checked={taskForm.is_deliverable} onChange={(is_deliverable) => setTaskForm({ ...taskForm, is_deliverable })} /><Button className="w-full">Add task</Button></form> : <form className="space-y-4" onSubmit={addTime}><div className="grid grid-cols-2 gap-3"><Field label="Date" type="date" value={timeForm.entry_date} onChange={(entry_date) => setTimeForm({ ...timeForm, entry_date })} /><Field label="Hours" type="number" value={String(timeForm.duration_hours)} onChange={(value) => setTimeForm({ ...timeForm, duration_hours: Number(value) })} /></div><Field label="Member" value={timeForm.member_name} onChange={(member_name) => setTimeForm({ ...timeForm, member_name })} /><Field label="Hourly rate" type="number" value={String(timeForm.hourly_rate)} onChange={(value) => setTimeForm({ ...timeForm, hourly_rate: Number(value) })} /><FieldArea label="Notes" value={timeForm.notes} onChange={(notes) => setTimeForm({ ...timeForm, notes })} /><Check label="Billable" checked={timeForm.billable} onChange={(billable) => setTimeForm({ ...timeForm, billable })} /><Button className="w-full">Add time</Button></form>}</DialogContent></Dialog>
    <AlertDialog open={Boolean(deleteMilestoneTarget)} onOpenChange={(open) => !open && !deletingMilestone && setDeleteMilestoneTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete milestone {deleteMilestoneTarget?.name}?</AlertDialogTitle><AlertDialogDescription>This permanently removes the milestone from the project. Existing invoices are not affected.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deletingMilestone}>Cancel</AlertDialogCancel><AlertDialogAction disabled={deletingMilestone} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={(event) => { event.preventDefault(); void deleteMilestone(); }}>{deletingMilestone ? "Deleting…" : "Delete milestone"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div></DashboardLayout>;
};

const pretty = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
const Metric = ({ label, value }: { label: string; value: string }) => <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></CardContent></Card>;
const Section = ({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) => <Card><CardHeader><div className="flex items-center justify-between"><CardTitle>{title}</CardTitle>{action}</div></CardHeader><CardContent>{children}</CardContent></Card>;
const Row = ({ title, detail, children }: { title: string; detail: string; children?: React.ReactNode }) => <div className="flex items-center justify-between gap-3 border-b py-3 last:border-0"><div><p className="font-medium">{title}</p><p className="text-sm text-muted-foreground">{detail}</p></div>{children}</div>;
const Field = ({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) => <div className="space-y-2"><Label>{label}</Label><Input type={type} min={type === "number" ? 0 : undefined} step={type === "number" ? "0.01" : undefined} value={value} onChange={(event) => onChange(event.target.value)} /></div>;
const FieldArea = ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => <div className="space-y-2"><Label>{label}</Label><Textarea value={value} onChange={(event) => onChange(event.target.value)} /></div>;
const Check = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) => <label className="flex items-center gap-2 text-sm"><Checkbox checked={checked} onCheckedChange={(value) => onChange(value === true)} />{label}</label>;

export default ProjectDetail;
