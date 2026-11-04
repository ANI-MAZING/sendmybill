import { useState } from "react";
import { format } from "date-fns";
import { Check, Copy, Eye, Link2, RefreshCw, Unlink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buildShareUrl } from "@/lib/invoice-record";

interface ShareInvoicePanelProps {
  invoiceId: string;
  token: string | null;
  viewCount: number;
  lastViewedAt: string | null;
  onChange: () => void;
}

/** Creating a link when none exists, then copying it, is one click for the owner. */
export const copyInvoiceLink = async (invoiceId: string): Promise<boolean> => {
  const { data, error } = await supabase.rpc("enable_invoice_share", { p_invoice_id: invoiceId });
  if (error || !data) {
    toast.error("Couldn’t create the link. Please try again.");
    return false;
  }
  try {
    await navigator.clipboard.writeText(buildShareUrl(data));
    toast.success("Link copied. Anyone with it can view this invoice.");
  } catch {
    toast.info(buildShareUrl(data));
  }
  return true;
};

const ShareInvoicePanel = ({ invoiceId, token, viewCount, lastViewedAt, onChange }: ShareInvoicePanelProps) => {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const run = async (action: () => Promise<boolean>) => {
    setBusy(true);
    const ok = await action();
    setBusy(false);
    if (ok) onChange();
  };

  const createLink = () =>
    run(async () => {
      const { error } = await supabase.rpc("enable_invoice_share", { p_invoice_id: invoiceId });
      if (error) toast.error("Couldn’t create the link. Please try again.");
      return !error;
    });

  const regenerate = () =>
    run(async () => {
      const { error } = await supabase.rpc("enable_invoice_share", { p_invoice_id: invoiceId, p_regenerate: true });
      if (error) toast.error("Couldn’t create a new link. Please try again.");
      else toast.success("New link created. The old link no longer works.");
      return !error;
    });

  const stopSharing = () =>
    run(async () => {
      const { error } = await supabase.rpc("disable_invoice_share", { p_invoice_id: invoiceId });
      if (error) toast.error("Couldn’t turn off the link. Please try again.");
      else toast.success("Link turned off.");
      return !error;
    });

  const copy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(buildShareUrl(token));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn’t copy. Select the link and copy it manually.");
    }
  };

  if (!token) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
          <div>
            <p className="font-semibold">Send this invoice to your client</p>
            <p className="text-sm text-muted-foreground">
              Get a link your client can open and download. No account needed.
            </p>
          </div>
          <Button onClick={() => void createLink()} disabled={busy}>
            <Link2 className="mr-2 h-4 w-4" />Create share link
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input readOnly value={buildShareUrl(token)} onFocus={(event) => event.currentTarget.select()} aria-label="Invoice link" />
          <Button onClick={() => void copy()} className="shrink-0">
            {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            {viewCount === 0
              ? "Not opened by your client yet"
              : `Opened ${viewCount} ${viewCount === 1 ? "time" : "times"}${lastViewedAt ? `, last on ${format(new Date(lastViewedAt), "MMM dd, h:mm a")}` : ""}`}
          </span>
          <span className="flex gap-1">
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => void regenerate()}>
              <RefreshCw className="mr-2 h-4 w-4" />New link
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => void stopSharing()}>
              <Unlink className="mr-2 h-4 w-4" />Turn off
            </Button>
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default ShareInvoicePanel;
