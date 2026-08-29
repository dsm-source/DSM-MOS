import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorNotice } from "@/components/error-notice";
import { useMyRoles } from "@/hooks/use-my-roles";
import {
  useProductionBatches,
  type BatchWithContext,
} from "@/features/production/hooks/use-batches";
import {
  ProductionBoard,
  type BoardFilters,
} from "@/features/production/components/production-board";
import { BatchDetailDrawer } from "@/features/production/components/batch-detail-drawer";

type ProdSearch = BoardFilters;

export const Route = createFileRoute("/_authenticated/production")({
  validateSearch: (search: Record<string, unknown>): ProdSearch => ({
    q: typeof search.q === "string" ? search.q : "",
    customer: typeof search.customer === "string" ? search.customer : "all",
    so: typeof search.so === "string" ? search.so : "all",
    blocked: search.blocked === true || search.blocked === "true",
    due: search.due === true || search.due === "true",
  }),
  head: () => ({
    meta: [
      { title: "Production — DSM MOS" },
      {
        name: "description",
        content: "Papan kontrol produksi shop floor: kolom per proses.",
      },
      { property: "og:title", content: "Production — DSM MOS" },
      {
        property: "og:description",
        content: "Papan kontrol produksi shop floor DSM MOS.",
      },
    ],
  }),
  component: ProductionPage,
});

function ProductionPage() {
  const { hasAnyRole } = useMyRoles();
  const canWrite = hasAnyRole(["admin", "production"]);
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const {
    data: batches = [],
    isLoading,
    isError,
    error,
  } = useProductionBatches();
  const [openBatch, setOpenBatch] = useState<BatchWithContext | null>(null);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Production"
        description="Board kontrol per proses. Seret kartu ke kolom berikutnya untuk menyelesaikan tahapan."
      />

      {isError ? (
        <ErrorNotice error={error} />
      ) : isLoading ? (
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-[220px] shrink-0" />
          ))}
        </div>
      ) : (
        <ProductionBoard
          batches={batches}
          canWrite={canWrite}
          filters={search}
          onFiltersChange={(patch) =>
            navigate({
              replace: true,
              search: (prev) => ({ ...prev, ...patch }),
            })
          }
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
