import { useEffect, useRef, useState } from "react";
import { notifyError } from "@/lib/error-message";
import { toast } from "sonner";
import { Loader2, Upload, ImageIcon, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
import { QcStatusBadge } from "./qc-status-badge";
import { QC_STATUS_LABEL } from "../lib/status";
import { useUpdateInspection } from "../hooks/use-inspections";
import { InspectionTimeline } from "./inspection-timeline";
import type { QcInspectionWithContext, QcStatus } from "../types";

const BUCKET = "qc-photos";

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
  const [qtyTotal, setQtyTotal] = useState("0");
  const [qtyOk, setQtyOk] = useState("0");
  const [qtyReject, setQtyReject] = useState("0");
  const [notes, setNotes] = useState("");
  const [signedUrls, setSignedUrls] = useState<{ path: string; url: string }[]>(
    [],
  );
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!inspection) return;
    setQtyTotal(String(inspection.qty_total ?? 0));
    setQtyOk(String(inspection.qty_ok ?? 0));
    setQtyReject(String(inspection.qty_reject ?? 0));
    setNotes(inspection.defect_notes ?? "");
  }, [inspection]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const paths = inspection?.photo_urls ?? [];
      if (paths.length === 0) {
        setSignedUrls([]);
        return;
      }
      const resolved = await Promise.all(
        paths.map(async (p) => {
          const { data } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(p, 60 * 10);
          return { path: p, url: data?.signedUrl ?? "" };
        }),
      );
      if (alive) setSignedUrls(resolved.filter((r) => r.url));
    })();
    return () => {
      alive = false;
    };
  }, [inspection?.id, inspection?.photo_urls]);

  if (!inspection) return null;
  const batch = inspection.production_batch;
  const so = batch?.engineering_job?.sales_order_item?.sales_order;
  const item = batch?.engineering_job?.sales_order_item;

  const allowed: QcStatus[] = (() => {
    switch (inspection.status) {
      case "waiting":
        return ["inspection"];
      case "inspection":
        return ["pass", "reject"];
      case "reject":
        return ["rework"];
      case "rework":
        return ["inspection"];
      case "pass":
        return [];
    }
  })();

  const totalNum = Number(qtyTotal) || 0;
  const okNum = Number(qtyOk) || 0;
  const rejNum = Number(qtyReject) || 0;
  const overCap = okNum + rejNum > totalNum;

  async function saveDraft() {
    if (overCap) {
      toast.error("Data belum valid", {
        description: "Jumlah OK + Tolak melebihi Total",
      });
      return;
    }
    try {
      await update.mutateAsync({
        id: inspection!.id,
        qty_total: totalNum,
        qty_ok: okNum,
        qty_reject: rejNum,
        defect_notes: notes.trim() || null,
      });
      toast.success("Data disimpan");
    } catch (e) {
      notifyError(e);
    }
  }

  async function transition(next: QcStatus) {
    if ((next === "pass" || next === "reject") && overCap) {
      toast.error("Data belum valid", {
        description: "Jumlah OK + Tolak melebihi Total",
      });
      return;
    }
    try {
      await update.mutateAsync({
        id: inspection!.id,
        status: next,
        qty_total: totalNum,
        qty_ok: okNum,
        qty_reject: rejNum,
        defect_notes: notes.trim() || null,
      });
      toast.success(`Status → ${QC_STATUS_LABEL[next]}`);
      if (next === "pass" || next === "reject") onOpenChange(false);
    } catch (e) {
      notifyError(e);
    }
  }

  async function handleUpload(files: FileList) {
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const safe = file.name.replace(/[^\w.-]/g, "_");
        const path = `${inspection!.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, {
            upsert: false,
          });
        if (upErr) throw new Error(upErr.message);
        uploaded.push(path);
      }
      const next = [...(inspection!.photo_urls ?? []), ...uploaded];
      await update.mutateAsync({ id: inspection!.id, photo_urls: next });
      toast.success(`${uploaded.length} foto diunggah`);
    } catch (e) {
      notifyError(e);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removePhoto(path: string) {
    try {
      await supabase.storage.from(BUCKET).remove([path]);
      const next = (inspection!.photo_urls ?? []).filter((p) => p !== path);
      await update.mutateAsync({ id: inspection!.id, photo_urls: next });
    } catch (e) {
      notifyError(e);
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
            SO {so?.so_number ?? "?"} · {so?.customer?.name ?? "-"} ·{" "}
            {item?.item_name ?? "-"} · Qty batch: {batch?.quantity}{" "}
            {item?.unit ?? ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
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

          <div className="space-y-2">
            <Label>Foto bukti</Label>
            {signedUrls.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {signedUrls.map((p) => (
                  <div
                    key={p.path}
                    className="relative group overflow-hidden rounded-lg border"
                  >
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block"
                    >
                      <img
                        src={p.url}
                        alt="Bukti QC"
                        className="w-full h-32 object-cover"
                      />
                    </a>
                    {canWrite && inspection.status !== "pass" && (
                      <button
                        type="button"
                        onClick={() => removePhoto(p.path)}
                        className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Hapus foto"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-24 items-center justify-center rounded-lg border border-dashed text-muted-foreground text-sm">
                <ImageIcon className="h-4 w-4 mr-2" />
                Belum ada foto
              </div>
            )}
            {canWrite && inspection.status !== "pass" && (
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0)
                      handleUpload(e.target.files);
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-1.5" />
                  )}
                  Tambah foto
                </Button>
              </div>
            )}
          </div>

          {batch?.id && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label>Riwayat inspeksi batch</Label>
                <InspectionTimeline
                  batchId={batch.id}
                  currentId={inspection.id}
                />
              </div>
            </>
          )}
        </div>

        <Separator />

        <DialogFooter className="gap-2 flex-wrap sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
          {canWrite && !readOnly && (
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={saveDraft}
                disabled={update.isPending}
              >
                Simpan
              </Button>
              {allowed.map((next) => {
                const isDanger = next === "reject";
                const isSuccess = next === "pass";
                return (
                  <Button
                    key={next}
                    onClick={() => transition(next)}
                    disabled={update.isPending}
                    variant={isDanger ? "destructive" : "default"}
                    className={
                      isSuccess
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : undefined
                    }
                  >
                    {QC_STATUS_LABEL[next]}
                  </Button>
                );
              })}
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
