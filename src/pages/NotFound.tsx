import { Link, useLocation } from "react-router-dom";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md text-center">
        <FileQuestion className="mx-auto mb-5 h-12 w-12 text-muted-foreground" />
        <p className="font-mono text-sm text-muted-foreground">404 · {location.pathname}</p>
        <h1 className="mt-3 text-3xl font-bold">That page has moved—or never existed.</h1>
        <p className="mt-3 text-muted-foreground">Return home or open your invoice workspace to keep billing.</p>
        <div className="mt-6 flex justify-center gap-3"><Button asChild variant="outline"><Link to="/">Home</Link></Button><Button asChild><Link to="/dashboard">Dashboard</Link></Button></div>
      </div>
    </main>
  );
};

export default NotFound;
