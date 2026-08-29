import { Package, Lock, ExternalLink, GripVertical } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useDraggable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { StepStatusBadge } from "./step-status-badge";
import { PROCESS_LABEL, formatDurationSince } from "../lib/process";
import { activeStep, isBatchDone } from "../lib/batch-progress";
import { computeStartBlocker } from "../lib/start-blocker";
import { computeStatus } from "../lib/planning-status";
import {
  actionsFor,
  isActionDisabled,
  type StepAction,
} from "../lib/step-actions";
import { isDraggable } from "../lib/board-columns";
import { PRODUCTION_PROCESSES, type ProductionBatchStepRow } from "../types";
import type { BatchWithContext } from "../hooks/use-batches";

type BatchCardProps = {
  batch: BatchWithContext;
  canWrite: boolean;
  operatorName?: string;
  isPending: boolean;
  pendingComplete: boolean;
  onOpen: () => void;
  onAction: (step: ProductionBatchStepRow, action: StepAction) => void;
  onConfirmComplete: (stepId: string) => void;
  onCancelComplete: () => void;
};

function targetLine(batch: BatchWithContext) {
  const status = computeStatus(batch);
  const raw = batch.planned_completion_date;
  if (status === "unscheduled" || !raw) {
    return { text: "Belum dijadwalkan", tone: "muted" as const };
  }
  const fmt = new Date(raw + "T00:00:00").toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
  if (status === "overdue") {
    return { text: `Target lewat: ${fmt}`, tone: "late" as const };
  }
  const days = Math.ceil(
    (new Date(raw + "T00:00:00").getTime() - Date.now()) / 86_400_000,
  );
  if (days <= 2) {
    const rel =
      days <= 0 ? "hari ini" : days === 1 ? "besok" : `${days} hari lagi`;
    return { text: `Target: ${fmt} (${rel})`, tone: "soon" as const };
  }
  return { text: `Target: ${fmt}`, tone: "ok" as const };
}

export function BatchCard({
  batch,
  canWrite,
  operatorName,
  isPending,
  pendingComplete,
  onOpen,
  onAction,
  onConfirmComplete,
  onCancelComplete,
}: BatchCardProps) {
  const item = batch.engineering_job?.sales_order_item;
  const so = item?.sales_order;
  const active = activeStep(batch.steps);
  const blocker = active ? computeStartBlocker(active, batch) : null;
  const actions = active ? actionsFor(active.status) : [];
  const draggable = canWrite && isDraggable(batch);
  const engJobId = batch.engineering_job?.id;
  const tgt = targetLine(batch);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: batch.id,
    disabled: !draggable,
  });

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
        "w-full text-left rounded-xl border bg-card p-3 shadow-sm transition space-y-2",
        "cursor-pointer hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/40",
        blocker && "border-amber-400 dark:border-amber-700",
        isDragging && "opacity-50",
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
            <div className="text-xs text-muted-foreground truncate">
              {so.so_number} · {so.customer?.name ?? "—"}
            </div>
          )}
        </div>
        <div className="flex items-start gap-1 shrink-0">
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Qty</div>
            <div className="text-sm font-semibold flex items-center gap-1">
              <Package className="h-3 w-3" />
              {Number(batch.quantity)}
            </div>
          </div>
          {draggable && (
            <button
              ref={setNodeRef}
              {...listeners}
              {...attributes}
              type="button"
              onClick={(e) => e.stopPropagation()}
              aria-label={`Seret batch ${batch.batch_number} ke tahapan berikutnya`}
              className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-0.5"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* mini 5-stage strip */}
      <div className="flex items-center gap-1">
        {PRODUCTION_PROCESSES.map((p) => {
          const s = batch.steps.find((x) => x.process === p);
          const done = s?.status === "completed" || s?.status === "skipped";
          const now = active?.process === p;
          return (
            <div
              key={p}
              title={`${PROCESS_LABEL[p]}: ${s?.status ?? "waiting"}`}
              className={cn(
                "h-1.5 flex-1 rounded",
                done ? "bg-emerald-500" : now ? "bg-blue-500" : "bg-muted",
              )}
            />
          );
        })}
      </div>

      {active && (
        <div className="flex items-center gap-2 text-xs">
          <StepStatusBadge status={active.status} />
          {active.status === "running" && active.started_at && (
            <span className="text-muted-foreground">
              berjalan {formatDurationSince(active.started_at)}
            </span>
          )}
          {operatorName && (
            <span className="text-muted-foreground">· {operatorName}</span>
          )}
        </div>
      )}
      {isBatchDone(batch.steps) && (
        <div className="text-xs text-emerald-700 dark:text-emerald-300">
          Semua tahapan selesai
        </div>
      )}

      <div
        className={cn(
          "text-xs font-medium",
          tgt.tone === "late" && "text-red-600 dark:text-red-400",
          tgt.tone === "soon" && "text-amber-600 dark:text-amber-400",
          tgt.tone === "ok" && "text-muted-foreground",
          tgt.tone === "muted" && "text-muted-foreground/70",
        )}
      >
        {tgt.text}
      </div>

      {blocker && (
        <div className="flex flex-col gap-1.5 text-xs rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-900/30 dark:border-amber-800 text-amber-900 dark:text-amber-200 p-2">
          <div className="flex items-start gap-1.5">
            <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>Terblokir: {blocker.message}</span>
          </div>
          {blocker.kind === "engineering" && engJobId && (
            <Link
              to="/engineering/$id"
              params={{ id: engJobId }}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 self-start font-medium underline underline-offset-2"
            >
              <ExternalLink className="h-3 w-3" /> Lihat Engineering Job
            </Link>
          )}
          {blocker.kind === "material" && (
            <Link
              to="/material"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 self-start font-medium underline underline-offset-2"
            >
              <ExternalLink className="h-3 w-3" /> Lihat Material
            </Link>
          )}
        </div>
      )}

      {pendingComplete && active ? (
        <div
          onClick={(e) => e.stopPropagation()}
          className="rounded-md border border-[#D81E1C] bg-red-50 dark:bg-red-950/40 p-2 text-xs space-y-1.5"
        >
          <div className="font-medium">
            Selesaikan {PROCESS_LABEL[active.process]}?
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-7 bg-[#D81E1C] hover:bg-[#b91816] text-white"
              disabled={isPending}
              onClick={() => onConfirmComplete(active.id)}
            >
              Ya
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={onCancelComplete}
            >
              Batal
            </Button>
          </div>
        </div>
      ) : (
        canWrite &&
        actions.length > 0 &&
        active && (
          <div
            className="flex flex-wrap gap-1.5 pt-1"
            onClick={(e) => e.stopPropagation()}
          >
            {actions.map((action) => (
              <Button
                key={action.key}
                size="sm"
                variant={action.variant ?? "default"}
                className="h-7 text-xs"
                disabled={isActionDisabled(active, batch, action, isPending)}
                onClick={() => onAction(active, action)}
              >
                <action.icon className="h-3.5 w-3.5 mr-1" />
                {action.label}
              </Button>
            ))}
          </div>
        )
      )}
    </div>
  );
}
