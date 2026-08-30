import { useState } from "react";
import { notifyError } from "@/lib/error-message";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
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
import { useMyRoles } from "@/hooks/use-my-roles";
import {
  useAddDeliveryItem,
  useDelivery,
  useDeleteDelivery,
  useEligibleQcInspections,
  useRemoveDeliveryItem,
  useUpdateDelivery,
} from "@/features/delivery/hooks/use-deliveries";
import { DeliveryStatusBadge } from "@/features/delivery/components/delivery-status-badge";
import { isOverdue } from "@/features/delivery/lib/is-overdue";
import { DELIVERY_STATUS_LABEL } from "@/features/delivery/lib/status";
import type { DeliveryStatus } from "@/features/delivery/types";

export const Route = createFileRoute("/_authenticated/delivery/$id")({
  head: () => ({ meta: [{ title: "Detail Pengiriman — DSM MOS" }] }),
  component: DeliveryDetail,
});

function nextTransitions(s: DeliveryStatus): DeliveryStatus[] {
  switch (s) {
    case "draft":
      return ["prepared"];
    case "prepared":
      return ["shipped", "draft"];
    case "shipped":
      return ["delivered"];
    case "delivered":
      return [];
  }
}

function DeliveryDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { hasAnyRole } = useMyRoles();
  const canWrite = hasAnyRole(["delivery", "admin"]);
  const canDelete = hasAnyRole(["admin"]);

  const { data: d, isLoading } = useDelivery(id);
  const update = useUpdateDelivery();
  const del = useDeleteDelivery();
  const addItem = useAddDeliveryItem();
  const removeItem = useRemoveDeliveryItem();
  const { data: eligible = [] } = useEligibleQcInspections(d?.sales_order_id);

  const [shipDate, setShipDate] = useState<string>("");
  const [delivDate, setDelivDate] = useState<string>("");
  const [driver, setDriver] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [initialized, setInitialized] = useState(false);

  const [pickQc, setPickQc] = useState<string>("");
  const [qty, setQty] = useState<string>("");

  if (isLoading) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Memuat…
      </div>
    );
  }
  if (!d) {
    return (
      <div className="p-6 text-muted-foreground">
        Pengiriman tidak ditemukan.
      </div>
    );
  }

  if (!initialized) {
    setShipDate(d.planned_ship_date ?? "");
    setDelivDate(d.planned_delivery_date ?? "");
    setDriver(d.driver_name ?? "");
    setVehicle(d.vehicle_number ?? "");
    setReceivedBy(d.received_by ?? "");
    setNotes(d.notes ?? "");
    setInitialized(true);
  }

  const readOnly = !canWrite || d.status === "delivered";
  const overdue = isOverdue(d);
  const nextOpts = nextTransitions(d.status);

  async function save() {
    if (shipDate && delivDate && delivDate < shipDate) {
      toast.error("Data belum valid", {
        description: "Jadwal sampai tidak boleh sebelum jadwal kirim.",
      });
      return;
    }
    try {
      await update.mutateAsync({
        id: d!.id,
        planned_ship_date: shipDate || null,
        planned_delivery_date: delivDate || null,
        driver_name: driver.trim() || null,
        vehicle_number: vehicle.trim() || null,
        received_by: receivedBy.trim() || null,
        notes: notes.trim() || null,
      });
      toast.success("Perubahan disimpan");
    } catch (e) {
      notifyError(e);
    }
  }

  async function transition(next: DeliveryStatus) {
    try {
      // Save latest form values first so trigger sees fresh planned dates.
      await update.mutateAsync({
        id: d!.id,
        status: next,
        planned_ship_date: shipDate || null,
        planned_delivery_date: delivDate || null,
        driver_name: driver.trim() || null,
        vehicle_number: vehicle.trim() || null,
        received_by: receivedBy.trim() || null,
        notes: notes.trim() || null,
      });
      toast.success(`Status → ${DELIVERY_STATUS_LABEL[next]}`);
    } catch (e) {
      notifyError(e);
    }
  }

  async function addItemSubmit() {
    if (!pickQc) {
      toast.error("Data belum valid", {
        description: "Pilih hasil QC yang lolos.",
      });
      return;
    }
    const n = Number(qty);
    if (!n || n <= 0) {
      toast.error("Data belum valid", { description: "Isi jumlah > 0." });
      return;
    }
    try {
      await addItem.mutateAsync({
        delivery_id: d!.id,
        qc_inspection_id: pickQc,
        quantity: n,
      });
      toast.success("Item ditambahkan");
      setPickQc("");
      setQty("");
    } catch (e) {
      notifyError(e);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <PageHeader
        backTo="/delivery"
        title={d.do_number}
        titleSuffix={
          <DeliveryStatusBadge status={d.status} overdue={overdue} />
        }
        description={
          <>
            SO {d.sales_order?.so_number} ·{" "}
            {d.sales_order?.customer?.name ?? "-"} · Dibuat{" "}
            {format(new Date(d.created_at), "d MMM yyyy HH:mm", {
              locale: idLocale,
            })}
            <br />
            Kode referensi internal — bukan dokumen surat jalan resmi.
          </>
        }
        actions={
          <>
            {canWrite &&
              !readOnly &&
              nextOpts.map((n) => (
                <Button
                  key={n}
                  variant={n === "draft" ? "outline" : "default"}
                  className={
                    n === "delivered"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : undefined
                  }
                  onClick={() => transition(n)}
                  disabled={update.isPending}
                >
                  {n === "draft"
                    ? "Kembalikan ke Draft"
                    : `→ ${DELIVERY_STATUS_LABEL[n]}`}
                </Button>
              ))}
            {canDelete && d.status === "draft" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="h-4 w-4 mr-1.5" /> Hapus
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Hapus rencana pengiriman?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Tindakan ini tidak bisa dibatalkan.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        try {
                          await del.mutateAsync(d.id);
                          toast.success("Dihapus");
                          navigate({ to: "/delivery" });
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
            )}
          </>
        }
      />

      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ship">Jadwal kirim</Label>
            <Input
              id="ship"
              type="date"
              disabled={readOnly}
              value={shipDate}
              onChange={(e) => setShipDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="deliv">Jadwal sampai</Label>
            <Input
              id="deliv"
              type="date"
              disabled={readOnly}
              value={delivDate}
              min={shipDate || undefined}
              onChange={(e) => setDelivDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="driver">Driver</Label>
            <Input
              id="driver"
              disabled={readOnly}
              value={driver}
              onChange={(e) => setDriver(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="veh">Nomor kendaraan</Label>
            <Input
              id="veh"
              disabled={readOnly}
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="recv">Penerima</Label>
            <Input
              id="recv"
              disabled={readOnly}
              value={receivedBy}
              onChange={(e) => setReceivedBy(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Timestamp</Label>
            <div className="text-xs text-muted-foreground space-y-0.5 pt-2">
              <div>
                Disiapkan:{" "}
                {d.prepared_at
                  ? format(new Date(d.prepared_at), "d MMM yyyy HH:mm", {
                      locale: idLocale,
                    })
                  : "-"}
              </div>
              <div>
                Dikirim:{" "}
                {d.shipped_at
                  ? format(new Date(d.shipped_at), "d MMM yyyy HH:mm", {
                      locale: idLocale,
                    })
                  : "-"}
              </div>
              <div>
                Terkirim:{" "}
                {d.delivered_at
                  ? format(new Date(d.delivered_at), "d MMM yyyy HH:mm", {
                      locale: idLocale,
                    })
                  : "-"}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes">Catatan</Label>
          <Textarea
            id="notes"
            rows={3}
            disabled={readOnly}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {canWrite && !readOnly && (
          <div className="flex justify-end">
            <Button onClick={save} disabled={update.isPending}>
              Simpan Perubahan
            </Button>
          </div>
        )}
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-medium">Item Pengiriman</h2>
            <p className="text-xs text-muted-foreground">
              Hanya hasil QC berstatus Lulus dari SO ini yang bisa ditambahkan.
            </p>
          </div>
        </div>

        {(d.delivery_items ?? []).length === 0 ? (
          <div className="text-sm text-muted-foreground">Belum ada item.</div>
        ) : (
          <div className="divide-y rounded-xl border">
            {(d.delivery_items ?? []).map((it) => {
              const meta = eligible.find((e) => e.id === it.qc_inspection_id);
              return (
                <div
                  key={it.id}
                  className="flex items-center justify-between p-3 gap-3"
                >
                  <div className="text-sm">
                    <div className="font-medium">
                      {meta?.item_name ?? "Item"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Batch: {meta?.batch_number ?? "-"} · Qty:{" "}
                      {Number(it.quantity)}
                    </div>
                  </div>
                  {canWrite && d.status === "draft" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Hapus item"
                      onClick={async () => {
                        try {
                          await removeItem.mutateAsync({
                            id: it.id,
                            delivery_id: d.id,
                          });
                        } catch (e) {
                          notifyError(e);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {canWrite && d.status === "draft" && (
          <>
            <Separator />
            <div className="grid grid-cols-1 md:grid-cols-[1fr_140px_auto] gap-2">
              <Select value={pickQc} onValueChange={setPickQc}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih hasil QC (Lulus)" />
                </SelectTrigger>
                <SelectContent>
                  {eligible.filter((e) => !e.already_used).length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      Tidak ada hasil QC lulus yang tersedia.
                    </div>
                  )}
                  {eligible
                    .filter((e) => !e.already_used)
                    .map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.item_name} · {e.batch_number} · OK {e.qty_ok}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={0.0001}
                step="any"
                placeholder="Jumlah"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
              <Button onClick={addItemSubmit} disabled={addItem.isPending}>
                <Plus className="h-4 w-4 mr-1" /> Tambah
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
