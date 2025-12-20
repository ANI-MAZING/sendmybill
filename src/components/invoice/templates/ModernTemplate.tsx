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

const ModernTemplate = ({ formData, totals, profileData }: TemplateProps) => {
  const currency = formData.currency || "USD";

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b-2 border-blue-600 pb-6">
        <div className="flex items-start gap-4">
          {profileData?.company_logo_url && (
            <img
              src={profileData.company_logo_url}
              alt="Company Logo"
              className="w-16 h-16 sm:w-20 sm:h-20 object-contain"
            />
          )}
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold text-blue-600">INVOICE</h1>
            <p className="text-gray-600 mt-2">{formData.invoiceNumber}</p>
          </div>
        </div>
        <div className="text-left sm:text-right w-full sm:w-auto">
          {profileData && (
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-1">ISSUED BY</p>
              <p className="font-semibold">{profileData.company_name || "Your Company"}</p>
              {profileData.company_address && (
                <p className="text-sm text-gray-600 whitespace-pre-line mt-1">{profileData.company_address}</p>
              )}
              {profileData.company_phone && <p className="text-sm text-gray-600">{profileData.company_phone}</p>}
              {profileData.company_email && <p className="text-sm text-gray-600">{profileData.company_email}</p>}
            </div>
          )}
          <p className="text-sm text-gray-600">Issue Date</p>
          <p className="font-semibold">{format(formData.issueDate, "MMM dd, yyyy")}</p>
          <p className="text-sm text-gray-600 mt-2">Due Date</p>
          <p className="font-semibold">{format(formData.dueDate, "MMM dd, yyyy")}</p>
        </div>
      </div>

      {/* Client Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
        <div>
          <h3 className="text-sm font-semibold text-gray-600 mb-2">BILL TO</h3>
          <p className="font-semibold text-lg">{formData.clientName || "Client Name"}</p>
          <p className="text-gray-600">{formData.clientEmail || "client@example.com"}</p>
          {formData.clientAddress && (
            <p className="text-gray-600 mt-1 whitespace-pre-line">{formData.clientAddress}</p>
          )}
        </div>
      </div>

      {/* Items Table */}
      <div className="mt-6 sm:mt-8 overflow-x-auto">
        <table className="w-full min-w-[400px]">
          <thead>
            <tr className="bg-blue-50 border-b-2 border-blue-600">
              <th className="text-left p-2 sm:p-3 text-xs sm:text-sm font-semibold">DESCRIPTION</th>
              <th className="text-right p-2 sm:p-3 text-xs sm:text-sm font-semibold">QTY</th>
              <th className="text-right p-2 sm:p-3 text-xs sm:text-sm font-semibold">RATE</th>
              <th className="text-right p-2 sm:p-3 text-xs sm:text-sm font-semibold">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {formData.items.map((item, index) => (
              <tr key={index} className="border-b border-gray-200">
                <td className="p-2 sm:p-3 text-sm">{item.description || "Item description"}</td>
                <td className="text-right p-2 sm:p-3 text-sm">{item.quantity}</td>
                <td className="text-right p-2 sm:p-3 text-sm">{formatCurrency(item.rate, currency)}</td>
                <td className="text-right p-2 sm:p-3 text-sm">{formatCurrency(item.amount, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-full sm:w-64 space-y-2">
          <div className="flex justify-between py-2">
            <span className="text-gray-600">Subtotal:</span>
            <span className="font-semibold">{formatCurrency(totals.subtotal, currency)}</span>
          </div>
          {formData.taxRate > 0 && (
            <div className="flex justify-between py-2">
              <span className="text-gray-600">Tax ({formData.taxRate}%):</span>
              <span className="font-semibold">{formatCurrency(totals.taxAmount, currency)}</span>
            </div>
          )}
          <div className="flex justify-between py-3 border-t-2 border-blue-600">
            <span className="text-lg font-bold">Total:</span>
            <span className="text-lg font-bold text-blue-600">{formatCurrency(totals.total, currency)}</span>
          </div>
        </div>
      </div>

      {/* Signature */}
      {profileData?.signature_url && (
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex flex-col items-end">
            <p className="text-sm text-gray-500 mb-2">Authorized Signature</p>
            <img
              src={profileData.signature_url}
              alt="Signature"
              className="h-16 object-contain"
            />
            {profileData.company_name && (
              <p className="text-sm font-medium mt-2">{profileData.company_name}</p>
            )}
          </div>
        </div>
      )}

      {/* Notes */}
      {formData.notes && (
        <div className="mt-6 sm:mt-8 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">NOTES</h3>
          <p className="text-gray-600 whitespace-pre-line">{formData.notes}</p>
        </div>
      )}

      {/* Bank Details */}
      {profileData && (profileData.bank_name || profileData.bank_account_number) && (
        <div className="mt-6 sm:mt-8 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">BANK DETAILS</h3>
          <div className="text-sm text-gray-600 space-y-1">
            {profileData.bank_name && <p><span className="font-medium">Bank:</span> {profileData.bank_name}</p>}
            {profileData.bank_account_number && <p><span className="font-medium">Account Number:</span> {profileData.bank_account_number}</p>}
            {profileData.bank_routing_number && <p><span className="font-medium">Routing Number:</span> {profileData.bank_routing_number}</p>}
            {profileData.bank_swift_code && <p><span className="font-medium">SWIFT/BIC:</span> {profileData.bank_swift_code}</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModernTemplate;
