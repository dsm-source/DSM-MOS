import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Loader2, Plus, Search, CalendarRange } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMyRoles } from "@/hooks/use-my-roles";
import { useDeliveries } from "@/features/delivery/hooks/use-deliveries";
import { DeliveryStatusBadge } from "@/features/delivery/components/delivery-status-badge";
import { CreateDeliveryDialog } from "@/features/delivery/components/create-delivery-dialog";
import { isOverdue } from "@/features/delivery/components/delivery-gantt";
import {
  DELIVERY_STATUS_LABEL,
  DELIVERY_STATUS_ORDER,
} from "@/features/delivery/lib/status";
import type { DeliveryStatus } from "@/features/delivery/types";

export const Route = createFileRoute("/_authenticated/delivery")({
  head: () => ({
    meta: [
      { title: "Rencana Pengiriman — DSM MOS" },
      {
        name: "description",
        content:
          "Daftar rencana pengiriman internal (bukan surat jalan resmi).",
      },
    ],
  }),
  component: DeliveryPage,
});

function DeliveryPage() {
  const { hasAnyRole } = useMyRoles();
  const canWrite = hasAnyRole(["delivery", "admin"]);
  const { data = [], isLoading } = useDeliveries();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<DeliveryStatus | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((d) => {
      if (status !== "all" && d.status !== status) return false;
      if (!q) return true;
      return (
        d.do_number.toLowerCase().includes(q) ||
        (d.sales_order?.so_number ?? "").toLowerCase().includes(q) ||
        (d.sales_order?.customer?.name ?? "").toLowerCase().includes(q) ||
        (d.driver_name ?? "").toLowerCase().includes(q) ||
        (d.vehicle_number ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, search, status]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Rencana Pengiriman</h1>
          <p className="text-sm text-muted-foreground">
            Tracking internal — bukan dokumen surat jalan resmi.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" asChild>
            <Link to="/delivery/schedule">
              <CalendarRange className="h-4 w-4 mr-1.5" />
              Jadwal (Gantt)
            </Link>
          </Button>
          {canWrite && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Rencana Baru
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Cari kode, SO, customer, driver, kendaraan…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as DeliveryStatus | "all")}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua status</SelectItem>
            {DELIVERY_STATUS_ORDER.map((s) => (
              <SelectItem key={s} value={s}>
                {DELIVERY_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Memuat…
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Tidak ada data.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((d) => {
            const overdue = isOverdue(d);
            return (
              <Link key={d.id} to="/delivery/$id" params={{ id: d.id }}>
                <Card className="p-4 space-y-2 hover:border-primary/40 transition-colors h-full">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-sm">{d.do_number}</div>
                      <div className="text-xs text-muted-foreground">
                        SO {d.sales_order?.so_number ?? "?"} ·{" "}
                        {d.sales_order?.customer?.name ?? "-"}
                      </div>
                    </div>
                    <DeliveryStatusBadge status={d.status} overdue={overdue} />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Kirim:{" "}
                    {d.planned_ship_date
                      ? format(new Date(d.planned_ship_date), "d MMM yyyy", {
                          locale: idLocale,
                        })
                      : "-"}
                    {" · "}
                    Sampai:{" "}
                    {d.planned_delivery_date
                      ? format(
                          new Date(d.planned_delivery_date),
                          "d MMM yyyy",
                          {
                            locale: idLocale,
                          },
                        )
                      : "-"}
                  </div>
                  <div className="text-xs">
                    {d.driver_name || d.vehicle_number ? (
                      <>
                        {d.driver_name ?? "-"} · {d.vehicle_number ?? "-"}
                      </>
                    ) : (
                      <span className="text-muted-foreground">
                        Driver/kendaraan belum diisi
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {d.delivery_items?.length ?? 0} item lolos QC
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <CreateDeliveryDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
