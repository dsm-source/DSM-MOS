import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Search, AlertCircle, FileText } from "lucide-react";
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useSalesOrders } from "@/features/sales-orders/hooks/use-sales-orders";
import { StatusBadge } from "@/features/sales-orders/components/status-badge";
import {
  SALES_ORDER_STATUSES,
  type SalesOrderStatus,
} from "@/features/sales-orders/types";
import { STATUS_LABEL } from "@/features/sales-orders/lib/status";
import { useMyRoles } from "@/hooks/use-my-roles";

export const Route = createFileRoute("/_authenticated/sales-orders/")({
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
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<SalesOrderStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  // Debounce simple via onBlur/Enter — cukup untuk operator
  const { data, isLoading, isError, error } = useSalesOrders({
    page,
    pageSize: PAGE_SIZE,
    status,
    search: debounced,
  });
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
            className="pl-8"
            placeholder="Cari nomor SO atau customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setPage(1);
                setDebounced(search);
              }
            }}
            onBlur={() => {
              setPage(1);
              setDebounced(search);
            }}
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setPage(1);
            setStatus(v as SalesOrderStatus | "all");
          }}
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

      <div className="rounded-xl border bg-card overflow-x-auto">
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
                      debounced || status !== "all"
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

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {total} data · Halaman {page} dari {pages}
        </div>
        <Pagination className="mx-0 justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setPage((p) => Math.max(1, p - 1));
                }}
                aria-disabled={page <= 1}
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#" isActive>
                {page}
              </PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setPage((p) => Math.min(pages, p + 1));
                }}
                aria-disabled={page >= pages}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
