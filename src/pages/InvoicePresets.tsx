import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Preset = Tables<"invoice_presets">;
const initial = { name: "", description: "", quantity: 1, rate: 0, tax_rate: 0, notes: "", payment_terms: "" };

const InvoicePresets = () => {
  const navigate = useNavigate();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initial);
  const fetchPresets = useCallback(async () => { const { data } = await supabase.from("invoice_presets").select("*").order("name"); setPresets(data ?? []); }, []);
  useEffect(() => { void fetchPresets(); }, [fetchPresets]);
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (!form.name.trim() || !form.description.trim() || form.quantity <= 0 || form.rate < 0) return toast.error("Complete the preset service details.");
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
    const items = [{ description: form.description.trim(), quantity: form.quantity, rate: form.rate, amount: form.quantity * form.rate }];
    const { error } = await supabase.from("invoice_presets").insert({ user_id: user.id, name: form.name.trim(), items: items as unknown as Json, tax_rate: form.tax_rate, notes: form.notes || null, payment_terms: form.payment_terms || null });
    if (error) return toast.error("Preset couldn’t be saved."); setOpen(false); setForm(initial); toast.success("Invoice preset saved."); void fetchPresets();
  };
  const remove = async (id: string) => { const { error } = await supabase.from("invoice_presets").delete().eq("id", id); if (error) toast.error("Preset couldn’t be deleted."); else { toast.success("Preset deleted."); void fetchPresets(); } };
  return <DashboardLayout><div className="space-y-6"><div className="flex items-center justify-between"><div><Button variant="ghost" className="-ml-3" onClick={() => navigate("/dashboard/settings")}><ArrowLeft className="mr-2 h-4 w-4" />Settings</Button><h1 className="text-3xl font-bold">Invoice presets</h1><p className="text-muted-foreground">Reusable services, rates, tax, notes, and terms for faster billing.</p></div><Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />New preset</Button></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{presets.map((preset) => <Card key={preset.id}><CardHeader><div className="flex justify-between"><CardTitle>{preset.name}</CardTitle><Button variant="ghost" size="icon" onClick={() => void remove(preset.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></CardHeader><CardContent><pre className="overflow-x-auto whitespace-pre-wrap text-sm text-muted-foreground">{JSON.stringify(preset.items, null, 2)}</pre><p className="mt-3 text-sm">Tax: {preset.tax_rate}%</p></CardContent></Card>)}</div><Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Create service preset</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={save}><Field label="Preset name" value={form.name} onChange={(name) => setForm({ ...form, name })} /><Field label="Service description" value={form.description} onChange={(description) => setForm({ ...form, description })} /><div className="grid grid-cols-3 gap-3"><Field label="Quantity" type="number" value={String(form.quantity)} onChange={(value) => setForm({ ...form, quantity: Number(value) })} /><Field label="Rate" type="number" value={String(form.rate)} onChange={(value) => setForm({ ...form, rate: Number(value) })} /><Field label="Tax %" type="number" value={String(form.tax_rate)} onChange={(value) => setForm({ ...form, tax_rate: Number(value) })} /></div><Area label="Notes" value={form.notes} onChange={(notes) => setForm({ ...form, notes })} /><Area label="Payment terms" value={form.payment_terms} onChange={(payment_terms) => setForm({ ...form, payment_terms })} /><Button className="w-full">Save preset</Button></form></DialogContent></Dialog></div></DashboardLayout>;
};
const Field = ({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) => <div className="space-y-2"><Label>{label}</Label><Input type={type} min={type === "number" ? 0 : undefined} step={type === "number" ? "0.01" : undefined} value={value} onChange={(event) => onChange(event.target.value)} /></div>;
const Area = ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => <div className="space-y-2"><Label>{label}</Label><Textarea value={value} onChange={(event) => onChange(event.target.value)} /></div>;
export default InvoicePresets;
