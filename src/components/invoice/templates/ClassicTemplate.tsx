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

const ClassicTemplate = ({ formData, totals, profileData }: TemplateProps) => {
  const currency = formData.currency || "USD";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center border-b-2 border-gray-800 pb-4">
        {profileData?.company_logo_url && (
          <div className="flex justify-center mb-4">
            <img
              src={profileData.company_logo_url}
              alt="Company Logo"
              className="w-20 h-20 object-contain"
            />
          </div>
        )}
        <h1 className="text-2xl sm:text-3xl font-serif font-bold">INVOICE</h1>
        <p className="text-gray-600 mt-2">{formData.invoiceNumber}</p>
      </div>

      {/* Company Info */}
      {profileData && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-gray-500 mb-2">FROM</h3>
          <p className="font-semibold">{profileData.company_name || "Your Company"}</p>
          {profileData.company_address && (
            <p className="text-sm text-gray-600 whitespace-pre-line">{profileData.company_address}</p>
          )}
          {profileData.company_phone && <p className="text-sm text-gray-600">{profileData.company_phone}</p>}
          {profileData.company_email && <p className="text-sm text-gray-600">{profileData.company_email}</p>}
        </div>
      )}

      {/* Dates and Client Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <h3 className="text-xs font-semibold text-gray-500 mb-3">INVOICE DETAILS</h3>
          <div className="space-y-1">
            <div className="flex flex-col sm:flex-row">
              <span className="text-gray-600 sm:w-24">Issue Date:</span>
              <span className="font-medium">{format(formData.issueDate, "MMM dd, yyyy")}</span>
            </div>
            <div className="flex flex-col sm:flex-row">
              <span className="text-gray-600 sm:w-24">Due Date:</span>
              <span className="font-medium">{format(formData.dueDate, "MMM dd, yyyy")}</span>
            </div>
          </div>
        </div>
        <div>
          <h3 className="text-xs font-semibold text-gray-500 mb-3">BILL TO</h3>
          <p className="font-semibold">{formData.clientName || "Client Name"}</p>
          <p className="text-sm text-gray-600">{formData.clientEmail || "client@example.com"}</p>
          {formData.clientAddress && (
            <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{formData.clientAddress}</p>
          )}
        </div>
      </div>

      {/* Items Table */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[400px] border border-gray-300">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300">
              <th className="text-left p-2 text-xs font-semibold">DESCRIPTION</th>
              <th className="text-center p-2 text-xs font-semibold w-16 sm:w-20">QTY</th>
              <th className="text-right p-2 text-xs font-semibold w-20 sm:w-24">RATE</th>
              <th className="text-right p-2 text-xs font-semibold w-24 sm:w-28">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {formData.items.map((item, index) => (
              <tr key={index} className="border-b border-gray-200">
                <td className="p-2 text-sm">{item.description || "Item description"}</td>
                <td className="text-center p-2 text-sm">{item.quantity}</td>
                <td className="text-right p-2 text-sm">{formatCurrency(item.rate, currency)}</td>
                <td className="text-right p-2 text-sm">{formatCurrency(item.amount, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end mt-6">
        <div className="w-full sm:w-72 border border-gray-300 p-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal:</span>
              <span>{formatCurrency(totals.subtotal, currency)}</span>
            </div>
            {formData.taxRate > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tax ({formData.taxRate}%):</span>
                <span>{formatCurrency(totals.taxAmount, currency)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-gray-300">
              <span className="font-bold">Total:</span>
              <span className="font-bold">{formatCurrency(totals.total, currency)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Signature */}
      {profileData?.signature_url && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex flex-col items-end">
            <p className="text-xs text-gray-500 mb-2">Authorized Signature</p>
            <img
              src={profileData.signature_url}
              alt="Signature"
              className="h-14 object-contain"
            />
            {profileData.company_name && (
              <p className="text-sm font-medium mt-2">{profileData.company_name}</p>
            )}
          </div>
        </div>
      )}

      {/* Notes */}
      {formData.notes && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <h3 className="text-xs font-semibold text-gray-500 mb-2">NOTES</h3>
          <p className="text-sm text-gray-600 whitespace-pre-line">{formData.notes}</p>
        </div>
      )}

      {/* Bank Details */}
      {profileData && (profileData.bank_name || profileData.bank_account_number) && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <h3 className="text-xs font-semibold text-gray-500 mb-2">BANK DETAILS</h3>
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

export default ClassicTemplate;
