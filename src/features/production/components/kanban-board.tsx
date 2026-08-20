import { useMemo, useState } from "react";
import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { GripVertical, Lock, AlertCircle, Package } from "lucide-react";
import { toast } from "sonner";
import { notifyError } from "@/lib/error-message";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PROCESS_LABEL, formatDurationSince } from "../lib/process";
import { computeStartBlocker } from "../lib/start-blocker";
import { isBatchDone } from "../lib/batch-progress";
import {
  actionsFor,
  isActionDisabled,
  type StepAction,
} from "../lib/step-actions";
import { StepStatusBadge } from "./step-status-badge";
import { StepOperatorDialog } from "./step-operator-dialog";
import type { BatchWithContext } from "../hooks/use-batches";
import { useUpdateBatchStep } from "../hooks/use-batch-steps";
import { useOperators } from "@/features/operators/hooks/use-operators";
import type { ProductionBatchStepRow } from "../types";

export function KanbanBoard({
  batches,
  canWrite,
  onOpenDetail,
}: {
  batches: BatchWithContext[];
  canWrite: boolean;
  onOpenDetail: (batch: BatchWithContext) => void;
}) {
  const defaultBatch = useMemo(
    () => batches.find((b) => !isBatchDone(b.steps)) ?? batches[0],
    [batches],
  );
  const [selectedId, setSelectedId] = useState<string | undefined>(
    defaultBatch?.id,
  );
  const batch =
    batches.find((b) => b.id === selectedId) ?? defaultBatch ?? null;

  const update = useUpdateBatchStep();
  const { data: operators = [] } = useOperators();
  const [pendingDialog, setPendingDialog] = useState<{
    step: ProductionBatchStepRow;
    action: StepAction;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  if (!batch) {
    return (
      <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
        Belum ada batch produksi.
      </div>
    );
  }

  const runAction = async (
    step: ProductionBatchStepRow,
    action: StepAction,
    operatorId?: string,
  ) => {
    try {
      await update.mutateAsync({
        id: step.id,
        status: action.toStatus,
        ...(operatorId !== undefined ? { operator_id: operatorId } : {}),
      });
      toast.success("Status diperbarui");
    } catch (e) {
      notifyError(e, { title: "Gagal" });
    } finally {
      setPendingDialog(null);
    }
  };

  const handleAction = (step: ProductionBatchStepRow, action: StepAction) => {
    if (!canWrite || update.isPending) return;
    if (action.needsOperator) {
      setPendingDialog({ step, action });
      return;
    }
    void runAction(step, action);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !batch) return;
    const step = batch.steps.find((s) => s.id === active.id);
    if (!step) return;
    const actionKey = over.data.current?.actionKey as string | undefined;
    const action = actionsFor(step.status).find((a) => a.key === actionKey);
    if (!action) return;
    if (isActionDisabled(step, batch, action, update.isPending)) {
      toast.error("Aksi tidak tersedia untuk tahapan ini");
      return;
    }
    handleAction(step, action);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="text-sm text-muted-foreground">Batch:</div>
        <Select value={batch.id} onValueChange={setSelectedId}>
          <SelectTrigger className="w-80">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {batches.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.batch_number} —{" "}
                {b.engineering_job?.sales_order_item?.item_name ?? "—"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={() => onOpenDetail(batch)}>
          Lihat Detail
        </Button>
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {batch.steps.map((step) => (
            <KanbanCell
              key={step.id}
              step={step}
              batch={batch}
              canWrite={canWrite}
              isPending={update.isPending}
              operatorName={
                operators.find((o) => o.id === step.operator_id)?.name
              }
              onAction={(action) => handleAction(step, action)}
            />
          ))}
        </div>
      </DndContext>

      {pendingDialog && (
        <StepOperatorDialog
          open
          onOpenChange={(o) => !o && setPendingDialog(null)}
          title={pendingDialog.action.label}
          confirmLabel={pendingDialog.action.confirmLabel}
          defaultOperatorId={pendingDialog.step.operator_id}
          isPending={update.isPending}
          onConfirm={(operatorId) =>
            void runAction(pendingDialog.step, pendingDialog.action, operatorId)
          }
        />
      )}
    </div>
  );
}

function KanbanCell({
  step,
  batch,
  canWrite,
  isPending,
  operatorName,
  onAction,
}: {
  step: ProductionBatchStepRow;
  batch: BatchWithContext;
  canWrite: boolean;
  isPending: boolean;
  operatorName?: string;
  onAction: (action: StepAction) => void;
}) {
  const blocker = computeStartBlocker(step, batch);
  const actions = actionsFor(step.status);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: step.id,
    disabled: !canWrite || actions.length === 0,
  });

  return (
    <div className="rounded-xl border bg-muted/30 p-3 space-y-2 min-h-[180px]">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">
          {step.sequence_order}. {PROCESS_LABEL[step.process]}
        </div>
        {canWrite && actions.length > 0 && (
          <button
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            type="button"
            className={cn(
              "cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground",
              isDragging && "opacity-50",
            )}
            aria-label="Seret untuk pindah status"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
      </div>

      <StepStatusBadge status={step.status} />

      <div className="text-xs text-muted-foreground space-y-0.5">
        <div className="flex items-center gap-1">
          <Package className="h-3 w-3" />
          Qty selesai: {step.qty_completed}
        </div>
        {operatorName && <div>Operator: {operatorName}</div>}
        {step.status === "running" && (
          <div>Berjalan {formatDurationSince(step.started_at)}</div>
        )}
      </div>

      {blocker && step.status === "waiting" && (
        <div className="flex items-start gap-1.5 text-xs rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-900/30 dark:border-amber-800 text-amber-900 dark:text-amber-200 p-2">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{blocker.message}</span>
        </div>
      )}

      {canWrite && actions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {actions.map((action) => (
            <ActionDropButton
              key={action.key}
              action={action}
              stepId={step.id}
              disabled={isActionDisabled(step, batch, action, isPending)}
              onClick={() => onAction(action)}
            />
          ))}
        </div>
      )}

      {step.status === "completed" && !canWrite && (
        <div className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300">
          <Lock className="h-3 w-3" /> Selesai
        </div>
      )}
    </div>
  );
}

function ActionDropButton({
  action,
  stepId,
  disabled,
  onClick,
}: {
  action: StepAction;
  stepId: string;
  disabled: boolean;
  onClick: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${stepId}:${action.key}`,
    data: { actionKey: action.key },
    disabled,
  });
  const Icon = action.icon;
  return (
    <Button
      ref={setNodeRef}
      size="sm"
      variant={action.variant ?? "default"}
      disabled={disabled}
      onClick={onClick}
      className={cn(isOver && "ring-2 ring-primary")}
    >
      <Icon className="h-3.5 w-3.5 mr-1" /> {action.label}
    </Button>
  );
}
