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

const items: MenuItem[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
    roles: [
      "admin",
      "sales",
      "engineering",
      "material",
      "production_planning",
      "production",
      "qc",
      "delivery",
      "viewer",
    ],
  },
  {
    title: "Sales Order",
    url: "/sales-orders",
    icon: FileText,
    roles: ["admin", "sales", "viewer"],
  },
  {
    title: "Customers",
    url: "/customers",
    icon: Contact,
    roles: ["admin", "sales"],
  },
  {
    title: "Engineering",
    url: "/engineering",
    icon: Ruler,
    roles: [
      "admin",
      "sales",
      "engineering",
      "material",
      "production_planning",
      "production",
      "qc",
      "delivery",
      "viewer",
    ],
  },
  {
    title: "Engineering Workload",
    url: "/engineering/workload",
    icon: Ruler,
    roles: [
      "admin",
      "sales",
      "engineering",
      "material",
      "production_planning",
      "production",
      "qc",
      "delivery",
      "viewer",
    ],
  },
  {
    title: "Material",
    url: "/material",
    icon: Boxes,
    roles: ["admin", "material", "viewer"],
  },
  {
    title: "Production Planning",
    url: "/production-planning",
    icon: CalendarRange,
    roles: ["admin", "production_planning"],
  },
  {
    title: "Operators",
    url: "/operators",
    icon: UserCog,
    roles: ["admin", "production_planning"],
  },
  {
    title: "Production",
    url: "/production",
    icon: Factory,
    roles: ["admin", "production", "viewer"],
  },
  {
    title: "QC",
    url: "/qc",
    icon: ShieldCheck,
    roles: ["admin", "qc", "viewer"],
  },
  {
    title: "Delivery",
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
  { title: "Kelola User", url: "/admin", icon: Users, roles: ["admin"] },
];

export function AppSidebar() {
  const { hasAnyRole } = useMyRoles();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const visible = items.filter((i) => hasAnyRole(i.roles));

  // Highlight the deepest matching item so /sales-orders/123 keeps "Sales Order"
  // lit, while /engineering/workload lights "Engineering Workload" (not also
  // "Engineering"). Longest matching url wins.
  const activeUrl = visible
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
        <SidebarGroup>
          <SidebarGroupLabel>Modul</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visible.length === 0 && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  Belum ada peran yang ditugaskan.
                </div>
              )}
              {visible.map((item) => {
                const active = item.url === activeUrl;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                    >
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
