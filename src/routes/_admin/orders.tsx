import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Download, ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/_admin/orders")({
  component: OrdersPage,
});

const orders = [
  { id: "ORD-2847", user: "@rakib_bd", product: "FB Ad Account $50", qty: 2, total: 1600, status: "delivered", time: "12 min ago" },
  { id: "ORD-2846", user: "@nadia_vpn", product: "VPN Premium 3 Month", qty: 1, total: 400, status: "delivered", time: "34 min ago" },
  { id: "ORD-2845", user: "@arif_buy", product: "Google Ads Threshold", qty: 1, total: 1800, status: "delivered", time: "1 hour ago" },
  { id: "ORD-2844", user: "@shahin_ad", product: "TikTok Ads Account", qty: 3, total: 3600, status: "delivered", time: "2 hours ago" },
  { id: "ORD-2843", user: "@hasib_pro", product: "VPN Premium 1 Month", qty: 5, total: 750, status: "delivered", time: "3 hours ago" },
];

function OrdersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
        <p className="text-sm text-muted-foreground">All bot purchases · Re-download Excel anytime</p>
      </div>

      <Card className="glass overflow-hidden border-white/5 p-0">
        <table className="w-full">
          <thead className="border-b border-white/5 bg-white/[0.02] text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3">Order ID</th>
              <th className="px-5 py-3">User</th>
              <th className="px-5 py-3">Product</th>
              <th className="px-5 py-3">Qty</th>
              <th className="px-5 py-3">Total</th>
              <th className="px-5 py-3">Time</th>
              <th className="px-5 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                <td className="px-5 py-3"><span className="rounded-md bg-white/5 px-2 py-1 font-mono text-xs">#{o.id}</span></td>
                <td className="px-5 py-3 font-medium">{o.user}</td>
                <td className="px-5 py-3"><div className="flex items-center gap-2"><ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />{o.product}</div></td>
                <td className="px-5 py-3">{o.qty}</td>
                <td className="px-5 py-3 font-semibold">৳{o.total}</td>
                <td className="px-5 py-3 text-xs text-muted-foreground">{o.time}</td>
                <td className="px-5 py-3 text-right">
                  <button className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-primary/15 hover:text-primary hover:border-primary/30">
                    <Download className="h-3 w-3" /> Excel
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
