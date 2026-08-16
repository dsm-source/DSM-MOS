import { Package, Lock, ExternalLink } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import {
  PROCESS_LABEL,
  STEP_STATUS_CLASS,
  formatDurationSince,
} from "../lib/process";
import { activeStep, isBatchDone } from "../lib/batch-progress";
import { computeStartBlocker } from "../lib/start-blocker";
import { PRODUCTION_PROCESSES, type ProductionBatchStepRow } from "../types";
import type { BatchWithContext } from "../hooks/use-batches";

export function BatchCard({
  batch,
  onOpen,
}: {
  batch: BatchWithContext;
  onOpen: () => void;
}) {
  const item = batch.engineering_job?.sales_order_item;
  const so = item?.sales_order;
  const active = activeStep(batch.steps);
  const byProcess = new Map(batch.steps.map((s) => [s.process, s]));
  const blocker = active ? computeStartBlocker(active, batch) : null;
  const isBlocked = !!blocker;
  const engJobId = batch.engineering_job?.id;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        "w-full text-left rounded-xl border bg-card p-3 shadow-sm hover:border-primary/50 transition space-y-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40",
        isBlocked && "border-amber-400 dark:border-amber-700",
      )}
    >
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

      {/* Timeline 5 tahapan */}
      <div className="flex items-center gap-1">
        {PRODUCTION_PROCESSES.map((p) => {
          const s = byProcess.get(p);
          const status = s?.status ?? "waiting";
          return (
            <div
              key={p}
              title={`${PROCESS_LABEL[p]}: ${status}`}
              className={cn(
                "h-1.5 flex-1 rounded",
                STEP_STATUS_CLASS[status].split(" ")[0], // background only
              )}
            />
          );
        })}
      </div>

      {isBlocked && (
        <div className="flex flex-col gap-1.5 text-xs rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-900/30 dark:border-amber-800 text-amber-900 dark:text-amber-200 p-2">
          <div className="flex items-start gap-1.5">
            <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>Terblokir: {blocker!.message}</span>
          </div>
          {blocker!.kind === "engineering" && engJobId && (
            <Link
              to="/engineering/$id"
              params={{ id: engJobId }}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 self-start font-medium underline underline-offset-2 hover:text-amber-950 dark:hover:text-amber-100"
            >
              <ExternalLink className="h-3 w-3" />
              Lihat sumber blocker (Engineering Job)
            </Link>
          )}
          {blocker!.kind === "material" && (
            <Link
              to="/material"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 self-start font-medium underline underline-offset-2 hover:text-amber-950 dark:hover:text-amber-100"
            >
              <ExternalLink className="h-3 w-3" />
              Lihat sumber blocker (Material)
            </Link>
          )}
        </div>
      )}

      {active ? (
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {PROCESS_LABEL[active.process]}
          </span>
          {active.status === "running" && active.started_at && (
            <span> · berjalan {formatDurationSince(active.started_at)}</span>
          )}
          {active.status === "waiting" && !isBlocked && (
            <span> · menunggu</span>
          )}
          {active.status === "paused" && <span> · dijeda</span>}
        </div>
      ) : (
        <div className="text-xs text-emerald-700 dark:text-emerald-300">
          Semua tahapan selesai
        </div>
      )}
    </div>
  );
}
