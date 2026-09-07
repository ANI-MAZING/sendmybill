import { AlertCircle, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const PageLoader = ({ label = "Loading…" }: { label?: string }) => (
  <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-live="polite">
    <div className="flex items-center gap-3 text-muted-foreground">
      <LoaderCircle className="h-5 w-5 animate-spin" />
      <span>{label}</span>
    </div>
  </div>
);

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export const ErrorState = ({ title = "Something went wrong", message, onRetry }: ErrorStateProps) => (
  <Card role="alert">
    <CardContent className="flex flex-col items-center py-12 text-center">
      <AlertCircle className="mb-4 h-10 w-10 text-destructive" />
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button className="mt-5" variant="outline" onClick={onRetry}>Try again</Button>
      )}
    </CardContent>
  </Card>
);
