import { useState } from "react";
import { notifyError } from "@/lib/error-message";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateBatch } from "../hooks/use-batches";
import type { ApprovedJob } from "../hooks/use-approved-jobs";
import { PRODUCTION_PROCESSES } from "../types";
import { PROCESS_LABEL } from "../lib/process";

export function CreateBatchDialog({
  job,
  open,
  onOpenChange,
}: {
  job: ApprovedJob | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const create = useCreateBatch();
  const [qty, setQty] = useState("");
  const [start, setStart] = useState("");
  const [complete, setComplete] = useState("");
  const [delivery, setDelivery] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedProcesses, setSelectedProcesses] = useState<string[]>([
    ...PRODUCTION_PROCESSES,
  ]);

  const reset = () => {
    setQty("");
    setStart("");
    setComplete("");
    setDelivery("");
    setNotes("");
    setSelectedProcesses([...PRODUCTION_PROCESSES]);
  };

  const toggleProcess = (process: string, checked: boolean) => {
    setSelectedProcesses((prev) =>
      checked ? [...prev, process] : prev.filter((p) => p !== process),
    );
  };

  const submit = async () => {
    if (!job) return;
    const q = Number(qty);
    if (!Number.isFinite(q) || q <= 0) {
      toast.error("Data belum valid", {
        description: "Kuantitas harus lebih dari 0",
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
      await create.mutateAsync({
        engineering_job_id: job.id,
        quantity: q,
        planned_start_date: start || null,
        planned_completion_date: complete || null,
        estimated_delivery_date: delivery || null,
        notes: notes.trim() || null,
        routing: PRODUCTION_PROCESSES.filter((p) =>
          selectedProcesses.includes(p),
        ),
      });
      toast.success("Batch dibuat");
      reset();
      onOpenChange(false);
    } catch (e) {
      notifyError(e, { title: "Gagal membuat batch" });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Buat Batch Produksi</DialogTitle>
          <DialogDescription>
            {job ? (
              <>
                <span className="font-mono">{job.job_number}</span> ·{" "}
                {job.sales_order_item?.item_name} · Total qty item:{" "}
                {job.sales_order_item
                  ? Number(job.sales_order_item.quantity)
                  : "—"}{" "}
                {job.sales_order_item?.unit ?? ""}
              </>
            ) : (
              "—"
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="qty">Kuantitas batch</Label>
            <Input
              id="qty"
              type="number"
              min="0"
              step="any"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="start">Rencana Mulai</Label>
              <Input
                id="start"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="complete">Rencana Selesai</Label>
              <Input
                id="complete"
                type="date"
                value={complete}
                onChange={(e) => setComplete(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="delivery">Estimasi Kirim</Label>
            <Input
              id="delivery"
              type="date"
              value={delivery}
              onChange={(e) => setDelivery(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Tahapan Proses (Routing)</Label>
            <div className="grid gap-2">
              {PRODUCTION_PROCESSES.map((process) => (
                <div key={process} className="flex items-center gap-2">
                  <Checkbox
                    id={`process-${process}`}
                    checked={selectedProcesses.includes(process)}
                    onCheckedChange={(checked) =>
                      toggleProcess(process, checked === true)
                    }
                  />
                  <Label htmlFor={`process-${process}`} className="font-normal">
                    {PROCESS_LABEL[process]}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="notes">Catatan (opsional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? "Menyimpan..." : "Simpan Batch"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
