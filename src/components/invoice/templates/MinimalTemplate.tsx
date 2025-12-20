import { format } from "date-fns";
import { InvoiceFormData } from "@/pages/CreateInvoice";
import { formatCurrency } from "@/lib/currencies";

interface ProfileData {
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  tax_id: string;
  bank_name: string;
  bank_account_number: string;
  bank_routing_number: string;
  bank_swift_code: string;
  company_logo_url: string | null;
  signature_url: string | null;
}

interface TemplateProps {
  formData: InvoiceFormData;
  totals: {
    subtotal: number;
    taxAmount: number;
    total: number;
  };
  profileData: ProfileData | null;
}

const MinimalTemplate = ({ formData, totals, profileData }: TemplateProps) => {
  const currency = formData.currency || "USD";

  return (
    <div className="space-y-8 sm:space-y-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="flex items-start gap-4">
          {profileData?.company_logo_url && (
            <img
              src={profileData.company_logo_url}
              alt="Company Logo"
              className="w-12 h-12 object-contain"
            />
          )}
          <div>
            <h1 className="text-xl sm:text-2xl font-light tracking-wide">Invoice</h1>
            <p className="text-gray-500 mt-1">{formData.invoiceNumber}</p>
            {profileData && (
              <div className="mt-4">
                <p className="text-xs text-gray-400 mb-1">FROM</p>
                <p className="font-medium text-sm">{profileData.company_name || "Your Company"}</p>
                {profileData.company_address && (
                  <p className="text-xs text-gray-600 whitespace-pre-line mt-1">{profileData.company_address}</p>
                )}
                {profileData.company_phone && <p className="text-xs text-gray-600">{profileData.company_phone}</p>}
                {profileData.company_email && <p className="text-xs text-gray-600">{profileData.company_email}</p>}
              </div>
            )}
          </div>
        </div>
        <div className="text-left sm:text-right text-sm w-full sm:w-auto">
          <p className="text-gray-500">Issued</p>
          <p>{format(formData.issueDate, "MMM dd, yyyy")}</p>
          <p className="text-gray-500 mt-2">Due</p>
          <p>{format(formData.dueDate, "MMM dd, yyyy")}</p>
        </div>
      </div>

      {/* Client Info */}
      <div>
        <p className="text-xs text-gray-400 mb-2">BILLED TO</p>
        <p className="font-medium">{formData.clientName || "Client Name"}</p>
        <p className="text-sm text-gray-600">{formData.clientEmail || "client@example.com"}</p>
        {formData.clientAddress && (
          <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{formData.clientAddress}</p>
        )}
      </div>

      {/* Items */}
      <div className="space-y-4 overflow-x-auto">
        <div className="grid grid-cols-12 gap-2 sm:gap-4 text-xs text-gray-400 pb-2 border-b border-gray-200 min-w-[300px]">
          <div className="col-span-5 sm:col-span-6">DESCRIPTION</div>
          <div className="col-span-2 text-right">QTY</div>
          <div className="col-span-2 text-right">RATE</div>
          <div className="col-span-3 sm:col-span-2 text-right">AMOUNT</div>
        </div>
        
        {formData.items.map((item, index) => (
          <div key={index} className="grid grid-cols-12 gap-2 sm:gap-4 text-sm py-3 border-b border-gray-100 min-w-[300px]">
            <div className="col-span-5 sm:col-span-6">{item.description || "Item description"}</div>
            <div className="col-span-2 text-right text-gray-600">{item.quantity}</div>
            <div className="col-span-2 text-right text-gray-600">{formatCurrency(item.rate, currency)}</div>
            <div className="col-span-3 sm:col-span-2 text-right font-medium">{formatCurrency(item.amount, currency)}</div>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-full sm:w-64 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal</span>
            <span>{formatCurrency(totals.subtotal, currency)}</span>
          </div>
          {formData.taxRate > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Tax ({formData.taxRate}%)</span>
              <span>{formatCurrency(totals.taxAmount, currency)}</span>
            </div>
          )}
          <div className="flex justify-between pt-3 border-t border-gray-300">
            <span className="font-medium">Total</span>
            <span className="text-lg sm:text-xl font-medium">{formatCurrency(totals.total, currency)}</span>
          </div>
        </div>
      </div>

      {/* Signature */}
      {profileData?.signature_url && (
        <div className="pt-8 border-t border-gray-200">
          <div className="flex flex-col items-end">
            <p className="text-xs text-gray-400 mb-2">Authorized Signature</p>
            <img
              src={profileData.signature_url}
              alt="Signature"
              className="h-12 object-contain"
            />
            {profileData.company_name && (
              <p className="text-xs font-medium mt-2">{profileData.company_name}</p>
            )}
          </div>
        </div>
      )}

      {/* Notes */}
      {formData.notes && (
        <div className="pt-8 border-t border-gray-200">
          <p className="text-xs text-gray-400 mb-2">NOTES</p>
          <p className="text-sm text-gray-600 whitespace-pre-line">{formData.notes}</p>
        </div>
      )}

      {/* Bank Details */}
      {profileData && (profileData.bank_name || profileData.bank_account_number) && (
        <div className="pt-8 border-t border-gray-200">
          <p className="text-xs text-gray-400 mb-2">BANK DETAILS</p>
          <div className="text-xs text-gray-600 space-y-1">
            {profileData.bank_name && <p><span className="font-medium">Bank:</span> {profileData.bank_name}</p>}
            {profileData.bank_account_number && <p><span className="font-medium">Account:</span> {profileData.bank_account_number}</p>}
            {profileData.bank_routing_number && <p><span className="font-medium">Routing:</span> {profileData.bank_routing_number}</p>}
            {profileData.bank_swift_code && <p><span className="font-medium">SWIFT:</span> {profileData.bank_swift_code}</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default MinimalTemplate;
