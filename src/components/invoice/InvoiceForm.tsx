import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { currencies, getCurrencySymbol } from "@/lib/currencies";
import { calculateLineAmount } from "@/lib/money";
import { fromDateInputValue, toDateInputValue, type InvoiceFieldErrors } from "@/lib/invoice";
import type { InvoiceFormData, InvoiceLineItem } from "@/types/domain";

interface InvoiceFormProps {
  formData: InvoiceFormData;
  setFormData: (data: InvoiceFormData) => void;
  errors?: InvoiceFieldErrors;
  clearError?: (path: string) => void;
}

interface Client {
  id: string;
  client_name: string;
  client_email: string;
  client_address: string | null;
}

const InvoiceForm = ({ formData, setFormData, errors = {}, clearError }: InvoiceFormProps) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientLoadError, setClientLoadError] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setClientLoadError(false);
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("client_name");

      if (error) throw error;
      setClients(data || []);
    } catch {
      setClientLoadError(true);
    }
  };

  const handleClientSelect = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    if (client) {
      setFormData({
        ...formData,
        clientName: client.client_name,
        clientEmail: client.client_email,
        clientAddress: client.client_address || "",
      });
    }
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { description: "", quantity: 1, rate: 0, amount: 0 }],
    });
  };

  const removeItem = (index: number) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  const updateItem = <Key extends keyof InvoiceLineItem>(index: number, field: Key, value: InvoiceLineItem[Key]) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === "quantity" || field === "rate") {
      newItems[index].amount = calculateLineAmount(newItems[index].quantity, newItems[index].rate);
    }
    clearError?.(`items.${index}.${field}`);
    setFormData({ ...formData, items: newItems });
  };

  const fieldError = (path: string) => errors[path]
    ? <p className="text-sm text-destructive" id={`${path.split(".").join("-")}-error`}>{errors[path]}</p>
    : null;

  const currencySymbol = getCurrencySymbol(formData.currency);

  return (
    <div className="space-y-6">
      {/* Template and Currency Row */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Template & Currency</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Invoice Template</Label>
            <Select
              value={formData.templateId}
              onValueChange={(value) => setFormData({ ...formData, templateId: value as InvoiceFormData["templateId"] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="modern">Modern</SelectItem>
                <SelectItem value="classic">Classic</SelectItem>
                <SelectItem value="minimal">Minimal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Currency</Label>
            <Select
              value={formData.currency}
              onValueChange={(value) => {
                clearError?.("currency");
                setFormData({ ...formData, currency: value });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {currencies.map((currency) => (
                  <SelectItem key={currency.code} value={currency.code}>
                    {currency.symbol} - {currency.name} ({currency.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldError("currency")}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Invoice Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="invoiceNumber">Invoice Number</Label>
            <Input
              id="invoiceNumber"
              value={formData.invoiceNumber}
              onChange={(e) => {
                clearError?.("invoiceNumber");
                setFormData({ ...formData, invoiceNumber: e.target.value });
              }}
              aria-invalid={Boolean(errors.invoiceNumber)}
            />
            {fieldError("invoiceNumber")}
          </div>
          <div className="space-y-2">
            <Label htmlFor="issueDate">Issue Date</Label>
            <Input
              id="issueDate"
              type="date"
              value={toDateInputValue(formData.issueDate)}
              onChange={(e) => {
                clearError?.("issueDate");
                setFormData({ ...formData, issueDate: fromDateInputValue(e.target.value) });
              }}
              aria-invalid={Boolean(errors.issueDate)}
            />
            {fieldError("issueDate")}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="dueDate">Due Date</Label>
          <Input
            id="dueDate"
            type="date"
            value={toDateInputValue(formData.dueDate)}
            onChange={(e) => {
              clearError?.("dueDate");
              setFormData({ ...formData, dueDate: fromDateInputValue(e.target.value) });
            }}
            min={toDateInputValue(formData.issueDate)}
            aria-invalid={Boolean(errors.dueDate)}
          />
          {fieldError("dueDate")}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Client Information</h3>
        
        {clients.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="selectClient">Select Saved Client (Optional)</Label>
            <Select onValueChange={handleClientSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a client..." />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.client_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {clientLoadError && (
          <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>Saved clients couldn’t be loaded.</span>
            <Button type="button" variant="ghost" size="sm" onClick={fetchClients}>Retry</Button>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="clientName">Client Name</Label>
          <Input
            id="clientName"
            value={formData.clientName}
            onChange={(e) => {
              clearError?.("clientName");
              setFormData({ ...formData, clientName: e.target.value });
            }}
            placeholder="Client or company name"
            aria-invalid={Boolean(errors.clientName)}
          />
          {fieldError("clientName")}
        </div>
        <div className="space-y-2">
          <Label htmlFor="clientEmail">Client Email</Label>
          <Input
            id="clientEmail"
            type="email"
            value={formData.clientEmail}
            onChange={(e) => {
              clearError?.("clientEmail");
              setFormData({ ...formData, clientEmail: e.target.value });
            }}
            placeholder="client@example.com"
            aria-invalid={Boolean(errors.clientEmail)}
          />
          {fieldError("clientEmail")}
        </div>
        <div className="space-y-2">
          <Label htmlFor="clientAddress">Client Address</Label>
          <Textarea
            id="clientAddress"
            value={formData.clientAddress}
            onChange={(e) => setFormData({ ...formData, clientAddress: e.target.value })}
            placeholder="Street address, city, state, ZIP"
            rows={3}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-lg font-semibold text-foreground">Line Items</h3>
          <Button type="button" onClick={addItem} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
        
        <div className="space-y-4">
          {formData.items.map((item, index) => (
            <div key={index} className="p-4 border border-border rounded-lg space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-2">
                  <Label htmlFor={`description-${index}`}>Description</Label>
                  <Input
                    id={`description-${index}`}
                    value={item.description}
                    onChange={(e) => updateItem(index, "description", e.target.value)}
                    placeholder="Item description"
                    aria-invalid={Boolean(errors[`items.${index}.description`])}
                  />
                  {fieldError(`items.${index}.description`)}
                </div>
                {formData.items.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(index)}
                    className="mt-6"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor={`quantity-${index}`}>Quantity</Label>
                  <Input
                    id={`quantity-${index}`}
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, "quantity", Number(e.target.value))}
                    aria-invalid={Boolean(errors[`items.${index}.quantity`])}
                  />
                  {fieldError(`items.${index}.quantity`)}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`rate-${index}`}>Rate</Label>
                  <Input
                    id={`rate-${index}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.rate}
                    onChange={(e) => updateItem(index, "rate", Number(e.target.value))}
                    aria-invalid={Boolean(errors[`items.${index}.rate`])}
                  />
                  {fieldError(`items.${index}.rate`)}
                </div>
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input
                    value={`${currencySymbol}${item.amount.toFixed(2)}`}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Additional Information</h3>
        <div className="space-y-2">
          <Label htmlFor="taxRate">Tax Rate (%)</Label>
          <Input
            id="taxRate"
            type="number"
            min="0"
            step="0.01"
            value={formData.taxRate}
            max="100"
            onChange={(e) => {
              clearError?.("taxRate");
              setFormData({ ...formData, taxRate: Number(e.target.value) });
            }}
            aria-invalid={Boolean(errors.taxRate)}
          />
          {fieldError("taxRate")}
        </div>
        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Any additional notes or terms..."
            rows={4}
          />
        </div>
      </div>
    </div>
  );
};

export default InvoiceForm;
