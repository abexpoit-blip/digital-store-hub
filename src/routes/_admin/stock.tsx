import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Upload, FileSpreadsheet, Package, AlertTriangle, Download } from "lucide-react";
import { stockItems } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export const Route = createFileRoute("/_admin/stock")({
  component: StockPage,
});

function StockPage() {
  const [drag, setDrag] = useState(false);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Stock Management</h1>
        <p className="text-sm text-muted-foreground">Bulk upload VPN & Ad accounts via Excel · Inventory live</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={() => setDrag(false)}
          className={`glass border-2 border-dashed border-white/10 p-8 text-center transition lg:col-span-2 ${drag ? "border-primary/60 bg-primary/5" : ""}`}
        >
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-primary to-[var(--primary-glow)] glow">
            <Upload className="h-7 w-7 text-primary-foreground" />
          </div>
          <h3 className="text-lg font-semibold">Drop Excel file here</h3>
          <p className="mt-1 text-sm text-muted-foreground">Supports .xlsx and .csv · Max 10,000 rows</p>
          <div className="mt-5 flex justify-center gap-2">
            <Button className="bg-gradient-to-r from-primary to-[var(--primary-glow)] text-primary-foreground glow">
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Choose File
            </Button>
            <Button variant="outline" className="border-white/10 bg-white/5">
              <Download className="mr-2 h-4 w-4" /> Template
            </Button>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3 text-left text-xs">
            <div className="rounded-lg bg-white/5 p-3">
              <div className="text-muted-foreground">Step 1</div>
              <div className="mt-1 font-medium">Download template</div>
            </div>
            <div className="rounded-lg bg-white/5 p-3">
              <div className="text-muted-foreground">Step 2</div>
              <div className="mt-1 font-medium">Fill product · email · pass</div>
            </div>
            <div className="rounded-lg bg-white/5 p-3">
              <div className="text-muted-foreground">Step 3</div>
              <div className="mt-1 font-medium">Preview & confirm</div>
            </div>
          </div>
        </Card>

        <Card className="glass border-white/5 p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-warning/15">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <h3 className="font-semibold">Low stock alerts</h3>
              <p className="text-xs text-muted-foreground">3 products need refill</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {stockItems.filter(s => s.available < 10).map((s) => (
              <div key={s.product} className="rounded-lg border border-warning/20 bg-warning/5 p-3">
                <div className="text-sm font-medium">{s.product}</div>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="text-warning">Only {s.available} left</span>
                  <span className="text-muted-foreground">৳{s.price}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="glass overflow-hidden border-white/5 p-0">
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <h3 className="font-semibold">Current inventory</h3>
          </div>
          <span className="text-xs text-muted-foreground">{stockItems.length} products</span>
        </div>
        <table className="w-full">
          <thead className="bg-white/[0.02] text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3">Product</th>
              <th className="px-5 py-3">Available</th>
              <th className="px-5 py-3">Sold</th>
              <th className="px-5 py-3">Price</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {stockItems.map((s) => {
              const total = s.available + s.sold;
              const pct = (s.sold / total) * 100;
              return (
                <tr key={s.product} className="border-t border-white/5 hover:bg-white/[0.03]">
                  <td className="px-5 py-4 font-medium">{s.product}</td>
                  <td className="px-5 py-4">
                    <span className={s.available < 10 ? "font-bold text-warning" : ""}>{s.available}</span>
                  </td>
                  <td className="px-5 py-4 text-muted-foreground">{s.sold}</td>
                  <td className="px-5 py-4 font-semibold">৳{s.price}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 w-32 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-gradient-to-r from-primary to-[var(--primary-glow)]" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{pct.toFixed(0)}% sold</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
