import { Link, useRouterState } from "@tanstack/react-router";
import {
  AlertOctagon,
  Boxes,
  Cog,
  Factory,
  Gauge,
  LogOut,
  Package,
  Truck,
  UserCog,
  Users,
  Wrench,
  Layers,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import type { Utilisateur } from "@/lib/api/types";
import { useLogout } from "@/lib/auth";
import { NAV, ROLE_LABELS, navFor, type AppPath, type NavItem } from "@/lib/permissions";

const ICONS: Record<AppPath, LucideIcon> = {
  "/tableau-de-bord": Gauge,
  "/lots": Layers,
  "/incidents": AlertOctagon,
  "/maintenances": Wrench,
  "/ateliers": Factory,
  "/machines": Cog,
  "/operateurs": Users,
  "/produits": Package,
  "/pieces": Boxes,
  "/fournisseurs": Truck,
  "/comptes": UserCog,
};

const GROUP_ORDER: NavItem["group"][] = ["Pilotage", "Production", "Référentiels", "Magasin", "Administration"];

function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { setOpenMobile } = useSidebar();
  return (
    <>
      {GROUP_ORDER.map((group) => {
        const groupItems = items.filter((i) => i.group === group);
        if (groupItems.length === 0) return null;
        return (
          <SidebarGroup key={group}>
            <SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-widest text-sidebar-foreground/50">
              {group}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {groupItems.map((item) => {
                  const Icon = ICONS[item.to];
                  const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                        <Link to={item.to} onClick={() => setOpenMobile(false)}>
                          <Icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        );
      })}
    </>
  );
}

function CurrentTitle() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const item = NAV.find((n) => pathname === n.to || pathname.startsWith(`${n.to}/`));
  return <span className="truncate text-sm font-medium">{item?.label ?? ""}</span>;
}

export function AppShell({ utilisateur, children }: { utilisateur: Utilisateur; children: ReactNode }) {
  const logout = useLogout();
  const items = navFor(utilisateur.role);

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="border-b border-sidebar-border">
          <Link to="/" className="flex items-center gap-2 px-1 py-1.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-sidebar-primary font-display text-sm font-black text-sidebar-primary-foreground">
              T3
            </span>
            <span className="min-w-0 group-data-[collapsible=icon]:hidden">
              <span className="block font-display text-sm font-bold leading-tight text-sidebar-accent-foreground">
                TWIN_3
              </span>
              <span className="block text-[11px] leading-tight text-sidebar-foreground/60">Gestion d'usine</span>
            </span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <NavLinks items={items} />
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border">
          <div className="flex items-center gap-2 px-1 py-1 group-data-[collapsible=icon]:hidden">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold uppercase text-sidebar-accent-foreground">
              {utilisateur.identifiant.slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-sidebar-accent-foreground">
                {utilisateur.identifiant}
              </div>
              <div className="truncate text-[11px] text-sidebar-foreground/60">{ROLE_LABELS[utilisateur.role]}</div>
            </div>
          </div>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={logout} tooltip="Se déconnecter">
                <LogOut />
                <span>Se déconnecter</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0 bg-background">
        <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b border-border bg-background/90 px-3 backdrop-blur md:px-6">
          <SidebarTrigger />
          <div className="h-4 w-px bg-border" />
          <CurrentTitle />
          <div className="ml-auto flex items-center gap-2 md:hidden">
            <Button variant="ghost" size="icon" onClick={logout} aria-label="Se déconnecter">
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
