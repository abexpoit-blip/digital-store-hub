import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Search, Filter, MoreVertical, Pencil, Ban, Wallet } from "lucide-react";
import { recentUsers } from "@/lib/mock-data";

export const Route = createFileRoute("/_admin/users")({
  component: UsersPage,
});

function UsersPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">2,847 total · 142 active now · 18 banned</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input placeholder="Search by @username or TG ID…" className="h-10 w-72 rounded-lg border border-white/10 bg-white/5 pl-9 pr-3 text-sm focus:border-primary/50 focus:outline-none" />
          </div>
          <button className="flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-sm hover:bg-white/10">
            <Filter className="h-4 w-4" /> Filter
          </button>
        </div>
      </div>

      <Card className="glass overflow-hidden border-white/5 p-0">
        <table className="w-full">
          <thead className="border-b border-white/5 bg-white/[0.02] text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3">User</th>
              <th className="px-5 py-3">TG ID</th>
              <th className="px-5 py-3">Balance</th>
              <th className="px-5 py-3">Orders</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Joined</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {recentUsers.map((u) => (
              <tr key={u.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-primary/30 to-accent/30 text-xs font-bold">
                      {u.username.slice(1, 3).toUpperCase()}
                    </div>
                    <span className="font-medium">{u.username}</span>
                  </div>
                </td>
                <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{u.tg_id}</td>
                <td className="px-5 py-3 font-semibold">৳{u.balance.toLocaleString()}</td>
                <td className="px-5 py-3">{u.orders}</td>
                <td className="px-5 py-3">
                  <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    u.status === "vip" ? "bg-amber-500/15 text-amber-400" :
                    u.status === "banned" ? "bg-destructive/15 text-destructive" :
                    "bg-success/15 text-success"
                  }`}>{u.status}</span>
                </td>
                <td className="px-5 py-3 text-xs text-muted-foreground">{u.joined}</td>
                <td className="px-5 py-3">
                  <div className="flex justify-end gap-1">
                    <button className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/10" title="Adjust balance"><Wallet className="h-3.5 w-3.5" /></button>
                    <button className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/10" title="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                    <button className="grid h-8 w-8 place-items-center rounded-lg hover:bg-destructive/15 hover:text-destructive" title="Ban"><Ban className="h-3.5 w-3.5" /></button>
                    <button className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/10"><MoreVertical className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
