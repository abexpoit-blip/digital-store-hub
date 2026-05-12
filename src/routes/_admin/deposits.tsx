import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { recentDeposits } from "@/lib/mock-data";
import { Wallet, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_admin/deposits")({
  component: DepositsPage,
});

const summary = [
  { label: "Today", value: "৳18,450", count: 12, color: "from-violet-500 to-fuchsia-500" },
  { label: "This Week", value: "৳1,14,250", count: 87, color: "from-cyan-500 to-blue-500" },
  { label: "This Month", value: "৳4,87,320", count: 342, color: "from-emerald-500 to-teal-500" },
  { label: "Pending", value: "৳3,400", count: 4, color: "from-amber-500 to-orange-500" },
];

function DepositsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Deposits</h1>
        <p className="text-sm text-muted-foreground">Bkash, Nagad & Binance transactions log</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summary.map((s) => (
          <Card key={s.label} className="glass relative overflow-hidden border-white/5 p-5">
            <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${s.color} opacity-25 blur-2xl`} />
            <div className="relative flex items-center gap-3">
              <div className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${s.color}`}>
                <Wallet className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <div className="text-xl font-bold">{s.value}</div>
                <div className="text-[11px] text-muted-foreground">{s.count} transactions</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex gap-2 text-xs">
        {["All", "Bkash", "Nagad", "Binance", "Pending", "Approved", "Rejected"].map((t, i) => (
          <button key={t} className={`rounded-lg px-3 py-2 ${i === 0 ? "bg-primary/20 text-primary" : "border border-white/10 bg-white/5 text-muted-foreground hover:text-foreground"}`}>{t}</button>
        ))}
      </div>

      <Card className="glass overflow-hidden border-white/5 p-0">
        <table className="w-full">
          <thead className="border-b border-white/5 bg-white/[0.02] text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3">ID</th>
              <th className="px-5 py-3">User</th>
              <th className="px-5 py-3">Amount</th>
              <th className="px-5 py-3">Method</th>
              <th className="px-5 py-3">Transaction</th>
              <th className="px-5 py-3">Time</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {recentDeposits.map((d) => (
              <tr key={d.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                <td className="px-5 py-3 font-mono text-xs text-muted-foreground">#{d.id}</td>
                <td className="px-5 py-3 font-medium">{d.user}</td>
                <td className="px-5 py-3"><span className="flex items-center gap-1 font-bold text-success"><TrendingUp className="h-3 w-3" />৳{d.amount}</span></td>
                <td className="px-5 py-3"><span className="rounded-md bg-white/5 px-2 py-1 text-xs">{d.method}</span></td>
                <td className="px-5 py-3 font-mono text-xs">{d.txn}</td>
                <td className="px-5 py-3 text-xs text-muted-foreground">{d.time}</td>
                <td className="px-5 py-3">
                  <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    d.status === "approved" ? "bg-success/15 text-success" :
                    d.status === "pending" ? "bg-warning/15 text-warning" :
                    "bg-destructive/15 text-destructive"
                  }`}>{d.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
