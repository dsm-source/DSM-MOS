import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useMyRoles } from "@/hooks/use-my-roles";
import { useQcInspections } from "@/features/qc/hooks/use-inspections";
import { useOfflineQcQueue } from "@/features/qc/hooks/use-offline-qc-queue";
import { InspectionCard } from "@/features/qc/components/inspection-card";
import { InspectionDialog } from "@/features/qc/components/inspection-dialog";
import { QC_STATUS_LABEL } from "@/features/qc/lib/status";
import { PROCESS_LABEL } from "@/features/production/lib/process";

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

function QcPage() {
  const { hasAnyRole } = useMyRoles();
  const canWrite = hasAnyRole(["qc", "admin"]);
  const { data: inspections = [], isLoading } = useQcInspections();
  const { pending, syncing, sync } = useOfflineQcQueue();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () =>
      inspections.find((inspection) => inspection.id === selectedId) ?? null,
    [inspections, selectedId],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return inspections;
    return inspections.filter((i) => {
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
    });
  }, [inspections, search]);

  const queue = filtered.filter(
    (i) =>
      i.status === "waiting" ||
      i.status === "inspection" ||
      i.status === "reject" ||
      i.status === "rework",
  );
  const history = filtered.filter((i) => i.status === "pass");

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold">Quality Control</h1>
        <p className="text-sm text-muted-foreground">
          Antrian inspeksi per tahapan produksi — setiap tahapan batch masuk
          antrian otomatis begitu tahapan tersebut selesai.
          {!canWrite && " Anda hanya bisa melihat (read-only)."}
        </p>
      </div>

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
          {isLoading ? (
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
          {history.length === 0 ? (
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
