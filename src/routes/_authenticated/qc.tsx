import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ErrorNotice } from "@/components/error-notice";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useMyRoles } from "@/hooks/use-my-roles";
import {
  useQcActiveQueue,
  useQcHistory,
} from "@/features/qc/hooks/use-inspections";
import { useOfflineQcQueue } from "@/features/qc/hooks/use-offline-qc-queue";
import { InspectionCard } from "@/features/qc/components/inspection-card";
import { InspectionDialog } from "@/features/qc/components/inspection-dialog";
import { QC_STATUS_LABEL } from "@/features/qc/lib/status";
import { PROCESS_LABEL } from "@/features/production/lib/process";
import type { QcInspectionWithContext } from "@/features/qc/types";

export const Route = createFileRoute("/_authenticated/qc")({
  head: () => ({
    meta: [
      { title: "Quality Control — DSM MOS" },
      {
        name: "description",
        content: "Antrian & riwayat inspeksi mutu batch produksi.",
      },
    ],
  }),
  component: QcPage,
});

// Default rentang riwayat: 90 hari terakhir s/d hari ini (batas atas
// eksklusif = besok, supaya data hari ini ikut). User bisa perlebar lewat
// input "Dari" di tab Riwayat.
function defaultHistoryFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString().slice(0, 10);
}
function tomorrowIso() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function matchesSearch(i: QcInspectionWithContext, q: string) {
  if (!q) return true;
  const step = i.production_batch_step;
  const batch = step?.production_batch;
  const so = batch?.engineering_job?.sales_order_item?.sales_order;
  const item = batch?.engineering_job?.sales_order_item;
  const processLabel = step ? PROCESS_LABEL[step.process] : "";
  return (
    batch?.batch_number.toLowerCase().includes(q) ||
    so?.so_number.toLowerCase().includes(q) ||
    so?.customer?.name.toLowerCase().includes(q) ||
    item?.item_name.toLowerCase().includes(q) ||
    processLabel.toLowerCase().includes(q)
  );
}

function QcPage() {
  const { hasAnyRole } = useMyRoles();
  const canWrite = hasAnyRole(["qc", "admin"]);
  const [historyFrom, setHistoryFrom] = useState(defaultHistoryFrom);
  const {
    data: active = [],
    isLoading: loadingActive,
    isError: activeError,
    error: activeErr,
    refetch: refetchActive,
  } = useQcActiveQueue();
  const {
    data: pastInspections = [],
    isLoading: loadingHistory,
    isError: historyError,
    error: historyErr,
    refetch: refetchHistory,
  } = useQcHistory({ from: historyFrom, toExclusive: tomorrowIso() });
  const { pending, syncing, sync } = useOfflineQcQueue();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const inspections = useMemo(
    () => [...active, ...pastInspections],
    [active, pastInspections],
  );
  const selected = useMemo(
    () =>
      inspections.find((inspection) => inspection.id === selectedId) ?? null,
    [inspections, selectedId],
  );

  const q = search.trim().toLowerCase();
  const queue = useMemo(
    () => active.filter((i) => matchesSearch(i, q)),
    [active, q],
  );
  const history = useMemo(
    () => pastInspections.filter((i) => matchesSearch(i, q)),
    [pastInspections, q],
  );

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <PageHeader
        title="Quality Control"
        description={
          <>
            Antrian inspeksi per tahapan produksi — setiap tahapan batch masuk
            antrian otomatis begitu tahapan tersebut selesai.
            {!canWrite && " Anda hanya bisa melihat (read-only)."}
          </>
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari batch, SO, customer, item, proses..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-11"
        />
      </div>

      {pending > 0 && (
        <div className="flex items-center justify-between gap-3 flex-wrap rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          <span>{pending} data tersimpan lokal, menunggu sinkronisasi</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => sync()}
            disabled={syncing}
            className="min-h-9"
          >
            Coba sinkronkan
          </Button>
        </div>
      )}

      <Tabs defaultValue="queue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="queue">Antrian ({queue.length})</TabsTrigger>
          <TabsTrigger value="history">
            Riwayat Lulus ({history.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="space-y-4">
          {activeError ? (
            <ErrorNotice
              error={activeErr}
              title="Gagal memuat antrian inspeksi"
              onRetry={() => refetchActive()}
            />
          ) : loadingActive ? (
            <Card className="p-8 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </Card>
          ) : queue.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              Antrian kosong. Tahapan produksi yang sudah selesai akan muncul di
              sini untuk diinspeksi QC.
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {queue.map((i) => (
                <InspectionCard
                  key={i.id}
                  inspection={i}
                  onOpen={() => setSelectedId(i.id)}
                />
              ))}
            </div>
          )}
          <div className="text-xs text-muted-foreground pt-2">
            Status:{" "}
            {(["waiting", "inspection", "reject", "rework"] as const)
              .map((s) => QC_STATUS_LABEL[s])
              .join(" · ")}
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">
              Dari tanggal (default 90 hari terakhir):
            </span>
            <Input
              type="date"
              value={historyFrom}
              onChange={(e) => setHistoryFrom(e.target.value)}
              className="w-[160px] h-9"
            />
          </div>
          {historyError ? (
            <ErrorNotice
              error={historyErr}
              title="Gagal memuat riwayat inspeksi"
              onRetry={() => refetchHistory()}
            />
          ) : loadingHistory ? (
            <Card className="p-8 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </Card>
          ) : history.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              Belum ada inspeksi yang lulus.
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {history.map((i) => (
                <InspectionCard
                  key={i.id}
                  inspection={i}
                  onOpen={() => setSelectedId(i.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <InspectionDialog
        inspection={selected}
        open={!!selected}
        onOpenChange={(o) => !o && setSelectedId(null)}
        canWrite={canWrite}
      />
    </div>
  );
}
