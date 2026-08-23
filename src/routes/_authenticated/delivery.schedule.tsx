import { useMemo, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ViewMode } from "gantt-task-react";
import { ArrowLeft, Loader2 } from "lucide-react";
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
import { useDeliveriesForSchedule } from "@/features/delivery/hooks/use-deliveries";
import { DeliveryGantt } from "@/features/delivery/components/delivery-gantt";
import {
  DELIVERY_STATUS_COLOR,
  DELIVERY_STATUS_LABEL,
  DELIVERY_STATUS_ORDER,
} from "@/features/delivery/lib/status";
import type { DeliveryStatus } from "@/features/delivery/types";

export const Route = createFileRoute("/_authenticated/delivery/schedule")({
  head: () => ({
    meta: [
      { title: "Jadwal Pengiriman — DSM MOS" },
      {
        name: "description",
        content: "Gantt chart rencana pengiriman internal.",
      },
    ],
  }),
  component: SchedulePage,
});

// Jendela default Gantt: 90 hari ke belakang s/d 180 hari ke depan, supaya
// query tidak fetch seluruh histori pengiriman selamanya. User bisa
// perlebar lewat input Dari/Sampai — itu langsung jadi rentang fetch baru.
function defaultWindow() {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const from = new Date();
  from.setDate(from.getDate() - 90);
  const to = new Date();
  to.setDate(to.getDate() + 180);
  return { from: fmt(from), to: fmt(to) };
}

function SchedulePage() {
  const navigate = useNavigate();
  const [view, setView] = useState<ViewMode>(ViewMode.Week);
  const [customer, setCustomer] = useState<string>("all");
  const [status, setStatus] = useState<DeliveryStatus | "all">("all");
  const [{ from: defaultFrom, to: defaultTo }] = useState(defaultWindow);
  const [from, setFrom] = useState<string>(defaultFrom);
  const [to, setTo] = useState<string>(defaultTo);
  const { data = [], isLoading } = useDeliveriesForSchedule({
    from: from || defaultFrom,
    to: to || defaultTo,
  });

  const customers = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of data) {
      const c = d.sales_order?.customer;
      if (c) map.set(c.id, c.name);
    }
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [data]);

  const filtered = useMemo(() => {
    return data.filter((d) => {
      if (customer !== "all" && d.sales_order?.customer?.id !== customer)
        return false;
      if (status !== "all" && d.status !== status) return false;
      return true;
    });
  }, [data, customer, status]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/delivery">
            <ArrowLeft className="h-4 w-4 mr-1" /> Kembali
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Jadwal Pengiriman</h1>
          <p className="text-sm text-muted-foreground">
            Tampilan Gantt rencana kirim → sampai. Bukan dokumen resmi.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border p-0.5">
          <Button
            size="sm"
            variant={view === ViewMode.Week ? "default" : "ghost"}
            onClick={() => setView(ViewMode.Week)}
          >
            Mingguan
          </Button>
          <Button
            size="sm"
            variant={view === ViewMode.Month ? "default" : "ghost"}
            onClick={() => setView(ViewMode.Month)}
          >
            Bulanan
          </Button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap items-end">
        <div className="min-w-[180px]">
          <div className="text-xs text-muted-foreground mb-1">Customer</div>
          <Select value={customer} onValueChange={setCustomer}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua customer</SelectItem>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[160px]">
          <div className="text-xs text-muted-foreground mb-1">Status</div>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as DeliveryStatus | "all")}
          >
            <SelectTrigger>
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
        <div>
          <div className="text-xs text-muted-foreground mb-1">Dari</div>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">Sampai</div>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
        {DELIVERY_STATUS_ORDER.map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <span
              className="h-3 w-3 rounded-sm"
              style={{ backgroundColor: DELIVERY_STATUS_COLOR[s].bg }}
            />
            {DELIVERY_STATUS_LABEL[s]}
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span
            className="h-3 w-3 rounded-sm"
            style={{ backgroundColor: "hsl(0 84% 60%)" }}
          />
          Terlambat
        </div>
      </div>

      {isLoading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Memuat…
        </Card>
      ) : (
        <DeliveryGantt
          deliveries={filtered}
          viewMode={view}
          onSelect={(d) =>
            navigate({ to: "/delivery/$id", params: { id: d.id } })
          }
        />
      )}
    </div>
  );
}
