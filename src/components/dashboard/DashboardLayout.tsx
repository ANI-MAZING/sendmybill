import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FileText, LayoutDashboard, LogOut, Plus, Users, Settings } from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Error signing out");
    } else {
      toast.success("Signed out successfully");
      navigate("/");
    }
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed left-0 top-0 h-full w-64 border-r border-border bg-card p-6">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold text-foreground">InvoiceFlow</span>
          </div>
          <ThemeToggle />
        </div>

        <nav className="space-y-2">
          <Button
            variant={isActive("/dashboard") ? "default" : "ghost"}
            className="w-full justify-start"
            onClick={() => navigate("/dashboard")}
          >
            <LayoutDashboard className="h-5 w-5 mr-3" />
            Dashboard
          </Button>
          <Button
            variant={isActive("/dashboard/create") ? "default" : "ghost"}
            className="w-full justify-start"
            onClick={() => navigate("/dashboard/create")}
          >
            <Plus className="h-5 w-5 mr-3" />
            Create Invoice
          </Button>
          <Button
            variant={isActive("/dashboard/clients") ? "default" : "ghost"}
            className="w-full justify-start"
            onClick={() => navigate("/dashboard/clients")}
          >
            <Users className="h-5 w-5 mr-3" />
            Clients
          </Button>
          <Button
            variant={isActive("/dashboard/settings") ? "default" : "ghost"}
            className="w-full justify-start"
            onClick={() => navigate("/dashboard/settings")}
          >
            <Settings className="h-5 w-5 mr-3" />
            Settings
          </Button>
        </nav>

        <div className="absolute bottom-6 left-6 right-6">
          <Button
            variant="ghost"
            className="w-full justify-start text-destructive hover:text-destructive"
            onClick={handleSignOut}
          >
            <LogOut className="h-5 w-5 mr-3" />
            Sign Out
          </Button>
        </div>
      </aside>

      <main className="ml-64 p-8">
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;