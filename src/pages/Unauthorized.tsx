import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

const Unauthorized = () => (
  <main className="flex min-h-screen items-center justify-center bg-background p-6">
    <div className="max-w-md text-center">
      <ShieldAlert className="mx-auto mb-5 h-12 w-12 text-muted-foreground" />
      <h1 className="text-3xl font-bold">This invoice isn’t available</h1>
      <p className="mt-3 text-muted-foreground">
        It may have been removed, or it belongs to another account.
      </p>
      <Button asChild className="mt-6">
        <Link to="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  </main>
);

export default Unauthorized;
