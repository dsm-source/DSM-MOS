import { Play, Pause, CheckCircle2, Package, AlertCircle } from "lucide-react";
import { notifyError } from "@/lib/error-message";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PROCESS_LABEL, formatDurationSince } from "../lib/process";
import {
  computeStartBlocker,
  type StationBlockReason,
} from "../lib/start-blocker";
import type { ProductionBatchStepRow } from "../types";
import type { BatchWithContext } from "../hooks/use-batches";
import { useUpdateBatchStep } from "../hooks/use-batch-steps";

export function StationStepCard({
  step,
  batch,
  canWrite,
}: {
  step: ProductionBatchStepRow;
  batch: BatchWithContext;
  canWrite: boolean;
}) {
  const item = batch.engineering_job?.sales_order_item;
  const so = item?.sales_order;
  const update = useUpdateBatchStep();
  const blocker = computeStartBlocker(step, batch);

  const timeAnchor =
    step.status === "running"
      ? step.started_at
      : step.status === "paused"
        ? step.paused_at
        : step.status === "completed"
          ? step.completed_at
          : step.created_at;

  const run = async (status: "running" | "paused" | "completed") => {
    try {
      await update.mutateAsync({ id: step.id, status });
      toast.success("Status diperbarui");
    } catch (e) {
      notifyError(e, { title: "Gagal" });
    }
  };

  return (
    <div className="rounded-xl border bg-card p-3 space-y-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-mono text-xs text-muted-foreground">
            {batch.batch_number}
          </div>
          <div className="font-medium text-sm truncate">
            {item?.item_name ?? "—"}
          </div>
          {so && (
            <div className="text-xs text-muted-foreground">{so.so_number}</div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-muted-foreground">Qty</div>
          <div className="text-sm font-semibold flex items-center gap-1">
            <Package className="h-3 w-3" />
            {Number(batch.quantity)}
          </div>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        {step.status === "running" &&
          `Berjalan ${formatDurationSince(timeAnchor)}`}
        {step.status === "paused" &&
          `Dijeda ${formatDurationSince(timeAnchor)}`}
        {step.status === "waiting" &&
          `Menunggu ${formatDurationSince(timeAnchor)}`}
        {step.status === "completed" &&
          step.completed_at &&
          `Selesai ${new Date(step.completed_at).toLocaleString()}`}
      </div>

      {blocker && step.status === "waiting" && (
        <div className="flex items-start gap-1.5 text-xs rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-900/30 dark:border-amber-800 text-amber-900 dark:text-amber-200 p-2">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{blocker.message}</span>
        </div>
      )}

      {canWrite && (
        <div className="flex flex-wrap gap-2">
          {step.status === "waiting" && (
            <Button
              size="lg"
              className="h-11 flex-1 min-w-[7rem]"
              disabled={!!blocker || update.isPending}
              onClick={() => run("running")}
            >
              <Play className="h-4 w-4 mr-1" /> Start
            </Button>
          )}
          {step.status === "running" && (
            <>
              <Button
                size="lg"
                variant="outline"
                className="h-11 flex-1 min-w-[6rem]"
                disabled={update.isPending}
                onClick={() => run("paused")}
              >
                <Pause className="h-4 w-4 mr-1" /> Pause
              </Button>
              <Button
                size="lg"
                className="h-11 flex-1 min-w-[7rem]"
                disabled={update.isPending}
                onClick={() => run("completed")}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" /> Complete
              </Button>
            </>
          )}
          {step.status === "paused" && (
            <>
              <Button
                size="lg"
                className="h-11 flex-1 min-w-[7rem]"
                disabled={update.isPending}
                onClick={() => run("running")}
              >
                <Play className="h-4 w-4 mr-1" /> Resume
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-11 flex-1 min-w-[7rem]"
                disabled={update.isPending}
                onClick={() => run("completed")}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" /> Complete
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
