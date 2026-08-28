import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ErrorState, PageLoader } from "@/components/shared/AsyncState";

const clientSchema = z.object({
  client_name: z.string().trim().min(1, "Client name is required").max(200),
  client_email: z.string().trim().min(1, "Client email is required").email("Enter a valid email"),
  client_address: z.string().trim().max(2_000),
  phone: z.string().trim().max(50),
});

interface Client {
  id: string;
  client_name: string;
  client_email: string;
  client_address: string | null;
  phone: string | null;
}

const ClientsManagement = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof typeof formData, string>>>({});
  const [formData, setFormData] = useState({
    client_name: "",
    client_email: "",
    client_address: "",
    phone: "",
  });

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("client_name");
    if (error) setLoadError("Your clients couldn’t be loaded. Check your connection and try again.");
    else {
      setClients(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void fetchClients(); }, [fetchClients]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = clientSchema.safeParse(formData);
    if (!validation.success) {
      const nextErrors: Partial<Record<keyof typeof formData, string>> = {};
      validation.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof typeof formData;
        if (!nextErrors[field]) nextErrors[field] = issue.message;
      });
      setFieldErrors(nextErrors);
      return;
    }
    setFieldErrors({});
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in");
        return;
      }

      if (editingClient) {
        const { error } = await supabase
          .from("clients")
          .update(validation.data)
          .eq("id", editingClient.id);
        if (error) throw error;
        toast.success("Client updated successfully");
      } else {
        const { error } = await supabase
          .from("clients")
          .insert({
            user_id: user.id,
            client_name: validation.data.client_name ?? "",
            client_email: validation.data.client_email ?? "",
            client_address: validation.data.client_address ?? "",
            phone: validation.data.phone ?? "",
          });
        if (error) throw error;
        toast.success("Client added successfully");
      }

      setOpen(false);
      resetForm();
      void fetchClients();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", deleteTarget.id);

    setDeleting(false);
    if (error) {
      toast.error("Client couldn’t be deleted. Please retry.");
      return;
    }
      setClients((current) => current.filter(({ id }) => id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success("Client deleted successfully");
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      client_name: client.client_name,
      client_email: client.client_email,
      client_address: client.client_address || "",
      phone: client.phone || "",
    });
    setOpen(true);
  };

  const resetForm = () => {
    setFormData({
      client_name: "",
      client_email: "",
      client_address: "",
      phone: "",
    });
    setEditingClient(null);
    setFieldErrors({});
  };

  if (loading) {
    return <DashboardLayout><PageLoader label="Loading clients…" /></DashboardLayout>;
  }

  if (loadError) return <DashboardLayout><ErrorState message={loadError} onRetry={() => void fetchClients()} /></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Clients</h1>
            <p className="text-muted-foreground mt-1">Manage your client information</p>
          </div>
          <Dialog open={open} onOpenChange={(isOpen) => {
            setOpen(isOpen);
            if (!isOpen) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button size="lg">
                <Plus className="h-5 w-5 mr-2" />
                Add Client
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingClient ? "Edit Client" : "Add New Client"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="client_name">Client Name</Label>
                  <Input
                    id="client_name"
                    value={formData.client_name}
                    onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                    required
                    aria-invalid={Boolean(fieldErrors.client_name)}
                  />
                  {fieldErrors.client_name && <p className="text-sm text-destructive">{fieldErrors.client_name}</p>}
                </div>
                <div>
                  <Label htmlFor="client_email">Email</Label>
                  <Input
                    id="client_email"
                    type="email"
                    value={formData.client_email}
                    onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
                    required
                    aria-invalid={Boolean(fieldErrors.client_email)}
                  />
                  {fieldErrors.client_email && <p className="text-sm text-destructive">{fieldErrors.client_email}</p>}
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="client_address">Address</Label>
                  <Textarea
                    id="client_address"
                    value={formData.client_address}
                    onChange={(e) => setFormData({ ...formData, client_address: e.target.value })}
                    rows={3}
                  />
                </div>
                <Button type="submit" className="w-full">
                  {editingClient ? "Update Client" : "Add Client"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {clients.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No clients yet</p>
              <p className="text-sm text-muted-foreground">
                Add your first client to get started
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {clients.map((client) => (
              <Card key={client.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{client.client_name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{client.client_email}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(client)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(client)}
                        aria-label={`Delete ${client.client_name}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {client.phone && (
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">Phone:</span> {client.phone}
                    </p>
                  )}
                  {client.client_address && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {client.client_address}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(isOpen) => !isOpen && !deleting && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Delete {deleteTarget?.client_name}?</AlertDialogTitle><AlertDialogDescription>This removes the saved client. Existing invoices keep their client snapshot.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel disabled={deleting}>Keep client</AlertDialogCancel><AlertDialogAction disabled={deleting} onClick={(event) => { event.preventDefault(); void handleDelete(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{deleting ? "Deleting…" : "Delete client"}</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default ClientsManagement;
