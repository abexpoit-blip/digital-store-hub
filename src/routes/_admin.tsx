import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin-sidebar";
import { Bell, Search, Shield } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/_admin")({
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AdminSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/5 bg-background/40 px-4 backdrop-blur-xl">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                placeholder="Search users, orders, transactions…"
                className="h-9 w-80 rounded-lg border border-white/5 bg-white/5 pl-9 pr-3 text-sm placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button className="relative grid h-9 w-9 place-items-center rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 transition">
                <Bell className="h-4 w-4" />
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive animate-pulse" />
              </button>
              <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/5 px-3 py-1.5">
                <div className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-primary to-[var(--primary-glow)]">
                  <Shield className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
                <div className="hidden flex-col leading-tight sm:flex">
                  <span className="text-xs font-semibold">Master Admin</span>
                  <span className="text-[10px] text-muted-foreground">owner</span>
                </div>
              </div>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
      <Toaster />
    </SidebarProvider>
  );
}
