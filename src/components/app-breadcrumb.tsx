import { Fragment } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const SECTION_LABEL: Record<string, string> = {
  dashboard: "Dashboard",
  "sales-orders": "Sales Order",
  customers: "Pelanggan",
  engineering: "Engineering",
  material: "Bahan",
  "production-planning": "Perencanaan Produksi",
  operators: "Operator",
  production: "Produksi",
  qc: "QC",
  delivery: "Pengiriman",
  admin: "Kelola User",
};

// Known non-dynamic child segments. Anything else in a child position is
// treated as a record id and labelled "Detail".
const SUB_LABEL: Record<string, string> = {
  new: "Baru",
  edit: "Edit",
  workload: "Workload",
  schedule: "Jadwal",
};

type Crumb = { label: string; to: string };

function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return [];

  const [first, ...rest] = segments;
  const crumbs: Crumb[] = [
    { label: SECTION_LABEL[first] ?? first, to: `/${first}` },
  ];

  rest.forEach((seg, i) => {
    crumbs.push({
      label: SUB_LABEL[seg] ?? "Detail",
      to: `/${[first, ...rest.slice(0, i + 1)].join("/")}`,
    });
  });

  return crumbs;
}

export function AppBreadcrumb() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const crumbs = buildCrumbs(pathname);
  if (crumbs.length === 0) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList className="flex-nowrap">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <Fragment key={crumb.to}>
              <BreadcrumbItem className="whitespace-nowrap">
                {isLast ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={crumb.to}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
