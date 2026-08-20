import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Factory } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { useMyRoles } from "@/hooks/use-my-roles";
import {
  useProductionBatches,
  type BatchWithContext,
} from "@/features/production/hooks/use-batches";
import { PRODUCTION_PROCESSES } from "@/features/production/types";
import { KanbanBoard } from "@/features/production/components/kanban-board";
import { BatchDetailDrawer } from "@/features/production/components/batch-detail-drawer";

export const Route = createFileRoute("/_authenticated/production")({
  head: () => ({
    meta: [
      { title: "Production — DSM MOS" },
      {
        name: "description",
        content: "Papan produksi shop floor: Kanban per batch.",
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

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {PRODUCTION_PROCESSES.map((p) => (
            <Skeleton key={p} className="h-64" />
          ))}
        </div>
      ) : (
        <KanbanBoard
          batches={batches}
          canWrite={canWrite}
          onOpenDetail={setOpenBatch}
        />
      )}

      <BatchDetailDrawer
        batch={openBatch}
        onClose={() => setOpenBatch(null)}
        canWrite={canWrite}
      />
    </div>
  );
}
