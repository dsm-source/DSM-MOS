import { useEffect, useState } from "react";
import { notifyError } from "@/lib/error-message";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useUpdateBatchPlan,
  type BatchWithContext,
} from "../hooks/use-batches";
import { PRODUCTION_PROCESSES } from "../types";
import { PROCESS_LABEL } from "../lib/process";

function routingToProcesses(routing: unknown): string[] {
  if (!Array.isArray(routing)) return [...PRODUCTION_PROCESSES];
  const processes = routing
    .map((item) =>
      item && typeof item === "object"
        ? (item as { process?: string }).process
        : null,
    )
    .filter((p): p is string => !!p);
  return processes.length > 0 ? processes : [...PRODUCTION_PROCESSES];
}

export function EditBatchPlanDialog({
  batch,
  open,
  onOpenChange,
  canEdit,
}: {
  batch: BatchWithContext | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  canEdit: boolean;
}) {
  const update = useUpdateBatchPlan();
  const [start, setStart] = useState("");
  const [complete, setComplete] = useState("");
  const [delivery, setDelivery] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedProcesses, setSelectedProcesses] = useState<string[]>([
    ...PRODUCTION_PROCESSES,
  ]);

  useEffect(() => {
    if (!batch) return;
    setStart(batch.planned_start_date ?? "");
    setComplete(batch.planned_completion_date ?? "");
    setDelivery(batch.estimated_delivery_date ?? "");
    setNotes(batch.notes ?? "");
    setSelectedProcesses(routingToProcesses(batch.routing));
  }, [batch]);

  const toggleProcess = (process: string, checked: boolean) => {
    setSelectedProcesses((prev) =>
      checked ? [...prev, process] : prev.filter((p) => p !== process),
    );
  };

  const submit = async () => {
    if (!batch) return;
    if (start && complete && complete < start) {
      toast.error("Data belum valid", {
        description: "Rencana selesai tidak boleh sebelum rencana mulai.",
      });
      return;
    }
    if (complete && delivery && delivery < complete) {
      toast.error("Data belum valid", {
        description: "Estimasi kirim tidak boleh sebelum rencana selesai.",
      });
      return;
    }
    if (selectedProcesses.length === 0) {
      toast.error("Data belum valid", {
        description: "Pilih minimal 1 tahapan proses",
      });
      return;
    }
    try {
      await update.mutateAsync({
        id: batch.id,
        planned_start_date: start || null,
        planned_completion_date: complete || null,
        estimated_delivery_date: delivery || null,
        notes: notes.trim() || null,
        routing: PRODUCTION_PROCESSES.filter((p) =>
          selectedProcesses.includes(p),
        ),
      });
      toast.success("Rencana batch diperbarui");
      onOpenChange(false);
    } catch (e) {
      notifyError(e, { title: "Gagal memperbarui batch" });
    }
  };

  const job = batch?.engineering_job;
  const item = job?.sales_order_item;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {canEdit ? "Ubah Rencana Batch" : "Detail Rencana Batch"}
          </DialogTitle>
          <DialogDescription>
            {batch ? (
              <>
                <span className="font-mono">{batch.batch_number}</span> ·{" "}
                {item?.item_name} · Qty {Number(batch.quantity)}{" "}
                {item?.unit ?? ""}
                <br />
                <span className="text-xs">
                  Job {job?.job_number} · SO {item?.sales_order?.so_number} ·{" "}
                  {item?.sales_order?.customer?.name ?? "—"}
                </span>
              </>
            ) : (
              "—"
            )}
          </DialogDescription>
        </DialogHeader>

        <fieldset disabled={!canEdit} className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="e-start">Rencana Mulai</Label>
              <Input
                id="e-start"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="e-complete">Rencana Selesai</Label>
              <Input
                id="e-complete"
                type="date"
                value={complete}
                onChange={(e) => setComplete(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="e-delivery">Estimasi Kirim (milestone)</Label>
            <Input
              id="e-delivery"
              type="date"
              value={delivery}
              onChange={(e) => setDelivery(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Milestone estimasi barang sampai ke customer. Bukan data dari
              modul Delivery.
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label>Tahapan Proses (Routing)</Label>
            <div className="grid gap-2">
              {PRODUCTION_PROCESSES.map((process) => (
                <div key={process} className="flex items-center gap-2">
                  <Checkbox
                    id={`e-process-${process}`}
                    checked={selectedProcesses.includes(process)}
                    onCheckedChange={(checked) =>
                      toggleProcess(process, checked === true)
                    }
                  />
                  <Label
                    htmlFor={`e-process-${process}`}
                    className="font-normal"
                  >
                    {PROCESS_LABEL[process]}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="e-notes">Catatan</Label>
            <Textarea
              id="e-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </fieldset>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {canEdit ? "Batal" : "Tutup"}
          </Button>
          {canEdit && (
            <Button onClick={submit} disabled={update.isPending}>
              {update.isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
