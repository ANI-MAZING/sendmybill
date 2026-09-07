import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BriefcaseBusiness, FileText, LayoutDashboard, LogOut, Plus, ReceiptText, Users, Settings, WalletCards } from "lucide-react";
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
      <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-card p-3 md:hidden">
        <button aria-label="Sendmybill dashboard" className="flex items-center gap-2 font-bold" onClick={() => navigate("/dashboard")}><FileText className="h-5 w-5" /><span className="hidden sm:inline">Sendmybill</span></button>
        <div className="flex items-center gap-1">
          <Button aria-label="Dashboard" variant={isActive("/dashboard") ? "default" : "ghost"} size="icon" onClick={() => navigate("/dashboard")}><LayoutDashboard className="h-4 w-4" /></Button>
          <Button aria-label="Create invoice" variant={isActive("/dashboard/create") ? "default" : "ghost"} size="icon" onClick={() => navigate("/dashboard/create")}><Plus className="h-4 w-4" /></Button>
          <Button aria-label="Manage invoices" variant={location.pathname.startsWith("/dashboard/invoices") ? "default" : "ghost"} size="icon" onClick={() => navigate("/dashboard/invoices")}><ReceiptText className="h-4 w-4" /></Button>
          <Button aria-label="Clients" variant={isActive("/dashboard/clients") ? "default" : "ghost"} size="icon" onClick={() => navigate("/dashboard/clients")}><Users className="h-4 w-4" /></Button>
          <Button aria-label="Projects" variant={location.pathname.startsWith("/dashboard/projects") ? "default" : "ghost"} size="icon" onClick={() => navigate("/dashboard/projects")}><BriefcaseBusiness className="h-4 w-4" /></Button>
          <Button aria-label="Income and outgoings" variant={isActive("/dashboard/ledger") ? "default" : "ghost"} size="icon" onClick={() => navigate("/dashboard/ledger")}><WalletCards className="h-4 w-4" /></Button>
          <Button aria-label="Settings" variant={isActive("/dashboard/settings") ? "default" : "ghost"} size="icon" onClick={() => navigate("/dashboard/settings")}><Settings className="h-4 w-4" /></Button>
          <ThemeToggle />
        </div>
      </header>
      <aside className="fixed left-0 top-0 hidden h-full w-64 border-r border-border bg-card p-6 md:block">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold text-foreground">Sendmybill</span>
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
            variant={location.pathname.startsWith("/dashboard/invoices") ? "default" : "ghost"}
            className="w-full justify-start"
            onClick={() => navigate("/dashboard/invoices")}
          >
            <ReceiptText className="h-5 w-5 mr-3" />
            Manage Invoices
          </Button>
          <Button
            variant={isActive("/dashboard/clients") ? "default" : "ghost"}
            className="w-full justify-start"
            onClick={() => navigate("/dashboard/clients")}
          >
            <Users className="h-5 w-5 mr-3" />
            Clients
          </Button>
          <Button variant={location.pathname.startsWith("/dashboard/projects") ? "default" : "ghost"} className="w-full justify-start" onClick={() => navigate("/dashboard/projects")}>
            <BriefcaseBusiness className="h-5 w-5 mr-3" />Projects
          </Button>
          <Button variant={isActive("/dashboard/ledger") ? "default" : "ghost"} className="w-full justify-start" onClick={() => navigate("/dashboard/ledger")}>
            <WalletCards className="h-5 w-5 mr-3" />Income & Outgoings
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

      <main className="p-4 sm:p-6 md:ml-64 md:p-8">
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;
