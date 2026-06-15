import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import InvoiceForm from "@/components/invoice/InvoiceForm";
import InvoicePreview from "@/components/invoice/InvoicePreview";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { InvoiceFormData } from "./CreateInvoice";

const EditInvoice = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<InvoiceFormData>({
    invoiceNumber: `INV-${Date.now()}`,
    clientName: "",
    clientEmail: "",
    clientAddress: "",
    issueDate: new Date(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    items: [{ description: "", quantity: 1, rate: 0, amount: 0 }],
    taxRate: 0,
    notes: "",
    templateId: "modern",
    currency: "USD",
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) {
      fetchInvoice();
    }
  }, [id]);

  const fetchInvoice = async () => {
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      setFormData({
        invoiceNumber: data.invoice_number,
        clientName: data.client_name,
        clientEmail: data.client_email,
        clientAddress: data.client_address || "",
        issueDate: new Date(data.issue_date),
        dueDate: new Date(data.due_date),
        items: data.items as any,
        taxRate: data.tax_rate,
        notes: data.notes || "",
        templateId: data.template_id,
        currency: data.currency || "USD",
      });
    } catch (error: any) {
      toast.error("Error loading invoice");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = () => {
    const subtotal = formData.items.reduce((sum, item) => sum + item.amount, 0);
    const taxAmount = (subtotal * formData.taxRate) / 100;
    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  };

  const handleUpdate = async () => {
    try {
      setSaving(true);
      const { subtotal, taxAmount, total } = calculateTotals();

      const { error } = await supabase
        .from("invoices")
        .update({
          invoice_number: formData.invoiceNumber,
          client_name: formData.clientName,
          client_email: formData.clientEmail,
          client_address: formData.clientAddress,
          issue_date: formData.issueDate.toISOString().split("T")[0],
          due_date: formData.dueDate.toISOString().split("T")[0],
          items: formData.items,
          subtotal,
          tax_rate: formData.taxRate,
          tax_amount: taxAmount,
          total,
          notes: formData.notes,
          template_id: formData.templateId,
          currency: formData.currency,
        })
        .eq("id", id);

      if (error) throw error;

      toast.success("Invoice updated successfully!");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error("Error updating invoice");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading invoice...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Edit Invoice</h1>
            <p className="text-muted-foreground mt-1">Update invoice details</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/dashboard")}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving ? "Updating..." : "Update Invoice"}
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <InvoiceForm formData={formData} setFormData={setFormData} />
          </Card>

          <div className="lg:sticky lg:top-6">
            <InvoicePreview formData={formData} totals={calculateTotals()} />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default EditInvoice;