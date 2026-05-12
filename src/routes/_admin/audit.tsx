import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { ScrollText, User } from "lucide-react";

export const Route = createFileRoute("/_admin/audit")({
  component: AuditPage,
});

const audit = [
  { actor: "Master Admin", action: "Adjusted balance for @rakib_bd: +৳500", time: "5 min ago", ip: "103.x.x.42" },
  { actor: "Master Admin", action: "Marked replace request #1 as collected", time: "23 min ago", ip: "103.x.x.42" },
  { actor: "Master Admin", action: "Uploaded 250 stock items via Excel", time: "1 hour ago", ip: "103.x.x.42" },
  { actor: "Master Admin", action: "Banned user @spam_user99", time: "2 hours ago", ip: "103.x.x.42" },
  { actor: "Master Admin", action: "Sent broadcast to 2847 users", time: "1 day ago", ip: "103.x.x.42" },
  { actor: "Master Admin", action: "Restarted telegram bot process", time: "2 days ago", ip: "103.x.x.42" },
];

function AuditPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
        <p className="text-sm text-muted-foreground">Every admin action recorded · Tamper-proof trail</p>
      </div>

      <Card className="glass border-white/5 p-0 overflow-hidden">
        <div className="divide-y divide-white/5">
          {audit.map((a, i) => (
            <div key={i} className="flex items-center gap-4 p-4 hover:bg-white/[0.03]">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15">
                <ScrollText className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">{a.action}</div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <User className="h-3 w-3" /> {a.actor} · IP {a.ip}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">{a.time}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
