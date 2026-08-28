import { useRef, useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";
import ModernTemplate from "./templates/ModernTemplate";
import ClassicTemplate from "./templates/ClassicTemplate";
import MinimalTemplate from "./templates/MinimalTemplate";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { resolveSellerAssetUrls, toSellerSnapshot } from "@/lib/profile";
import type { InvoiceFormData, InvoiceTotals, ProfileData } from "@/types/domain";

interface InvoicePreviewProps {
  formData: InvoiceFormData;
  totals: InvoiceTotals;
}

const InvoicePreview = ({ formData, totals }: InvoicePreviewProps) => {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchProfile = async () => {
      try {
        if (formData.sellerSnapshot) {
          const resolvedSnapshot = await resolveSellerAssetUrls(formData.sellerSnapshot);
          if (mounted) setProfileData(resolvedSnapshot);
          return;
        }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("company_name, company_address, company_phone, company_email, tax_id, bank_name, bank_account_number, bank_routing_number, bank_swift_code, company_logo_url, signature_url, invoice_accent_color, invoice_font")
        .eq("id", user.id)
        .single();

      if (error) throw error;
        if (data && mounted) setProfileData(await resolveSellerAssetUrls(toSellerSnapshot(data)));
      } catch {
        if (mounted) setProfileData(null);
      }
    };
    void fetchProfile();
    return () => { mounted = false; };
  }, [formData.sellerSnapshot]);

  const handleExportPDF = async () => {
    if (!invoiceRef.current) return;

    try {
      toast.info("Generating PDF...");
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const pageHeightPixels = Math.floor(canvas.width * pdfHeight / pdfWidth);
      let offset = 0;
      let pageIndex = 0;
      while (offset < canvas.height) {
        const sliceHeight = Math.min(pageHeightPixels, canvas.height - offset);
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;
        const context = pageCanvas.getContext("2d");
        if (!context) throw new Error("Canvas context unavailable");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        context.drawImage(canvas, 0, offset, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
        if (pageIndex > 0) pdf.addPage();
        pdf.addImage(pageCanvas.toDataURL("image/png"), "PNG", 0, 0, pdfWidth, sliceHeight * pdfWidth / canvas.width);
        offset += sliceHeight;
        pageIndex += 1;
      }

      pdf.save(`${formData.invoiceNumber || "invoice"}.pdf`);
      toast.success("PDF downloaded successfully!");
    } catch (error) {
      toast.error("Error generating PDF");
      console.error(error);
    }
  };

  const renderTemplate = () => {
    const templateProps = { formData, totals, profileData };
    
    switch (formData.templateId) {
      case "classic":
        return <ClassicTemplate {...templateProps} />;
      case "minimal":
        return <MinimalTemplate {...templateProps} />;
      case "modern":
      default:
        return <ModernTemplate {...templateProps} />;
    }
  };

  return (
    <Card data-invoice-print className="p-4 sm:p-6 bg-background">
      <div data-invoice-print-actions className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <h3 className="text-lg font-semibold text-foreground">Preview</h3>
        <div className="flex gap-2">
          <Button onClick={() => window.print()} variant="outline" size="sm">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button onClick={handleExportPDF} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>
      <div ref={invoiceRef} className="mx-auto w-full max-w-[794px] overflow-hidden rounded-lg bg-white p-4 text-gray-950 sm:p-6">
        {renderTemplate()}
      </div>
    </Card>
  );
};

export default InvoicePreview;
