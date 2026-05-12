import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { replaceRequests } from "@/lib/mock-data";
import { Check, X, Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_admin/replace")({
  component: ReplacePage,
});

function ReplacePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Replace Requests</h1>
        <p className="text-sm text-muted-foreground">User-submitted replace requests · Collect → Delete workflow</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass border-white/5 p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-warning/15"><Clock className="h-5 w-5 text-warning" /></div>
            <div><div className="text-2xl font-bold">7</div><div className="text-xs text-muted-foreground">Pending</div></div>
          </div>
        </Card>
        <Card className="glass border-white/5 p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-success/15"><Check className="h-5 w-5 text-success" /></div>
            <div><div className="text-2xl font-bold">142</div><div className="text-xs text-muted-foreground">Collected this month</div></div>
          </div>
        </Card>
        <Card className="glass border-white/5 p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-destructive/15"><X className="h-5 w-5 text-destructive" /></div>
            <div><div className="text-2xl font-bold">8</div><div className="text-xs text-muted-foreground">Rejected this month</div></div>
          </div>
        </Card>
      </div>

      <div className="space-y-3">
        {replaceRequests.map((r) => (
          <Card key={r.id} className="glass border-white/5 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex gap-4">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-primary to-[var(--primary-glow)]">
                  <RefreshCw className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{r.user}</span>
                    <span className="font-mono text-xs text-muted-foreground">· {r.tg_id}</span>
                    <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-semibold">{r.order_id}</span>
                  </div>
                  <div className="mt-1 text-sm">{r.product}</div>
                  <div className="mt-2 max-w-2xl rounded-lg border border-white/5 bg-white/[0.03] p-3 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Reason:</span> {r.reason}
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground">{r.time}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="bg-success/20 text-success hover:bg-success/30">
                  <Check className="mr-1 h-3.5 w-3.5" /> Mark Collected
                </Button>
                <Button size="sm" variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20">
                  <X className="mr-1 h-3.5 w-3.5" /> Reject
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
