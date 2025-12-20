import { useRef, useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { InvoiceFormData } from "@/pages/CreateInvoice";
import ModernTemplate from "./templates/ModernTemplate";
import ClassicTemplate from "./templates/ClassicTemplate";
import MinimalTemplate from "./templates/MinimalTemplate";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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

interface InvoicePreviewProps {
  formData: InvoiceFormData;
  totals: {
    subtotal: number;
    taxAmount: number;
    total: number;
  };
}

const InvoicePreview = ({ formData, totals }: InvoicePreviewProps) => {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("company_name, company_address, company_phone, company_email, tax_id, bank_name, bank_account_number, bank_routing_number, bank_swift_code, company_logo_url, signature_url")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      if (data) setProfileData(data as ProfileData);
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  };

  const handleExportPDF = async () => {
    if (!invoiceRef.current) return;

    try {
      toast.info("Generating PDF...");
      
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 0;

      pdf.addImage(
        imgData,
        "PNG",
        imgX,
        imgY,
        imgWidth * ratio,
        imgHeight * ratio
      );

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
    <Card className="p-4 sm:p-6 bg-background">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <h3 className="text-lg font-semibold text-foreground">Preview</h3>
        <Button onClick={handleExportPDF} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export PDF
        </Button>
      </div>
      <div ref={invoiceRef} className="bg-card rounded-lg overflow-hidden p-4 sm:p-6">
        {renderTemplate()}
      </div>
    </Card>
  );
};

export default InvoicePreview;
