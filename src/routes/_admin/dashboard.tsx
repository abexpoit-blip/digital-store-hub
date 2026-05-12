import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Users, Wallet, ShoppingBag, TrendingUp, AlertTriangle, RefreshCw, Activity, ArrowUpRight } from "lucide-react";
import { stats, revenueData, productMix, recentDeposits } from "@/lib/mock-data";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Pie, PieChart, Cell, Legend } from "recharts";

export const Route = createFileRoute("/_admin/dashboard")({
  component: Dashboard,
});

const kpis = [
  { label: "Total Users", value: stats.totalUsers.toLocaleString(), delta: "+12.4%", icon: Users, color: "from-violet-500 to-fuchsia-500" },
  { label: "Today's Deposit", value: `৳${stats.todayDeposit.toLocaleString()}`, delta: "+8.2%", icon: Wallet, color: "from-cyan-500 to-blue-500" },
  { label: "Today's Orders", value: stats.todayOrders.toString(), delta: "+24.1%", icon: ShoppingBag, color: "from-emerald-500 to-teal-500" },
  { label: "Total Revenue", value: `৳${(stats.totalRevenue / 1000).toFixed(1)}K`, delta: "+18.7%", icon: TrendingUp, color: "from-amber-500 to-orange-500" },
];

const alerts = [
  { icon: AlertTriangle, title: `${stats.lowStockItems} products low stock`, sub: "FB Ad $50, Google Ads, VPN 6mo", color: "warning" },
  { icon: RefreshCw, title: `${stats.pendingReplace} replace requests pending`, sub: "Oldest: 23 minutes ago", color: "destructive" },
  { icon: Activity, title: `${stats.activeNow} users active now`, sub: "Live in last 5 minutes", color: "success" },
];

function Dashboard() {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Live overview of your digital store · Updated just now</p>
        </div>
        <div className="glass hidden rounded-lg px-3 py-2 text-xs md:flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
          <span className="text-muted-foreground">Bot online · DB synced</span>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="glass relative overflow-hidden border-white/5 p-5">
            <div className={`absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br ${k.color} opacity-20 blur-2xl`} />
            <div className="relative">
              <div className="flex items-center justify-between">
                <div className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${k.color}`}>
                  <k.icon className="h-5 w-5 text-white" />
                </div>
                <span className="flex items-center gap-1 rounded-md bg-success/15 px-2 py-1 text-[11px] font-semibold text-success">
                  <ArrowUpRight className="h-3 w-3" />{k.delta}
                </span>
              </div>
              <div className="mt-4 text-2xl font-bold">{k.value}</div>
              <div className="text-xs text-muted-foreground">{k.label}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="glass border-white/5 p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Revenue this week</h3>
              <p className="text-xs text-muted-foreground">Last 7 days · BDT</p>
            </div>
            <div className="flex gap-1 rounded-lg bg-white/5 p-1 text-xs">
              <button className="rounded-md bg-primary/20 px-2.5 py-1 text-primary">7D</button>
              <button className="px-2.5 py-1 text-muted-foreground">30D</button>
              <button className="px-2.5 py-1 text-muted-foreground">90D</button>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.72 0.22 295)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="oklch(0.72 0.22 295)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 5%)" />
                <XAxis dataKey="day" stroke="oklch(0.7 0.04 260)" fontSize={11} />
                <YAxis stroke="oklch(0.7 0.04 260)" fontSize={11} />
                <Tooltip contentStyle={{ background: "oklch(0.20 0.04 270 / 95%)", border: "1px solid oklch(1 0 0 / 10%)", borderRadius: 12, fontSize: 12 }} />
                <Area type="monotone" dataKey="revenue" stroke="oklch(0.72 0.22 295)" strokeWidth={2.5} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="glass border-white/5 p-5">
          <h3 className="font-semibold">Product mix</h3>
          <p className="text-xs text-muted-foreground">Sales share this month</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={productMix} dataKey="value" innerRadius={55} outerRadius={85} paddingAngle={3}>
                  {productMix.map((e, i) => <Cell key={i} fill={`var(--color-chart-${i + 1})`} />)}
                </Pie>
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "oklch(0.20 0.04 270 / 95%)", border: "1px solid oklch(1 0 0 / 10%)", borderRadius: 12, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Alerts + Recent deposits */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="glass border-white/5 p-5">
          <h3 className="mb-4 font-semibold">System alerts</h3>
          <div className="space-y-3">
            {alerts.map((a, i) => (
              <div key={i} className="flex gap-3 rounded-xl border border-white/5 bg-white/5 p-3">
                <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-${a.color}/15`}>
                  <a.icon className={`h-4 w-4 text-${a.color}`} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{a.title}</div>
                  <div className="truncate text-xs text-muted-foreground">{a.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="glass border-white/5 p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">Recent deposits</h3>
            <button className="text-xs text-primary hover:underline">View all →</button>
          </div>
          <div className="space-y-2">
            {recentDeposits.slice(0, 5).map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-xs font-semibold text-primary">
                    {d.user.slice(1, 3).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{d.user}</div>
                    <div className="text-[11px] text-muted-foreground">{d.method} · {d.txn}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{d.time}</span>
                  <span className="text-sm font-bold text-success">+৳{d.amount}</span>
                  <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    d.status === "approved" ? "bg-success/15 text-success" :
                    d.status === "pending" ? "bg-warning/15 text-warning" :
                    "bg-destructive/15 text-destructive"
                  }`}>{d.status}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
