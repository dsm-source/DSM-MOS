import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { notifyError } from "@/lib/error-message";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  useDeleteSalesOrder,
  useSalesOrder,
  useTransitionSalesOrder,
} from "@/features/sales-orders/hooks/use-sales-orders";
import { StatusBadge } from "@/features/sales-orders/components/status-badge";
import { SALES_ORDER_STATUSES, type SalesOrderStatus } from "@/features/sales-orders/types";
import { STATUS_LABEL } from "@/features/sales-orders/lib/status";
import { useMyRoles } from "@/hooks/use-my-roles";
import { AssignmentsEditor } from "@/features/sales-orders/components/assignments-editor";

export const Route = createFileRoute("/_authenticated/sales-orders/$id")({
  head: () => ({ meta: [{ title: "Detail SO — DSM MOS" }] }),
  component: SalesOrderDetailPage,
});

function SalesOrderDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useSalesOrder(id);
  const transition = useTransitionSalesOrder();
  const del = useDeleteSalesOrder();
  const { hasAnyRole } = useMyRoles();
  const canWrite = hasAnyRole(["admin", "sales"]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="p-6">
        <p>SO tidak ditemukan.</p>
      </div>
    );
  }

  const items = data.items ?? [];
  const isTerminal = data.status === "completed" || data.status === "cancelled";

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate({ to: "/sales-orders" })}
            aria-label="Kembali"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold font-mono">{data.so_number}</h1>
              <StatusBadge status={data.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {data.customer?.name} <span className="text-xs">({data.customer?.code})</span>
            </p>
          </div>
        </div>
        {canWrite && !isTerminal && (
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link to="/sales-orders/$id/edit" params={{ id: data.id }}>
                <Pencil className="h-4 w-4 mr-1" /> Edit
              </Link>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline">
                  <Trash2 className="h-4 w-4 mr-1" /> Hapus
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Hapus Sales Order?</AlertDialogTitle>
                  <AlertDialogDescription>
                    SO {data.so_number} akan disembunyikan.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Batal</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      try {
                        await del.mutateAsync(data.id);
                        toast.success("SO dihapus");
                        navigate({ to: "/sales-orders" });
                      } catch (e) {
                        notifyError(e);
                      }
                    }}
                  >
                    Hapus
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <InfoCard label="Tanggal Order" value={data.order_date} />
        <InfoCard label="Jatuh Tempo" value={data.due_date ?? "—"} />
        <InfoCard label="Catatan" value={data.notes || "—"} />
      </div>

      {canWrite && !isTerminal && (
        <div className="rounded-xl border p-4 flex items-center gap-3 flex-wrap">
          <div className="text-sm font-medium">Ubah status:</div>
          <Select
            onValueChange={async (v) => {
              try {
                await transition.mutateAsync({ id: data.id, next: v as SalesOrderStatus });
                toast.success(`Status diubah ke ${STATUS_LABEL[v as SalesOrderStatus]}`);
              } catch (e) {
                notifyError(e);
              }
            }}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Pilih status baru" />
            </SelectTrigger>
            <SelectContent>
              {SALES_ORDER_STATUSES.filter((s) => s !== data.status).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Database akan menolak transisi yang tidak sah.
          </p>
        </div>
      )}

      <AssignmentsEditor salesOrderId={data.id} canWrite={canWrite} />

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Item ({items.length})</h2>
        <div className="rounded-xl border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Item</TableHead>
                <TableHead>No. Gambar</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Satuan</TableHead>
                <TableHead>Spesifikasi Material</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    Belum ada item.
                  </TableCell>
                </TableRow>
              )}
              {items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="font-medium">{it.item_name}</TableCell>
                  <TableCell>{it.drawing_number ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono">{it.quantity}</TableCell>
                  <TableCell>{it.unit}</TableCell>
                  <TableCell>{it.material_spec ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium mt-1 break-words">{value}</div>
    </div>
  );
}
