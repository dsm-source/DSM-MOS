// src/features/production/components/production-board.tsx
import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Package, Search, X } from "lucide-react";
import { toast } from "sonner";
import { notifyError } from "@/lib/error-message";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { BoardColumn } from "./board-column";
import { BatchCard } from "./batch-card";
import { StepOperatorDialog } from "./step-operator-dialog";
import {
  BOARD_COLUMNS,
  assignColumn,
  canDropOn,
  isAtRisk,
  type ColumnId,
} from "../lib/board-columns";
import { activeStep } from "../lib/batch-progress";
import { computeStartBlocker } from "../lib/start-blocker";
import type { StepAction } from "../lib/step-actions";
import type { BatchWithContext } from "../hooks/use-batches";
import { useUpdateBatchStep } from "../hooks/use-batch-steps";
import { useOperators } from "@/features/operators/hooks/use-operators";
import type { ProductionBatchStepRow } from "../types";

export type BoardFilters = {
  q: string;
  customer: string;
  so: string;
  blocked: boolean;
  due: boolean;
};

type ProductionBoardProps = {
  batches: BatchWithContext[];
  canWrite: boolean;
  filters: BoardFilters;
  onFiltersChange: (patch: Partial<BoardFilters>) => void;
  onOpenDetail: (batch: BatchWithContext) => void;
};

function matchesQuery(batch: BatchWithContext, q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const item = batch.engineering_job?.sales_order_item;
  const so = item?.sales_order;
  return [
    batch.batch_number,
    item?.item_name,
    so?.so_number,
    so?.customer?.name,
  ]
    .filter(Boolean)
    .some((v) => String(v).toLowerCase().includes(s));
}

export function ProductionBoard({
  batches,
  canWrite,
  filters,
  onFiltersChange,
  onOpenDetail,
}: ProductionBoardProps) {
  const update = useUpdateBatchStep();
  const { data: operators = [] } = useOperators();
  const [pending, setPending] = useState<{
    batchId: string;
    stepId: string;
  } | null>(null);
  const [operatorDialog, setOperatorDialog] = useState<{
    step: ProductionBatchStepRow;
    action: StepAction;
  } | null>(null);

  // Local input mirror, debounced into the `q` filter (see sales-orders.index.tsx).
  const [searchInput, setSearchInput] = useState(filters.q);
  useEffect(() => setSearchInput(filters.q), [filters.q]);
  useEffect(() => {
    if (searchInput === filters.q) return;
    const t = setTimeout(() => {
      onFiltersChange({ q: searchInput });
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput, filters.q, onFiltersChange]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 6 },
    }),
    useSensor(KeyboardSensor),
  );

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
      if (filters.customer !== "all" && so.customer?.id !== filters.customer)
        continue;
      m.set(so.id, so.so_number);
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [batches, filters.customer]);

  const filtered = useMemo(() => {
    return batches.filter((b) => {
      if (!matchesQuery(b, filters.q)) return false;
      const so = b.engineering_job?.sales_order_item?.sales_order;
      if (filters.customer !== "all" && so?.customer?.id !== filters.customer)
        return false;
      if (filters.so !== "all" && so?.id !== filters.so) return false;
      if (filters.blocked) {
        const act = activeStep(b.steps);
        if (!act || !computeStartBlocker(act, b)) return false;
      }
      if (filters.due && !isAtRisk(b)) return false;
      return true;
    });
  }, [batches, filters]);

  const byColumn = useMemo(() => {
    const map = new Map<ColumnId, BatchWithContext[]>();
    for (const col of BOARD_COLUMNS) map.set(col.id, []);
    for (const b of filtered) map.get(assignColumn(b))!.push(b);
    // Selesai: newest first
    map
      .get("selesai")!
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return map;
  }, [filtered]);

  async function runComplete(stepId: string) {
    const batch = filtered.find((b) => b.id === pending?.batchId);
    if (!batch || activeStep(batch.steps)?.id !== stepId) {
      toast.error("Tahapan sudah berubah, coba lagi");
      setPending(null);
      return;
    }
    try {
      await update.mutateAsync({ id: stepId, status: "completed" });
      toast.success("Tahapan selesai");
    } catch (e) {
      notifyError(e, { title: "Gagal menyelesaikan tahapan" });
    } finally {
      setPending(null);
    }
  }

  async function runAction(
    step: ProductionBatchStepRow,
    action: StepAction,
    operatorId?: string,
  ) {
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
      setOperatorDialog(null);
    }
  }

  function handleAction(step: ProductionBatchStepRow, action: StepAction) {
    if (!canWrite || update.isPending) return;
    if (action.needsOperator) {
      setOperatorDialog({ step, action });
      return;
    }
    void runAction(step, action);
  }

  function handleDragEnd(event: DragEndEvent) {
    const batch = filtered.find((b) => b.id === event.active.id);
    const target = event.over?.id as ColumnId | undefined;
    if (!batch || !target) return;
    if (!canDropOn(batch, target)) {
      toast.error("Batch hanya bisa dipindahkan ke tahapan berikutnya");
      return;
    }
    const act = activeStep(batch.steps);
    if (act) setPending({ batchId: batch.id, stepId: act.id });
  }

  if (batches.length === 0) {
    return (
      <div className="rounded-xl border">
        <EmptyState
          icon={Package}
          title="Belum ada batch produksi"
          description="Batch muncul di sini setelah dibuat oleh Production Planning."
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8 pr-8"
            placeholder="Cari batch, item, SO, customer..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {searchInput && (
            <button
              type="button"
              aria-label="Bersihkan pencarian"
              onClick={() => setSearchInput("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select
          value={filters.customer}
          onValueChange={(v) => onFiltersChange({ customer: v, so: "all" })}
        >
          <SelectTrigger className="w-[180px]">
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
        <Select
          value={filters.so}
          onValueChange={(v) => onFiltersChange({ so: v })}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="SO" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua SO</SelectItem>
            {salesOrders.map(([id, num]) => (
              <SelectItem key={id} value={id}>
                {num}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          variant={filters.blocked ? "default" : "outline"}
          onClick={() => onFiltersChange({ blocked: !filters.blocked })}
        >
          Terblokir
        </Button>
        <Button
          type="button"
          size="sm"
          variant={filters.due ? "default" : "outline"}
          onClick={() => onFiltersChange({ due: !filters.due })}
        >
          Mepet deadline
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        onDragEnd={handleDragEnd}
        accessibility={{
          announcements: {
            onDragStart: ({ active }) =>
              `Mengangkat batch. Pakai panah untuk pilih kolom tujuan, spasi untuk jatuhkan. (${String(active.id)})`,
            onDragOver: ({ over }) =>
              over
                ? `Di atas kolom ${BOARD_COLUMNS.find((c) => c.id === over.id)?.label ?? ""}.`
                : "Belum di atas kolom.",
            onDragEnd: ({ over }) =>
              over
                ? `Menjatuhkan di kolom ${BOARD_COLUMNS.find((c) => c.id === over.id)?.label ?? ""}.`
                : "Dibatalkan.",
            onDragCancel: () => "Membatalkan pemindahan.",
          },
        }}
      >
        <div className="flex gap-2 overflow-x-auto pb-2">
          {BOARD_COLUMNS.map((col) => {
            const items = byColumn.get(col.id) ?? [];
            return (
              <BoardColumn
                key={col.id}
                id={col.id}
                label={col.label}
                count={items.length}
                collapsible={col.id === "selesai"}
              >
                {items.map((b) => {
                  const act = activeStep(b.steps);
                  const opName = operators.find(
                    (o) => o.id === act?.operator_id,
                  )?.name;
                  return (
                    <BatchCard
                      key={b.id}
                      batch={b}
                      canWrite={canWrite}
                      operatorName={opName}
                      isPending={update.isPending}
                      pendingComplete={
                        pending?.batchId === b.id ? pending.stepId : null
                      }
                      onOpen={() => onOpenDetail(b)}
                      onAction={handleAction}
                      onConfirmComplete={runComplete}
                      onCancelComplete={() => setPending(null)}
                    />
                  );
                })}
              </BoardColumn>
            );
          })}
        </div>
      </DndContext>

      {operatorDialog && (
        <StepOperatorDialog
          open
          onOpenChange={(o) => !o && setOperatorDialog(null)}
          title={operatorDialog.action.label}
          confirmLabel={operatorDialog.action.confirmLabel}
          defaultOperatorId={operatorDialog.step.operator_id}
          isPending={update.isPending}
          onConfirm={(operatorId) =>
            void runAction(
              operatorDialog.step,
              operatorDialog.action,
              operatorId,
            )
          }
        />
      )}
    </div>
  );
}
