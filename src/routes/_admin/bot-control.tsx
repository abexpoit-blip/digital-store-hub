import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Bot, Play, Square, RotateCw, Activity, Cpu, MemoryStick, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_admin/bot-control")({
  component: BotControlPage,
});

const logs = [
  { t: "12:04:33", lvl: "INFO", msg: "User 847203911 placed order #ORD-2847" },
  { t: "12:04:21", lvl: "INFO", msg: "Deposit confirmed: ৳1500 from @rakib_bd via Bkash" },
  { t: "12:03:58", lvl: "WARN", msg: "Stock low: FB Ad Account $50 (8 left)" },
  { t: "12:03:42", lvl: "INFO", msg: "New user joined: @new_buyer_99" },
  { t: "12:03:11", lvl: "INFO", msg: "/replace request from 284756103 saved" },
  { t: "12:02:55", lvl: "INFO", msg: "Excel file generated for ORD-2846" },
  { t: "12:02:30", lvl: "ERROR", msg: "Telegram API timeout, retrying..." },
  { t: "12:02:33", lvl: "INFO", msg: "Retry success" },
];

function BotControlPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bot Control</h1>
          <p className="text-sm text-muted-foreground">Manage Telegram bot process · Live logs</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm">
          <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
          <span className="font-semibold text-success">Online · pm2 running</span>
        </div>
      </div>

      {/* status cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { icon: Activity, label: "Uptime", value: "12d 4h" },
          { icon: Cpu, label: "CPU", value: "2.4%" },
          { icon: MemoryStick, label: "Memory", value: "184 MB" },
          { icon: Clock, label: "Restarts", value: "3" },
        ].map((s) => (
          <Card key={s.label} className="glass border-white/5 p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/5"><s.icon className="h-5 w-5 text-primary" /></div>
              <div><div className="text-xl font-bold">{s.value}</div><div className="text-xs text-muted-foreground">{s.label}</div></div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="glass border-white/5 p-5">
        <div className="flex items-center gap-2 mb-4"><Bot className="h-4 w-4 text-primary" /><h3 className="font-semibold">Process control</h3></div>
        <div className="flex flex-wrap gap-2">
          <Button className="bg-success/20 text-success hover:bg-success/30"><Play className="mr-2 h-4 w-4" /> Start</Button>
          <Button className="bg-destructive/20 text-destructive hover:bg-destructive/30"><Square className="mr-2 h-4 w-4" /> Stop</Button>
          <Button className="bg-warning/20 text-warning hover:bg-warning/30"><RotateCw className="mr-2 h-4 w-4" /> Restart</Button>
        </div>
      </Card>

      <Card className="glass border-white/5 p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
          <h3 className="font-semibold">Live logs</h3>
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> Streaming
          </span>
        </div>
        <div className="bg-black/30 p-5 font-mono text-xs">
          {logs.map((l, i) => (
            <div key={i} className="flex gap-3 py-1 hover:bg-white/5">
              <span className="text-muted-foreground/70">{l.t}</span>
              <span className={`w-12 font-bold ${
                l.lvl === "ERROR" ? "text-destructive" :
                l.lvl === "WARN" ? "text-warning" :
                "text-info"
              }`}>{l.lvl}</span>
              <span className="text-foreground/90">{l.msg}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
