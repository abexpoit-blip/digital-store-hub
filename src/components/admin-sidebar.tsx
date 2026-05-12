import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, Package, Wallet, RefreshCw,
  ShoppingBag, Megaphone, Bot, ScrollText, LogOut, Sparkles
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Users", url: "/users", icon: Users },
  { title: "Stock", url: "/stock", icon: Package },
  { title: "Deposits", url: "/deposits", icon: Wallet },
  { title: "Orders", url: "/orders", icon: ShoppingBag },
  { title: "Replace Requests", url: "/replace", icon: RefreshCw, badge: 7 },
];
const toolItems = [
  { title: "Broadcast", url: "/broadcast", icon: Megaphone },
  { title: "Bot Control", url: "/bot-control", icon: Bot },
  { title: "Audit Log", url: "/audit", icon: ScrollText },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (s) => s.location.pathname });

  const renderItem = (item: typeof mainItems[number] & { badge?: number }) => {
    const active = path === item.url;
    return (
      <SidebarMenuItem key={item.url}>
        <SidebarMenuButton asChild isActive={active} className="data-[active=true]:bg-primary/15 data-[active=true]:text-primary data-[active=true]:font-medium hover:bg-white/5">
          <Link to={item.url} className="flex items-center gap-3">
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1">{item.title}</span>
                {item.badge && (
                  <span className="rounded-full bg-destructive/20 px-2 py-0.5 text-[10px] font-bold text-destructive">
                    {item.badge}
                  </span>
                )}
              </>
            )}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-white/5">
      <SidebarHeader className="border-b border-white/5 p-4">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[var(--primary-glow)] glow">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold text-gradient">Nexus Admin</span>
              <span className="text-[10px] text-muted-foreground">Digital Store Panel</span>
            </div>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Main</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>{mainItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Tools</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>{toolItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-white/5 p-3">
        <SidebarMenuButton className="hover:bg-destructive/10 hover:text-destructive">
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Logout</span>}
        </SidebarMenuButton>
      </SidebarFooter>
    </Sidebar>
  );
}
