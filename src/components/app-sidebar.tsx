import { Link, useRouterState } from "@tanstack/react-router";
import {
  FileText,
  Ruler,
  Boxes,
  CalendarRange,
  Factory,
  ShieldCheck,
  Truck,
  LayoutDashboard,
  Users,
  Contact,
  UserCog,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useMyRoles } from "@/hooks/use-my-roles";
import type { AppRole } from "@/lib/roles.functions";

type MenuItem = {
  title: string;
  url: string;
  icon: typeof FileText;
  roles: AppRole[];
};

type MenuGroup = {
  label: string | null;
  items: MenuItem[];
};

const ALL_ROLES: AppRole[] = [
  "admin",
  "sales",
  "engineering",
  "material",
  "production_planning",
  "production",
  "qc",
  "delivery",
  "viewer",
];

// Nav labels are Indonesian to match the rest of the UI. Widely-used domain
// terms ("Sales Order", "Engineering", "QC", "Dashboard") are kept as-is.
const groups: MenuGroup[] = [
  {
    label: null,
    items: [
      {
        title: "Dashboard",
        url: "/dashboard",
        icon: LayoutDashboard,
        roles: ALL_ROLES,
      },
    ],
  },
  {
    label: "Penjualan",
    items: [
      {
        title: "Sales Order",
        url: "/sales-orders",
        icon: FileText,
        roles: ["admin", "sales", "viewer"],
      },
      {
        title: "Pelanggan",
        url: "/customers",
        icon: Contact,
        roles: ["admin", "sales"],
      },
    ],
  },
  {
    label: "Engineering",
    items: [
      {
        title: "Engineering Job",
        url: "/engineering",
        icon: Ruler,
        roles: ALL_ROLES,
      },
      {
        title: "Engineering Workload",
        url: "/engineering/workload",
        icon: Ruler,
        roles: ALL_ROLES,
      },
    ],
  },
  {
    label: "Produksi",
    items: [
      {
        title: "Bahan",
        url: "/material",
        icon: Boxes,
        roles: ["admin", "material", "viewer"],
      },
      {
        title: "Perencanaan Produksi",
        url: "/production-planning",
        icon: CalendarRange,
        roles: ["admin", "production_planning"],
      },
      {
        title: "Operator",
        url: "/operators",
        icon: UserCog,
        roles: ["admin", "production_planning"],
      },
      {
        title: "Produksi",
        url: "/production",
        icon: Factory,
        roles: ["admin", "production", "viewer"],
      },
    ],
  },
  {
    label: "QC & Pengiriman",
    items: [
      {
        title: "QC",
        url: "/qc",
        icon: ShieldCheck,
        roles: ["admin", "qc", "viewer"],
      },
      {
        title: "Pengiriman",
        url: "/delivery",
        icon: Truck,
        roles: ["admin", "delivery", "viewer"],
      },
      {
        title: "Jadwal Pengiriman",
        url: "/delivery/schedule",
        icon: CalendarRange,
        roles: ["admin", "delivery", "viewer"],
      },
    ],
  },
  {
    label: "Admin",
    items: [
      { title: "Kelola User", url: "/admin", icon: Users, roles: ["admin"] },
    ],
  },
];

export function AppSidebar() {
  const { hasAnyRole } = useMyRoles();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  const visibleGroups = groups
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => hasAnyRole(i.roles)),
    }))
    .filter((g) => g.items.length > 0);

  // Highlight the deepest matching item so /sales-orders/123 keeps "Sales Order"
  // lit, while /engineering/workload lights "Engineering Workload" (not also
  // "Engineering"). Longest matching url wins.
  const activeUrl = visibleGroups
    .flatMap((g) => g.items)
    .filter((i) => pathname === i.url || pathname.startsWith(i.url + "/"))
    .sort((a, b) => b.url.length - a.url.length)[0]?.url;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="px-2 py-1.5">
          <div className="text-sm font-semibold">DSM MOS</div>
          <div className="text-xs text-muted-foreground">Manufacturing OS</div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {visibleGroups.length === 0 && (
          <div className="px-4 py-2 text-xs text-muted-foreground">
            Belum ada peran yang ditugaskan.
          </div>
        )}
        {visibleGroups.map((group) => (
          <SidebarGroup key={group.label ?? "_"}>
            {group.label && (
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={item.url === activeUrl}
                      tooltip={item.title}
                    >
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
