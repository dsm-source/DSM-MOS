import { useEffect, useState } from "react";
import { notifyError } from "@/lib/error-message";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { PROCESS_LABEL } from "@/features/production/lib/process";
import { QcStatusBadge } from "./qc-status-badge";
import { QC_STATUS_LABEL } from "../lib/status";
import {
  useUpdateInspection,
  useTriggerRework,
} from "../hooks/use-inspections";
import { InspectionTimeline } from "./inspection-timeline";
import { enqueue, isOffline, isOfflineLikeError } from "../lib/offline-queue";
import type { QcInspectionWithContext, QcStatus } from "../types";

const OFFLINE_QUEUED_MESSAGE = "Tersimpan lokal, menunggu sinkronisasi";
const OFFLINE_QUEUE_FAILED_MESSAGE =
  "Gagal menyimpan data lokal. Coba kosongkan storage browser atau ulangi lagi.";

export function InspectionDialog({
  inspection,
  open,
  onOpenChange,
  canWrite,
}: {
  inspection: QcInspectionWithContext | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canWrite: boolean;
}) {
  const update = useUpdateInspection();
  const rework = useTriggerRework();
  const [qtyTotal, setQtyTotal] = useState("0");
  const [qtyOk, setQtyOk] = useState("0");
  const [qtyReject, setQtyReject] = useState("0");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!inspection) return;
    setQtyTotal(String(inspection.qty_total ?? 0));
    setQtyOk(String(inspection.qty_ok ?? 0));
    setQtyReject(String(inspection.qty_reject ?? 0));
    setNotes(inspection.defect_notes ?? "");
  }, [inspection]);

  if (!inspection) return null;
  const step = inspection.production_batch_step;
  const batch = step?.production_batch;
  const so = batch?.engineering_job?.sales_order_item?.sales_order;
  const item = batch?.engineering_job?.sales_order_item;

  const allowed: QcStatus[] = (() => {
    switch (inspection.status) {
      case "waiting":
        return ["inspection"];
      case "inspection":
        return ["pass", "reject"];
      case "reject":
      case "rework":
      case "pass":
        return [];
    }
  })();

  const totalNum = Number(qtyTotal) || 0;
  const okNum = Number(qtyOk) || 0;
  const rejNum = Number(qtyReject) || 0;
  const overCap = okNum + rejNum > totalNum;

  function queueOrNotify(
    item: Parameters<typeof enqueue>[0],
    onQueued?: () => void,
  ): boolean {
    const queued = enqueue(item);
    if (!queued) {
      toast.error(OFFLINE_QUEUE_FAILED_MESSAGE);
      return false;
    }
    toast.info(OFFLINE_QUEUED_MESSAGE);
    onQueued?.();
    return true;
  }

  async function saveDraft() {
    if (overCap) {
      toast.error("Data belum valid", {
        description: "Jumlah OK + Tolak melebihi Total",
      });
      return;
    }
    const payload = {
      qty_total: totalNum,
      qty_ok: okNum,
      qty_reject: rejNum,
      defect_notes: notes.trim() || null,
    };
    if (isOffline()) {
      queueOrNotify({
        kind: "update-inspection",
        inspectionId: inspection!.id,
        payload,
      });
      return;
    }
    try {
      await update.mutateAsync({ id: inspection!.id, ...payload });
      toast.success("Data disimpan");
    } catch (e) {
      if (isOfflineLikeError(e)) {
        queueOrNotify({
          kind: "update-inspection",
          inspectionId: inspection!.id,
          payload,
        });
      } else {
        notifyError(e);
      }
    }
  }

  async function transition(next: QcStatus) {
    if ((next === "pass" || next === "reject") && overCap) {
      toast.error("Data belum valid", {
        description: "Jumlah OK + Tolak melebihi Total",
      });
      return;
    }
    const payload = {
      status: next,
      qty_total: totalNum,
      qty_ok: okNum,
      qty_reject: rejNum,
      defect_notes: notes.trim() || null,
    };
    if (isOffline()) {
      queueOrNotify(
        {
          kind: "update-inspection",
          inspectionId: inspection!.id,
          payload,
        },
        () => {
          if (next === "pass" || next === "reject") onOpenChange(false);
        },
      );
      return;
    }
    try {
      await update.mutateAsync({ id: inspection!.id, ...payload });
      toast.success(`Status → ${QC_STATUS_LABEL[next]}`);
      if (next === "pass" || next === "reject") onOpenChange(false);
    } catch (e) {
      if (isOfflineLikeError(e)) {
        queueOrNotify(
          {
            kind: "update-inspection",
            inspectionId: inspection!.id,
            payload,
          },
          () => {
            if (next === "pass" || next === "reject") onOpenChange(false);
          },
        );
      } else {
        notifyError(e);
      }
    }
  }

  async function handleTriggerRework() {
    if (isOffline()) {
      queueOrNotify(
        { kind: "trigger-rework", inspectionId: inspection!.id },
        () => onOpenChange(false),
      );
      return;
    }
    try {
      await rework.mutateAsync(inspection!.id);
      toast.success("Rework dipicu");
      onOpenChange(false);
    } catch (e) {
      if (isOfflineLikeError(e)) {
        queueOrNotify(
          { kind: "trigger-rework", inspectionId: inspection!.id },
          () => onOpenChange(false),
        );
      } else {
        notifyError(e);
      }
    }
  }

  const readOnly = !canWrite || inspection.status === "pass";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            Inspeksi QC — {batch?.batch_number ?? "?"}{" "}
            <QcStatusBadge status={inspection.status} />
          </DialogTitle>
          <DialogDescription>
            {step
              ? `Tahap ${step.sequence_order} • ${PROCESS_LABEL[step.process]}`
              : "-"}
            {" · "}SO {so?.so_number ?? "?"} · {so?.customer?.name ?? "-"} ·{" "}
            {item?.item_name ?? "-"} · Qty batch: {batch?.quantity}{" "}
            {item?.unit ?? ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="qty-total">Total Diinspeksi</Label>
              <Input
                id="qty-total"
                type="number"
                min={0}
                step="any"
                value={qtyTotal}
                disabled={readOnly}
                onChange={(e) => setQtyTotal(e.target.value)}
                className="h-11 text-base"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qty-ok">Jumlah OK</Label>
              <Input
                id="qty-ok"
                type="number"
                min={0}
                step="any"
                value={qtyOk}
                disabled={readOnly}
                onChange={(e) => setQtyOk(e.target.value)}
                className="h-11 text-base"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qty-reject">Jumlah Tolak</Label>
              <Input
                id="qty-reject"
                type="number"
                min={0}
                step="any"
                value={qtyReject}
                disabled={readOnly}
                onChange={(e) => setQtyReject(e.target.value)}
                className="h-11 text-base"
              />
            </div>
          </div>
          {overCap && (
            <p className="text-xs text-red-600 dark:text-red-400">
              OK + Tolak ({okNum + rejNum}) melebihi Total ({totalNum}).
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="notes">Catatan cacat</Label>
            <Textarea
              id="notes"
              rows={3}
              value={notes}
              disabled={readOnly}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Deskripsikan jenis cacat, lokasi, jumlah, dsb."
            />
          </div>

          {step?.id && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label>Riwayat inspeksi tahapan</Label>
                <InspectionTimeline
                  stepId={step.id}
                  currentId={inspection.id}
                />
              </div>
            </>
          )}
        </div>

        <Separator />

        <DialogFooter className="gap-2 flex-wrap sm:justify-between">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="min-h-11"
          >
            Tutup
          </Button>
          {canWrite && !readOnly && (
            <div className="flex gap-2 flex-wrap">
              {inspection.status !== "reject" && (
                <Button
                  variant="outline"
                  onClick={saveDraft}
                  disabled={update.isPending}
                  className="min-h-11"
                >
                  Simpan
                </Button>
              )}
              {inspection.status === "reject" ? (
                <Button
                  onClick={handleTriggerRework}
                  disabled={rework.isPending}
                  variant="destructive"
                  className="min-h-11"
                >
                  <RotateCcw className="h-4 w-4 mr-1.5" />
                  Trigger Rework
                </Button>
              ) : (
                allowed.map((next) => {
                  const isDanger = next === "reject";
                  const isSuccess = next === "pass";
                  const label =
                    next === "inspection"
                      ? "Mulai Inspeksi"
                      : QC_STATUS_LABEL[next];
                  return (
                    <Button
                      key={next}
                      onClick={() => transition(next)}
                      disabled={update.isPending}
                      variant={isDanger ? "destructive" : "default"}
                      className={
                        "min-h-11 " +
                        (isSuccess ? "bg-emerald-600 hover:bg-emerald-700" : "")
                      }
                    >
                      {label}
                    </Button>
                  );
                })
              )}
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
