import { useState } from "react";
import { Lock, CheckCircle } from "lucide-react";
import { notifyError } from "@/lib/error-message";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PROCESS_LABEL, formatDurationSince } from "../lib/process";
import { StepStatusBadge } from "./step-status-badge";
import { StepOperatorDialog } from "./step-operator-dialog";
import { computeStartBlocker } from "../lib/start-blocker";
import {
  actionsFor,
  isActionDisabled,
  type StepAction,
} from "../lib/step-actions";
import { BlockerHistory } from "./blocker-history";
import type { BatchWithContext } from "../hooks/use-batches";
import { useUpdateBatchStep } from "../hooks/use-batch-steps";
import type { ProductionBatchStepRow, ProductionStepStatus } from "../types";

export function BatchDetailDrawer({
  batch,
  onClose,
  canWrite,
}: {
  batch: BatchWithContext | null;
  onClose: () => void;
  canWrite: boolean;
}) {
  const update = useUpdateBatchStep();
  const item = batch?.engineering_job?.sales_order_item;
  const so = item?.sales_order;
  const [pendingDialog, setPendingDialog] = useState<{
    step: ProductionBatchStepRow;
    action: StepAction;
  } | null>(null);

  const act = async (
    id: string,
    status: ProductionStepStatus,
    operatorId?: string,
  ) => {
    try {
      await update.mutateAsync({
        id,
        status,
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
    if (update.isPending) return;
    if (action.key === "skip") {
      if (confirm(`Lewati tahapan ${PROCESS_LABEL[step.process]}?`)) {
        void act(step.id, action.toStatus);
      }
      return;
    }
    if (action.needsOperator) {
      setPendingDialog({ step, action });
      return;
    }
    void act(step.id, action.toStatus);
  };

  return (
    <Sheet open={!!batch} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {batch &&
          (() => {
            const engStatus = batch.engineering_job?.status;
            const matStatus = batch.engineering_job?.material_status?.status;
            const engOk = engStatus === "approved";
            const matOk = matStatus === "material_ready";
            const gateOk = engOk && matOk;
            return (
              <>
                <SheetHeader>
                  <SheetTitle className="font-mono text-base">
                    {batch.batch_number}
                  </SheetTitle>
                  <SheetDescription>
                    {item?.item_name} · Qty {Number(batch.quantity)}{" "}
                    {item?.unit ?? ""}
                    {so && <> · SO {so.so_number}</>}
                  </SheetDescription>
                </SheetHeader>

                <div
                  className={
                    "mt-4 rounded-xl border p-3 flex items-start gap-2 text-sm " +
                    (gateOk
                      ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-100"
                      : "border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-100")
                  }
                >
                  {gateOk ? (
                    <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  ) : (
                    <Lock className="h-4 w-4 mt-0.5 shrink-0" />
                  )}
                  <div className="space-y-0.5">
                    <div className="font-medium">
                      {gateOk
                        ? "Siap diproduksi"
                        : "Batch terkunci — belum boleh mulai"}
                    </div>
                    <div className="text-xs">
                      Engineering:{" "}
                      <span
                        className={
                          engOk ? "font-semibold" : "font-semibold underline"
                        }
                      >
                        {engStatus ?? "—"}
                      </span>
                      {" · "}
                      Material:{" "}
                      <span
                        className={
                          matOk ? "font-semibold" : "font-semibold underline"
                        }
                      >
                        {matStatus ?? "—"}
                      </span>
                    </div>
                    {!gateOk && (
                      <div className="text-xs">
                        Tahapan pertama hanya bisa <em>Start</em> saat
                        Engineering <strong>approved</strong> dan Material{" "}
                        <strong>material_ready</strong>.
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <BlockerHistory
                    engineeringJobId={batch.engineering_job?.id}
                    batchLabel={batch.batch_number}
                  />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Rencana Mulai
                    </div>
                    <div>{batch.planned_start_date ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Rencana Selesai
                    </div>
                    <div>{batch.planned_completion_date ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Estimasi Kirim
                    </div>
                    <div>{batch.estimated_delivery_date ?? "—"}</div>
                  </div>
                </div>

                {batch.notes && (
                  <div className="mt-3 text-sm">
                    <div className="text-xs text-muted-foreground">Catatan</div>
                    <div>{batch.notes}</div>
                  </div>
                )}

                <Separator className="my-4" />

                <h3 className="text-sm font-semibold mb-2">Tahapan Proses</h3>
                <ol className="space-y-3">
                  {batch.steps.map((step) => {
                    const blocker = computeStartBlocker(step, batch);
                    const actions = actionsFor(step.status);
                    return (
                      <li
                        key={step.id}
                        className="rounded-xl border p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-4 text-right">
                              {step.sequence_order}.
                            </span>
                            <span className="font-medium text-sm">
                              {PROCESS_LABEL[step.process]}
                            </span>
                          </div>
                          <StepStatusBadge status={step.status} />
                        </div>

                        <div className="text-xs text-muted-foreground space-x-3 pl-6">
                          {step.started_at && (
                            <span>
                              Mulai:{" "}
                              {new Date(step.started_at).toLocaleString()}
                            </span>
                          )}
                          {step.completed_at && (
                            <span>
                              Selesai:{" "}
                              {new Date(step.completed_at).toLocaleString()}
                            </span>
                          )}
                          {step.status === "running" && (
                            <span>
                              ({formatDurationSince(step.started_at)})
                            </span>
                          )}
                        </div>

                        {blocker && step.status === "waiting" && (
                          <div className="text-xs text-amber-800 dark:text-amber-200 pl-6">
                            {blocker.message}
                          </div>
                        )}

                        {canWrite && actions.length > 0 && (
                          <div className="flex flex-wrap gap-2 pl-6">
                            {actions.map((action) => {
                              const Icon = action.icon;
                              return (
                                <Button
                                  key={action.key}
                                  size="sm"
                                  variant={action.variant ?? "default"}
                                  disabled={isActionDisabled(
                                    step,
                                    batch,
                                    action,
                                    update.isPending,
                                  )}
                                  onClick={() => handleAction(step, action)}
                                >
                                  <Icon className="h-3.5 w-3.5 mr-1" />{" "}
                                  {action.label}
                                </Button>
                              );
                            })}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </>
            );
          })()}
      </SheetContent>

      {batch && pendingDialog && (
        <StepOperatorDialog
          open
          onOpenChange={(o) => !o && setPendingDialog(null)}
          title={pendingDialog.action.label}
          confirmLabel={pendingDialog.action.confirmLabel}
          defaultOperatorId={pendingDialog.step.operator_id}
          isPending={update.isPending}
          onConfirm={(operatorId) =>
            void act(
              pendingDialog.step.id,
              pendingDialog.action.toStatus,
              operatorId,
            )
          }
        />
      )}
    </Sheet>
  );
}
