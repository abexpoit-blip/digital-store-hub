import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Megaphone, Send, Users, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export const Route = createFileRoute("/_admin/broadcast")({
  component: BroadcastPage,
});

function BroadcastPage() {
  const [msg, setMsg] = useState("");
  const [target, setTarget] = useState("all");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Broadcast Message</h1>
        <p className="text-sm text-muted-foreground">Send announcement to all bot users at once</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="glass border-white/5 p-6 lg:col-span-2">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Target audience</label>
          <div className="mb-5 grid grid-cols-3 gap-2">
            {[
              { id: "all", label: "All Users", count: "2,847" },
              { id: "active", label: "Active (30d)", count: "1,420" },
              { id: "vip", label: "VIP Only", count: "87" },
            ].map((t) => (
              <button key={t.id} onClick={() => setTarget(t.id)} className={`rounded-xl border p-3 text-left transition ${target === t.id ? "border-primary/50 bg-primary/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}>
                <div className="text-sm font-semibold">{t.label}</div>
                <div className="text-xs text-muted-foreground">{t.count} users</div>
              </button>
            ))}
          </div>

          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Message</label>
          <textarea
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            rows={8}
            placeholder="🎉 New stock arrived! Get 20% off on all VPN packages today only..."
            className="w-full rounded-xl border border-white/10 bg-white/5 p-4 text-sm focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>{msg.length} / 4096 chars · Markdown supported</span>
            <button className="flex items-center gap-1 hover:text-foreground"><ImageIcon className="h-3 w-3" /> Attach image</button>
          </div>

          <Button className="mt-5 h-12 w-full bg-gradient-to-r from-primary to-[var(--primary-glow)] text-primary-foreground glow">
            <Send className="mr-2 h-4 w-4" /> Send to {target === "all" ? "2,847" : target === "active" ? "1,420" : "87"} users
          </Button>
        </Card>

        <Card className="glass border-white/5 p-6">
          <div className="flex items-center gap-2"><Megaphone className="h-4 w-4 text-primary" /><h3 className="font-semibold">Recent broadcasts</h3></div>
          <div className="mt-4 space-y-3">
            {[
              { msg: "🎉 Eid offer 30% off!", target: "All", sent: "2,847", time: "2 days ago" },
              { msg: "⚠️ Maintenance tonight 2AM", target: "All", sent: "2,840", time: "5 days ago" },
              { msg: "💎 VIP exclusive deal", target: "VIP", sent: "87", time: "1 week ago" },
            ].map((b, i) => (
              <div key={i} className="rounded-lg border border-white/5 bg-white/5 p-3">
                <div className="text-sm font-medium">{b.msg}</div>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Users className="h-3 w-3" /> {b.target} · {b.sent} delivered · {b.time}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
