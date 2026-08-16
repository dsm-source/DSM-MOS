import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Factory, Lock, CheckCircle2, LayoutGrid } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyRoles } from "@/hooks/use-my-roles";
import {
  useProductionBatches,
  type BatchWithContext,
} from "@/features/production/hooks/use-batches";
import {
  PRODUCTION_PROCESSES,
  type ProductionProcess,
  type ProductionStepStatus,
} from "@/features/production/types";
import { PROCESS_LABEL } from "@/features/production/lib/process";
import {
  activeStep,
  isBatchDone,
} from "@/features/production/lib/batch-progress";
import { computeStartBlocker } from "@/features/production/lib/start-blocker";
import { BatchCard } from "@/features/production/components/batch-card";
import { StationStepCard } from "@/features/production/components/station-step-card";
import { BatchDetailDrawer } from "@/features/production/components/batch-detail-drawer";

export const Route = createFileRoute("/_authenticated/production")({
  head: () => ({
    meta: [
      { title: "Production — DSM MOS" },
      {
        name: "description",
        content:
          "Papan produksi shop floor: per batch (supervisor) dan per stasiun (operator).",
      },
      { property: "og:title", content: "Production — DSM MOS" },
      {
        property: "og:description",
        content: "Papan produksi shop floor DSM MOS.",
      },
    ],
  }),
  component: ProductionPage,
});

function ProductionPage() {
  const { hasAnyRole } = useMyRoles();
  const canWrite = hasAnyRole(["admin", "production"]);
  const { data: batches = [], isLoading } = useProductionBatches();
  const [openBatch, setOpenBatch] = useState<BatchWithContext | null>(null);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Factory className="h-5 w-5" />
        <div>
          <h1 className="text-2xl font-semibold">Production</h1>
          <p className="text-sm text-muted-foreground">
            Kelola eksekusi batch di shop floor. Batch dibuat oleh Production
            Planning.
          </p>
        </div>
      </div>

      <Tabs defaultValue="batch" className="space-y-4">
        <TabsList>
          <TabsTrigger value="batch">Per Batch (Supervisor)</TabsTrigger>
          <TabsTrigger value="station">Per Stasiun (Operator)</TabsTrigger>
        </TabsList>

        <TabsContent value="batch">
          {isLoading ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {PRODUCTION_PROCESSES.map((p) => (
                <Skeleton key={p} className="h-64" />
              ))}
            </div>
          ) : (
            <BatchBoard batches={batches} onOpen={setOpenBatch} />
          )}
        </TabsContent>

        <TabsContent value="station">
          <StationBoard
            batches={batches}
            canWrite={canWrite}
            isLoading={isLoading}
          />
        </TabsContent>
      </Tabs>

      <BatchDetailDrawer
        batch={openBatch}
        onClose={() => setOpenBatch(null)}
        canWrite={canWrite}
      />
    </div>
  );
}

type BatchFilter = "all" | "ready" | "blocked";

function BatchBoard({
  batches,
  onOpen,
}: {
  batches: BatchWithContext[];
  onOpen: (b: BatchWithContext) => void;
}) {
  const [filter, setFilter] = useState<BatchFilter>("all");

  const grouped = useMemo(() => {
    const map = new Map<ProductionProcess, BatchWithContext[]>();
    PRODUCTION_PROCESSES.forEach((p) => map.set(p, []));
    const done: BatchWithContext[] = [];
    const blocked: BatchWithContext[] = [];
    for (const b of batches) {
      if (isBatchDone(b.steps)) {
        done.push(b);
        continue;
      }
      const a = activeStep(b.steps);
      if (!a) continue;
      if (a.status === "waiting" && computeStartBlocker(a, b)) {
        blocked.push(b);
        continue;
      }
      map.get(a.process)?.push(b);
    }
    return { map, done, blocked };
  }, [batches]);

  const readyCount = useMemo(
    () =>
      Array.from(grouped.map.values()).reduce((n, arr) => n + arr.length, 0),
    [grouped.map],
  );

  const showBlocked = filter !== "ready";
  const showReady = filter !== "blocked";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="text-sm text-muted-foreground">Tampilkan:</div>
        <ToggleGroup
          type="single"
          value={filter}
          onValueChange={(v) => v && setFilter(v as BatchFilter)}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="all" aria-label="Semua batch">
            <LayoutGrid className="h-4 w-4 mr-1.5" />
            Semua ({grouped.blocked.length + readyCount})
          </ToggleGroupItem>
          <ToggleGroupItem value="ready" aria-label="Hanya siap diproses">
            <CheckCircle2 className="h-4 w-4 mr-1.5" />
            Siap Diproses ({readyCount})
          </ToggleGroupItem>
          <ToggleGroupItem value="blocked" aria-label="Hanya terblokir">
            <Lock className="h-4 w-4 mr-1.5" />
            Terblokir ({grouped.blocked.length})
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {showBlocked && grouped.blocked.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-3">
          <div className="flex items-center gap-2 mb-2 text-amber-900 dark:text-amber-100">
            <Lock className="h-4 w-4" />
            <div className="text-sm font-semibold">
              Terblokir — menunggu Engineering / Material (
              {grouped.blocked.length})
            </div>
          </div>
          <p className="text-xs text-amber-800 dark:text-amber-200 mb-2">
            Batch di bawah belum boleh mulai diproses. Tahapan pertama hanya
            bisa <em>Start</em> saat Engineering <strong>approved</strong> dan
            Material <strong>material_ready</strong>.
          </p>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {grouped.blocked.map((b) => (
              <BatchCard key={b.id} batch={b} onOpen={() => onOpen(b)} />
            ))}
          </div>
        </div>
      )}

      {showBlocked && filter === "blocked" && grouped.blocked.length === 0 && (
        <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
          Tidak ada batch terblokir.
        </div>
      )}

      {showReady && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {PRODUCTION_PROCESSES.map((p) => {
            const items = grouped.map.get(p) ?? [];
            return (
              <div
                key={p}
                className="rounded-xl border bg-muted/30 p-3 space-y-3 min-h-[200px]"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">
                    {PROCESS_LABEL[p]}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {items.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {items.length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-6">
                      Kosong
                    </div>
                  )}
                  {items.map((b) => (
                    <BatchCard key={b.id} batch={b} onOpen={() => onOpen(b)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {filter === "all" && grouped.done.length > 0 && (
        <div className="rounded-xl border p-3">
          <div className="text-sm font-semibold mb-2">
            Batch Selesai ({grouped.done.length})
          </div>
          <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-5">
            {grouped.done.map((b) => (
              <BatchCard key={b.id} batch={b} onOpen={() => onOpen(b)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StationBoard({
  batches,
  canWrite,
  isLoading,
}: {
  batches: BatchWithContext[];
  canWrite: boolean;
  isLoading: boolean;
}) {
  const [station, setStation] = useState<ProductionProcess>("laser_cutting");

  const columns: {
    key: ProductionStepStatus;
    label: string;
    test: (s: ProductionStepStatus) => boolean;
  }[] = [
    {
      key: "waiting",
      label: "Waiting",
      test: (s) => s === "waiting" || s === "paused",
    },
    { key: "running", label: "Running", test: (s) => s === "running" },
    {
      key: "completed",
      label: "Completed",
      test: (s) => s === "completed" || s === "skipped",
    },
  ];

  const stepsForStation = useMemo(() => {
    return batches.flatMap((b) =>
      b.steps
        .filter((s) => s.process === station)
        .map((s) => ({ step: s, batch: b })),
    );
  }, [batches, station]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="text-sm text-muted-foreground">Stasiun:</div>
        <Select
          value={station}
          onValueChange={(v) => setStation(v as ProductionProcess)}
        >
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRODUCTION_PROCESSES.map((p) => (
              <SelectItem key={p} value={p}>
                {PROCESS_LABEL[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-3">
          {columns.map((c) => (
            <Skeleton key={c.key} className="h-64" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {columns.map((col) => {
            const items = stepsForStation.filter((x) =>
              col.test(x.step.status),
            );
            return (
              <div
                key={col.key}
                className="rounded-xl border bg-muted/30 p-3 space-y-3 min-h-[200px]"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">{col.label}</div>
                  <span className="text-xs text-muted-foreground">
                    {items.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {items.length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-6">
                      Kosong
                    </div>
                  )}
                  {items.map(({ step, batch }) => (
                    <StationStepCard
                      key={step.id}
                      step={step}
                      batch={batch}
                      canWrite={canWrite}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
