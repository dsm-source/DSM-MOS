import { useEffect, useMemo, useState } from "react";
import { notifyError } from "@/lib/error-message";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useEngineeringJob,
  useUpdateEngineeringJob,
} from "@/features/engineering/hooks/use-engineering-jobs";
import { useEngineers } from "@/features/engineering/hooks/use-engineers";
import { EngStatusBadge } from "@/features/engineering/components/status-badge";
import { TargetBadge } from "@/features/engineering/components/target-badge";
import { ENG_STATUS_LABEL } from "@/features/engineering/lib/status";
import {
  ENGINEERING_STATUSES,
  type EngineeringStatus,
} from "@/features/engineering/types";
import { JobHistory } from "@/features/engineering/components/job-history";
import { useMyRoles } from "@/hooks/use-my-roles";

export const Route = createFileRoute("/_authenticated/engineering/$id")({
  head: () => ({ meta: [{ title: "Detail Engineering Job — DSM MOS" }] }),
  component: EngineeringDetailPage,
});

function EngineeringDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { hasAnyRole } = useMyRoles();
  const canWrite = hasAnyRole(["admin", "engineering"]);
  const { data: job, isLoading } = useEngineeringJob(id);
  const { data: engineers = [] } = useEngineers(canWrite);
  const update = useUpdateEngineeringJob();

  const [progress, setProgress] = useState<number>(0);
  const [target, setTarget] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [assigned, setAssigned] = useState<string>("");

  useEffect(() => {
    if (!job) return;
    setProgress(job.progress_percent);
    setTarget(job.target_completion_date ?? "");
    setNotes(job.notes ?? "");
    setAssigned(job.assigned_to ?? "");
  }, [job]);

  const isApproved = job?.status === "approved";
  const allowedTransitions = useMemo<EngineeringStatus[]>(() => {
    if (!job) return [];
    switch (job.status) {
      case "draft":
        return ["in_progress"];
      case "in_progress":
        return ["review"];
      case "review":
        return ["approved", "in_progress"];
      case "approved":
        return [];
    }
  }, [job]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (!job) return <div className="p-6">Job tidak ditemukan.</div>;

  const item = job.sales_order_item;
  const so = item?.sales_order;

  async function handleSave() {
    if (!job) return;
    try {
      await update.mutateAsync({
        id: job.id,
        values: {
          progress_percent: progress,
          target_completion_date: target || null,
          notes: notes.trim() || null,
          assigned_to: assigned || null,
        },
      });
      toast.success("Perubahan disimpan");
    } catch (e) {
      notifyError(e);
    }
  }

  async function handleTransition(next: EngineeringStatus) {
    if (!job) return;
    try {
      await update.mutateAsync({ id: job.id, values: { status: next } });
      toast.success(`Status diubah ke ${ENG_STATUS_LABEL[next]}`);
    } catch (e) {
      notifyError(e);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate({ to: "/engineering" })}
            aria-label="Kembali"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold font-mono">
                {job.job_number}
              </h1>
              <EngStatusBadge status={job.status} />
              <TargetBadge
                target={job.target_completion_date}
                status={job.status}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {item?.item_name} —{" "}
              {so ? `${so.so_number} · ${so.customer?.name ?? ""}` : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Info label="No. Gambar" value={item?.drawing_number ?? "—"} />
        <Info
          label="Qty"
          value={`${item?.quantity ?? "—"} ${item?.unit ?? ""}`}
        />
        <Info label="Spesifikasi" value={item?.material_spec ?? "—"} />
      </div>

      {canWrite && !isApproved && (
        <div className="rounded-xl border p-4 space-y-4">
          <h2 className="text-sm font-semibold">Kelola Job</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Penanggung Jawab</Label>
              <Select value={assigned} onValueChange={setAssigned}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih engineer" />
                </SelectTrigger>
                <SelectContent>
                  {engineers.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      Belum ada user berperan engineering.
                    </div>
                  )}
                  {engineers.map((e) => (
                    <SelectItem key={e.user_id} value={e.user_id}>
                      {e.email ?? e.user_id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="target">Target Penyelesaian</Label>
              <Input
                id="target"
                type="date"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Progress</Label>
              <span className="text-sm font-medium">{progress}%</span>
            </div>
            <div className="flex items-center gap-3">
              <Slider
                value={[progress]}
                onValueChange={(v) => setProgress(v[0] ?? 0)}
                min={0}
                max={100}
                step={5}
                className="flex-1"
              />
              <Input
                type="number"
                min={0}
                max={100}
                value={progress}
                onChange={(e) =>
                  setProgress(
                    Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                  )
                }
                className="w-20"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Catatan</Label>
            <Textarea
              id="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button onClick={handleSave} disabled={update.isPending}>
              Simpan Perubahan
            </Button>
            {allowedTransitions
              .filter((s) => s !== "approved")
              .map((s) => (
                <Button
                  key={s}
                  variant="secondary"
                  onClick={() => handleTransition(s)}
                  disabled={update.isPending}
                >
                  Pindah ke {ENG_STATUS_LABEL[s]}
                </Button>
              ))}
            {allowedTransitions.includes("approved") && (
              <Button
                variant="default"
                onClick={() => handleTransition("approved")}
                disabled={update.isPending}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Approve
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Transisi hanya bisa: Draft → In Progress → Review → Approved (Review
            boleh dikembalikan ke In Progress). Database akan menolak transisi
            ilegal.
          </p>
        </div>
      )}

      {!canWrite && (
        <div className="rounded-xl border p-4 text-sm text-muted-foreground">
          Anda hanya dapat melihat. Hanya Engineering & Admin yang dapat
          mengubah job.
        </div>
      )}

      <div className="rounded-xl border p-4 space-y-2">
        <h2 className="text-sm font-semibold">Ringkasan</h2>
        <div className="grid gap-2 md:grid-cols-2 text-sm">
          <div>
            <span className="text-muted-foreground">Assigned: </span>
            {job.assigned_to
              ? (engineers.find((e) => e.user_id === job.assigned_to)?.email ??
                job.assigned_to.slice(0, 8))
              : "—"}
          </div>
          <div>
            <span className="text-muted-foreground">Progress: </span>
            {job.progress_percent}%
          </div>
          <div>
            <span className="text-muted-foreground">Target: </span>
            {job.target_completion_date ?? "—"}
          </div>
          <div>
            <span className="text-muted-foreground">Approved at: </span>
            {job.approved_at ? new Date(job.approved_at).toLocaleString() : "—"}
          </div>
        </div>
      </div>

      <div className="rounded-xl border p-4 space-y-3">
        <h2 className="text-sm font-semibold">Riwayat Perubahan</h2>
        <JobHistory jobId={job.id} />
      </div>

      <StatusHint statuses={ENGINEERING_STATUSES} />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium mt-1 break-words">{value}</div>
    </div>
  );
}

function StatusHint({ statuses }: { statuses: EngineeringStatus[] }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
      <span>Urutan status:</span>
      {statuses.map((s, i) => (
        <span key={s} className="flex items-center gap-2">
          <EngStatusBadge status={s} />
          {i < statuses.length - 1 && <span>→</span>}
        </span>
      ))}
    </div>
  );
}
