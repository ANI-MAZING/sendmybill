import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FileText, LayoutDashboard, LogOut, Plus, ReceiptText, Users, Settings } from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";

interface DashboardLayoutProps {
  children: ReactNode;
}

const NAV_ITEMS = [
  { label: "Home", path: "/dashboard", icon: LayoutDashboard, exact: true },
  { label: "Invoices", path: "/dashboard/invoices", icon: ReceiptText, exact: false },
  { label: "Customers", path: "/dashboard/clients", icon: Users, exact: false },
  { label: "Settings", path: "/dashboard/settings", icon: Settings, exact: false },
];

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

  const isActive = (path: string, exact: boolean) =>
    exact ? location.pathname === path : location.pathname.startsWith(path);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-card p-3 md:hidden">
        <button aria-label="Sendmybill home" className="flex items-center gap-2 font-bold" onClick={() => navigate("/dashboard")}><FileText className="h-5 w-5" /><span className="hidden sm:inline">Sendmybill</span></button>
        <div className="flex items-center gap-1">
          {NAV_ITEMS.map(({ label, path, icon: Icon, exact }) => (
            <Button key={path} aria-label={label} variant={isActive(path, exact) ? "default" : "ghost"} size="icon" onClick={() => navigate(path)}><Icon className="h-4 w-4" /></Button>
          ))}
          <Button aria-label="New invoice" size="icon" variant={location.pathname === "/dashboard/create" ? "default" : "outline"} onClick={() => navigate("/dashboard/create")}><Plus className="h-4 w-4" /></Button>
          <ThemeToggle />
        </div>
      </header>
      <aside className="fixed left-0 top-0 hidden h-full w-64 border-r border-border bg-card p-6 md:block">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold text-foreground">Sendmybill</span>
          </div>
          <ThemeToggle />
        </div>

        <Button className="mb-6 w-full" onClick={() => navigate("/dashboard/create")}>
          <Plus className="h-5 w-5 mr-2" />
          New invoice
        </Button>

        <nav className="space-y-2">
          {NAV_ITEMS.map(({ label, path, icon: Icon, exact }) => (
            <Button
              key={path}
              variant={isActive(path, exact) ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => navigate(path)}
            >
              <Icon className="h-5 w-5 mr-3" />
              {label}
            </Button>
          ))}
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
