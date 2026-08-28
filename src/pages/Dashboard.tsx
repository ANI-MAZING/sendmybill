import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import InvoiceList from "@/components/invoice/InvoiceList";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const Dashboard = () => {
  const navigate = useNavigate();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Invoices</h1>
            <p className="text-muted-foreground mt-1">Manage and track all your invoices</p>
          </div>
          <Button onClick={() => navigate("/dashboard/create")} size="lg">
            <Plus className="h-5 w-5 mr-2" />
            Create Invoice
          </Button>
        </div>
        
        <InvoiceList />
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
