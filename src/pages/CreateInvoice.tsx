import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import InvoiceForm from "@/components/invoice/InvoiceForm";
import InvoicePreview from "@/components/invoice/InvoicePreview";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export interface InvoiceFormData {
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  clientAddress: string;
  issueDate: Date;
  dueDate: Date;
  items: Array<{
    description: string;
    quantity: number;
    rate: number;
    amount: number;
  }>;
  taxRate: number;
  notes: string;
  templateId: string;
  currency: string;
}

const CreateInvoice = () => {
  const navigate = useNavigate();
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

  const calculateTotals = () => {
    const subtotal = formData.items.reduce((sum, item) => sum + item.amount, 0);
    const taxAmount = (subtotal * formData.taxRate) / 100;
    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const { subtotal, taxAmount, total } = calculateTotals();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to save invoices");
        return;
      }

      const { error } = await supabase.from("invoices").insert({
        user_id: user.id,
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
        status: "draft",
        currency: formData.currency,
      });

      if (error) throw error;

      toast.success("Invoice saved successfully!");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error("Error saving invoice");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Create Invoice</h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">Fill in the details below</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={() => navigate("/dashboard")} className="flex-1 sm:flex-none">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1 sm:flex-none">
              {saving ? "Saving..." : "Save Invoice"}
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="p-4 sm:p-6">
            <InvoiceForm formData={formData} setFormData={setFormData} />
          </Card>

          <div className="lg:sticky lg:top-6 lg:self-start">
            <InvoicePreview formData={formData} totals={calculateTotals()} />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CreateInvoice;
