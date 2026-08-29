import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Search, AlertCircle, FileText, X } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useSalesOrders } from "@/features/sales-orders/hooks/use-sales-orders";
import { StatusBadge } from "@/features/sales-orders/components/status-badge";
import {
  SALES_ORDER_STATUSES,
  type SalesOrderStatus,
} from "@/features/sales-orders/types";
import { STATUS_LABEL } from "@/features/sales-orders/lib/status";
import { useMyRoles } from "@/hooks/use-my-roles";

type SoSearch = {
  page: number;
  status: SalesOrderStatus | "all";
  q: string;
};

export const Route = createFileRoute("/_authenticated/sales-orders/")({
  validateSearch: (search: Record<string, unknown>): SoSearch => {
    const page = Number(search.page);
    const status = search.status;
    return {
      page: Number.isInteger(page) && page >= 1 ? page : 1,
      status:
        typeof status === "string" &&
        (SALES_ORDER_STATUSES as string[]).includes(status)
          ? (status as SalesOrderStatus)
          : "all",
      q: typeof search.q === "string" ? search.q : "",
    };
  },
  head: () => ({
    meta: [
      { title: "Sales Order — DSM MOS" },
      {
        name: "description",
        content: "Daftar sales order pada DSM Manufacturing Operating System.",
      },
    ],
  }),
  component: SalesOrdersPage,
});

const PAGE_SIZE = 20;

function SalesOrdersPage() {
  const { hasAnyRole } = useMyRoles();
  const canWrite = hasAnyRole(["admin", "sales"]);
  const { page, status, q } = Route.useSearch();
  const navigate = Route.useNavigate();

  // Local input mirror, debounced into the `q` search param.
  const [searchInput, setSearchInput] = useState(q);
  useEffect(() => setSearchInput(q), [q]);
  useEffect(() => {
    if (searchInput === q) return;
    const t = setTimeout(() => {
      navigate({ search: (prev) => ({ ...prev, q: searchInput, page: 1 }) });
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput, q, navigate]);

  const { data, isLoading, isFetching, isError, error } = useSalesOrders({
    page,
    pageSize: PAGE_SIZE,
    status,
    search: q,
  });
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = q !== "" || status !== "all";

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Sales Order"
        description="Kelola pesanan pelanggan."
        actions={
          canWrite && (
            <Button asChild>
              <Link to="/sales-orders/new">
                <Plus className="h-4 w-4 mr-1" /> SO Baru
              </Link>
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8 pr-8"
            placeholder="Cari nomor SO atau customer..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {searchInput && (
            <button
              type="button"
              aria-label="Bersihkan pencarian"
              onClick={() => setSearchInput("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select
          value={status}
          onValueChange={(v) =>
            navigate({
              search: (prev) => ({
                ...prev,
                status: v as SalesOrderStatus | "all",
                page: 1,
              }),
            })
          }
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua status</SelectItem>
            {SALES_ORDER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Gagal memuat data</AlertTitle>
          <AlertDescription>{error?.message}</AlertDescription>
        </Alert>
      )}

      {/* Mobile: stacked cards */}
      <div className="space-y-2 sm:hidden">
        {isLoading &&
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        {!isLoading && data?.rows.length === 0 && (
          <EmptyState
            icon={FileText}
            title="Belum ada sales order"
            description={
              filtered
                ? "Tidak ada SO yang cocok dengan filter."
                : "Buat sales order pertama untuk memulai."
            }
            action={
              canWrite && (
                <Button asChild size="sm">
                  <Link to="/sales-orders/new">
                    <Plus className="h-4 w-4 mr-1" /> SO Baru
                  </Link>
                </Button>
              )
            }
          />
        )}
        {data?.rows.map((so) => (
          <Link
            key={so.id}
            to="/sales-orders/$id"
            params={{ id: so.id }}
            className="block rounded-xl border bg-card p-3 space-y-1.5 hover:border-primary/40"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-sm text-primary">
                {so.so_number}
              </span>
              <StatusBadge status={so.status} />
            </div>
            <div className="text-sm">
              {so.customer ? (
                <>
                  <span className="font-medium">{so.customer.name}</span>{" "}
                  <span className="text-xs text-muted-foreground">
                    ({so.customer.code})
                  </span>
                </>
              ) : (
                "—"
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              Order {so.order_date} · Jatuh tempo {so.due_date ?? "—"} ·{" "}
              {so.item_count} item
            </div>
          </Link>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden sm:block rounded-xl border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. SO</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Tgl Order</TableHead>
              <TableHead>Jatuh Tempo</TableHead>
              <TableHead className="text-center">Item</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && data?.rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="p-0">
                  <EmptyState
                    icon={FileText}
                    title="Belum ada sales order"
                    description={
                      filtered
                        ? "Tidak ada SO yang cocok dengan filter."
                        : "Buat sales order pertama untuk memulai."
                    }
                    action={
                      canWrite && (
                        <Button asChild size="sm">
                          <Link to="/sales-orders/new">
                            <Plus className="h-4 w-4 mr-1" /> SO Baru
                          </Link>
                        </Button>
                      )
                    }
                  />
                </TableCell>
              </TableRow>
            )}
            {data?.rows.map((so) => (
              <TableRow key={so.id} className="hover:bg-muted/40">
                <TableCell className="font-mono">
                  <Link
                    to="/sales-orders/$id"
                    params={{ id: so.id }}
                    className="text-primary hover:underline"
                  >
                    {so.so_number}
                  </Link>
                </TableCell>
                <TableCell>
                  {so.customer ? (
                    <>
                      <span className="font-medium">{so.customer.name}</span>{" "}
                      <span className="text-xs text-muted-foreground">
                        ({so.customer.code})
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>{so.order_date}</TableCell>
                <TableCell>{so.due_date ?? "—"}</TableCell>
                <TableCell className="text-center">{so.item_count}</TableCell>
                <TableCell>
                  <StatusBadge status={so.status} />
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/sales-orders/$id" params={{ id: so.id }}>
                      Detail
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {total} data · Halaman {page} dari {pages}
          {isFetching && !isLoading && " · memuat…"}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() =>
              navigate({
                search: (prev) => ({ ...prev, page: Math.max(1, page - 1) }),
              })
            }
          >
            Sebelumnya
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages}
            onClick={() =>
              navigate({
                search: (prev) => ({
                  ...prev,
                  page: Math.min(pages, page + 1),
                }),
              })
            }
          >
            Berikutnya
          </Button>
        </div>
      </div>
    </div>
  );
}
