import { useMemo, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { CalendarRange, Plus, AlertTriangle } from "lucide-react";
import { ViewMode } from "gantt-task-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMyRoles } from "@/hooks/use-my-roles";
import {
  usePlannableJobs,
  type ApprovedJob,
} from "@/features/production/hooks/use-approved-jobs";
import {
  useProductionBatches,
  type BatchWithContext,
} from "@/features/production/hooks/use-batches";
import { CreateBatchDialog } from "@/features/production/components/create-batch-dialog";
import { EditBatchPlanDialog } from "@/features/production/components/edit-batch-plan-dialog";
import {
  PlanningGantt,
  computeStatus,
} from "@/features/production/components/planning-gantt";
import {
  PROCESS_LABEL,
  STEP_STATUS_LABEL,
} from "@/features/production/lib/process";

export const Route = createFileRoute("/_authenticated/production-planning")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id;
    if (!uid) return;
    const [{ data: isAdmin }, { data: isPlanner }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: uid, _role: "admin" }),
      supabase.rpc("has_role", { _user_id: uid, _role: "production_planning" }),
    ]);
    if (!isAdmin && !isPlanner) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Production Planning — DSM MOS" },
      {
        name: "description",
        content:
          "Forward planning batch produksi via Gantt chart — rencana mulai, selesai, dan milestone estimasi kirim.",
      },
      { property: "og:title", content: "Production Planning — DSM MOS" },
      {
        property: "og:description",
        content: "Perencanaan batch produksi DSM MOS via Gantt chart.",
      },
    ],
  }),
  component: PlanningPage,
});

type StatusFilter = "all" | "unscheduled" | "on_track" | "overdue";

function PlanningPage() {
  const { hasAnyRole } = useMyRoles();
  const canPlan = hasAnyRole(["admin", "production_planning"]);
  const { data: batches = [], isLoading } = useProductionBatches();
  const { data: jobs = [] } = usePlannableJobs();

  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Week);
  const [customerId, setCustomerId] = useState<string>("all");
  const [soId, setSoId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  const [selectedBatch, setSelectedBatch] = useState<BatchWithContext | null>(
    null,
  );
  const [editOpen, setEditOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<ApprovedJob | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const customers = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of batches) {
      const c = b.engineering_job?.sales_order_item?.sales_order?.customer;
      if (c) m.set(c.id, c.name);
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [batches]);

  const salesOrders = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of batches) {
      const so = b.engineering_job?.sales_order_item?.sales_order;
      if (!so) continue;
      const cid = so.customer?.id;
      if (customerId !== "all" && cid !== customerId) continue;
      m.set(so.id, so.so_number);
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [batches, customerId]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return batches.filter((b) => {
      const item = b.engineering_job?.sales_order_item;
      const so = item?.sales_order;
      if (customerId !== "all" && so?.customer?.id !== customerId) return false;
      if (soId !== "all" && so?.id !== soId) return false;
      const st = computeStatus(b);
      if (statusFilter !== "all" && st !== statusFilter) return false;
      if (!s) return true;
      return (
        b.batch_number.toLowerCase().includes(s) ||
        (item?.item_name ?? "").toLowerCase().includes(s) ||
        (so?.so_number ?? "").toLowerCase().includes(s) ||
        (so?.customer?.name ?? "").toLowerCase().includes(s)
      );
    });
  }, [batches, customerId, soId, statusFilter, search]);

  const scheduled = filtered.filter((b) => computeStatus(b) !== "unscheduled");
  const unscheduled = filtered.filter(
    (b) => computeStatus(b) === "unscheduled",
  );
  const overdueCount = filtered.filter(
    (b) => computeStatus(b) === "overdue",
  ).length;

  const plannableJobs = useMemo(
    () =>
      jobs.filter(
        (j) =>
          j.status === "approved" &&
          j.material_status?.status === "material_ready",
      ),
    [jobs],
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarRange className="h-5 w-5" />
          <div>
            <h1 className="text-2xl font-semibold">Production Planning</h1>
            <p className="text-sm text-muted-foreground">
              Forward planning batch produksi. Bar = rencana mulai → selesai.
              Berlian ungu = estimasi kirim.
            </p>
          </div>
        </div>
        {canPlan && (
          <div className="flex items-center gap-2">
            <Select
              value={selectedJob?.id ?? ""}
              onValueChange={(v) => {
                const j = plannableJobs.find((x) => x.id === v) ?? null;
                setSelectedJob(j);
                if (j) setCreateOpen(true);
              }}
            >
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Pilih Engineering Job (approved & material ready)..." />
              </SelectTrigger>
              <SelectContent>
                {plannableJobs.length === 0 ? (
                  <div className="px-2 py-3 text-xs text-muted-foreground">
                    Belum ada job yang siap di-release.
                  </div>
                ) : (
                  plannableJobs.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.job_number} · {j.sales_order_item?.item_name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button
              onClick={() => {
                if (selectedJob) setCreateOpen(true);
              }}
              disabled={!selectedJob}
            >
              <Plus className="h-4 w-4 mr-1" /> Buat Batch
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <Input
          placeholder="Cari batch/item/SO/customer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          value={customerId}
          onValueChange={(v) => {
            setCustomerId(v);
            setSoId("all");
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Customer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua customer</SelectItem>
            {customers.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={soId} onValueChange={setSoId}>
          <SelectTrigger>
            <SelectValue placeholder="Sales Order" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua SO</SelectItem>
            {salesOrders.map(([id, no]) => (
              <SelectItem key={id} value={id}>
                {no}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua status</SelectItem>
            <SelectItem value="unscheduled">Belum Dijadwalkan</SelectItem>
            <SelectItem value="on_track">On-track</SelectItem>
            <SelectItem value="overdue">Terlambat</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={viewMode}
          onValueChange={(v) => setViewMode(v as ViewMode)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Skala" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ViewMode.Week}>Weekly</SelectItem>
            <SelectItem value={ViewMode.Month}>Monthly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge
          variant="outline"
          className="border-blue-300 bg-blue-100 text-blue-800"
        >
          Bar biru = rencana on-track
        </Badge>
        <Badge
          variant="outline"
          className="border-red-300 bg-red-100 text-red-800"
        >
          Bar merah = terlambat dari rencana
        </Badge>
        <Badge
          variant="outline"
          className="border-purple-300 bg-purple-100 text-purple-800"
        >
          ◆ Berlian ungu = estimasi kirim (bukan data Delivery)
        </Badge>
        {overdueCount > 0 && (
          <span className="inline-flex items-center gap-1 text-red-600">
            <AlertTriangle className="h-3.5 w-3.5" /> {overdueCount} batch
            terlambat
          </span>
        )}
      </div>

      {unscheduled.length > 0 && (
        <div className="rounded-xl border p-4 space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Belum Dijadwalkan</h2>
            <Badge variant="secondary">{unscheduled.length}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Batch berikut belum punya <em>rencana mulai</em> atau{" "}
            <em>rencana selesai</em>. Klik untuk mengisi jadwal.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {unscheduled.map((b) => (
              <button
                key={b.id}
                onClick={() => {
                  setSelectedBatch(b);
                  setEditOpen(true);
                }}
                className="text-left rounded-lg border p-3 hover:bg-muted/50 transition"
              >
                <div className="font-mono text-sm">{b.batch_number}</div>
                <div className="text-sm">
                  {b.engineering_job?.sales_order_item?.item_name}
                </div>
                <div className="text-xs text-muted-foreground">
                  Qty {Number(b.quantity)} · SO{" "}
                  {b.engineering_job?.sales_order_item?.sales_order?.so_number}{" "}
                  ·{" "}
                  {b.engineering_job?.sales_order_item?.sales_order?.customer
                    ?.name ?? "—"}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <PlanningGantt
          batches={scheduled}
          viewMode={viewMode}
          onSelect={(b) => {
            setSelectedBatch(b);
            setEditOpen(true);
          }}
        />
      )}

      <p className="text-xs text-muted-foreground">
        Badge tahapan aktif di nama bar diambil dari step berstatus{" "}
        <em>{STEP_STATUS_LABEL.running}</em> (
        {Object.values(PROCESS_LABEL).join(" / ")}).
      </p>

      <CreateBatchDialog
        job={selectedJob}
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o);
          if (!o) setSelectedJob(null);
        }}
      />
      <EditBatchPlanDialog
        batch={selectedBatch}
        open={editOpen}
        onOpenChange={setEditOpen}
        canEdit={canPlan}
      />
    </div>
  );
}
