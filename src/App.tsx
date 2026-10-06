import { lazy, Suspense, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { PageLoader } from "@/components/shared/AsyncState";

const SharedInvoice = lazy(() => import("./pages/SharedInvoice"));
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const UpdatePassword = lazy(() => import("./pages/UpdatePassword"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ManageInvoices = lazy(() => import("./pages/ManageInvoices"));
const CreateInvoice = lazy(() => import("./pages/CreateInvoice"));
const InvoiceDetail = lazy(() => import("./pages/InvoiceDetail"));
const EditInvoice = lazy(() => import("./pages/EditInvoice"));
const ClientsManagement = lazy(() => import("./pages/ClientsManagement"));
const ProjectsManagement = lazy(() => import("./pages/ProjectsManagement"));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail"));
const Ledger = lazy(() => import("./pages/Ledger"));
const InvoicePresets = lazy(() => import("./pages/InvoicePresets"));
const ProfileSettings = lazy(() => import("./pages/ProfileSettings"));
const Unauthorized = lazy(() => import("./pages/Unauthorized"));
const NotFound = lazy(() => import("./pages/NotFound"));

const protect = (element: ReactNode, requireOnboarding = true) => (
  <ProtectedRoute requireOnboarding={requireOnboarding}>{element}</ProtectedRoute>
);

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageLoader label="Loading Sendmybill…" />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/i/:token" element={<SharedInvoice />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/auth/update-password" element={<UpdatePassword />} />
              <Route path="/onboarding" element={protect(<Onboarding />, false)} />
              <Route path="/dashboard" element={protect(<Dashboard />)} />
              <Route path="/dashboard/invoices" element={protect(<ManageInvoices />)} />
              <Route path="/dashboard/create" element={protect(<CreateInvoice />)} />
              <Route path="/dashboard/invoices/:id" element={protect(<InvoiceDetail />)} />
              <Route path="/dashboard/edit/:id" element={protect(<EditInvoice />)} />
              <Route path="/dashboard/clients" element={protect(<ClientsManagement />)} />
              <Route path="/dashboard/projects" element={protect(<ProjectsManagement />)} />
              <Route path="/dashboard/projects/:id" element={protect(<ProjectDetail />)} />
              <Route path="/dashboard/ledger" element={protect(<Ledger />)} />
              <Route path="/dashboard/presets" element={protect(<InvoicePresets />)} />
              <Route path="/dashboard/settings" element={protect(<ProfileSettings />)} />
              <Route path="/unauthorized" element={protect(<Unauthorized />, false)} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </ThemeProvider>
);

export default App;
