# Production Board Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-batch dropdown view on `/production` with a 7-column production control board where every batch is visible in the column of its active process step, and dragging a card to the next column completes that step.

**Architecture:** Pure column-assignment logic in `lib/board-columns.ts` (fully unit-tested). Presentation split into `BatchCard` (one batch, revived from the currently-unused component), `BoardColumn` (one column, droppable), and `ProductionBoard` (container: query, filters, `DndContext`, drop handling). The route wires filter state through TanStack Router search params. All data comes from the existing `useProductionBatches()` (already realtime, already loads everything needed); mutations use the existing `useUpdateBatchStep()` (already optimistic with rollback).

**Tech Stack:** React 19, TanStack Router + Query, `@dnd-kit/core`, Tailwind v4, shadcn/ui, Supabase, Vitest + Testing Library.

## Global Constraints

- Reply/UI language: **Bahasa Indonesia** for all user-facing strings. Code, identifiers, commit messages, code comments: English.
- Page title typography goes through the shared `PageHeader` component — never a bare `<h1 className="text-2xl...">`.
- Bordered container panels use `rounded-xl` (matches shadcn `Card`).
- Filter / list state that a user would refresh or share lives in **URL search params**, validated via `validateSearch` — follow the pattern in `src/routes/_authenticated/sales-orders.index.tsx`.
- Icon-only buttons must have an `aria-label`.
- No DB / RLS / trigger changes. Rework (moving a step backward) stays a QC/admin RPC — out of scope here.
- Lint clean (`bun run lint` → 0 errors), types clean (`npx tsc --noEmit` → 0 errors). The pre-existing 5 failures in `blocker-history.test.tsx` are a known jsdom setup issue — not caused by this work, do not attempt to fix them here.
- Commit format ends with:
  `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`

---

## File Structure

| File | Responsibility |
|---|---|
| `src/features/production/lib/board-columns.ts` *(new)* | Pure functions: which column a batch belongs in, whether it can be dragged, what its valid drop target is, whether it is at deadline risk. No React. |
| `src/features/production/lib/board-columns.test.ts` *(new)* | Unit tests for the above. |
| `src/features/production/components/batch-card.tsx` *(rewrite — currently unused)* | One batch card: identity, qty, active-step badge + duration, mini 5-stage strip, coloured target-completion line, blocker box, per-status action buttons, drag handle, inline drop-confirm popover. Click body → open drawer. |
| `src/features/production/components/batch-card.test.tsx` *(new)* | Render-state + confirm-flow tests. |
| `src/features/production/components/board-column.tsx` *(new)* | One column: header (label + count), droppable body, collapsible variant for "Selesai" (state in `localStorage`). |
| `src/features/production/components/production-board.tsx` *(new)* | Container: reads `useProductionBatches()`, applies filters (from props), derives columns, renders one `DndContext` with pointer/keyboard/touch sensors + Indonesian announcements, handles drop → inline confirm → `useUpdateBatchStep`, renders the filter bar. |
| `src/routes/_authenticated/production.tsx` *(modify)* | Add `validateSearch`; replace `<KanbanBoard>` with `<ProductionBoard>`; pass filter values from `Route.useSearch()`. |
| `src/features/production/components/kanban-board.tsx` *(delete)* | Replaced entirely. |

### Existing code reused unchanged (do not modify)

- `hooks/use-batches.ts` — `useProductionBatches()`, `BatchWithContext`
- `hooks/use-batch-steps.ts` — `useUpdateBatchStep()` (input `{ id, status, operator_id?, qty_completed?, notes? }`, already optimistic + rollback)
- `hooks/use-operators.ts` — `useOperators()` → `OperatorRow[]`
- `lib/batch-progress.ts` — `activeStep(steps)`, `isBatchDone(steps)`
- `lib/start-blocker.ts` — `computeStartBlocker(step, batch)` → `null | { message, kind }`
- `lib/planning-status.ts` — `computeStatus(batch)` → `"on_track" | "overdue" | "unscheduled"`
- `lib/process.ts` — `PROCESS_LABEL`, `STEP_STATUS_LABEL`, `formatDurationSince(iso)`
- `lib/step-actions.ts` — `actionsFor(status)` → `StepAction[]`, `isActionDisabled(step, batch, action, isPending)`, type `StepAction { key, label, icon, toStatus, needsOperator, confirmLabel?, variant? }`
- `components/step-status-badge.tsx` — `<StepStatusBadge status />`
- `components/step-operator-dialog.tsx` — `<StepOperatorDialog open onOpenChange title confirmLabel? defaultOperatorId? isPending onConfirm />`
- `components/batch-detail-drawer.tsx` — `<BatchDetailDrawer batch onClose canWrite />`
- `components/empty-state.tsx` — `<EmptyState icon title description? />`
- `components/error-notice.tsx` — `<ErrorNotice error />`
- `lib/error-message.ts` — `notifyError(e, { title })`
- `types.ts` — `PRODUCTION_PROCESSES: ProductionProcess[]` (order: laser_cutting, bending, welding_grinding, powder_coating, assembly), `ProductionBatchStepRow`, `ProductionProcess`

### Data shapes (from `src/integrations/supabase/types.ts`)

```ts
// ProductionBatchStepRow
{ id: string; production_batch_id: string; process: ProductionProcess;
  sequence_order: number; status: ProductionStepStatus;
  operator_id: string | null; qty_completed: number;
  started_at: string | null; paused_at: string | null; completed_at: string | null;
  notes: string | null; created_at: string; updated_at: string }

// BatchWithContext (production_batches Row + relations)
{ id: string; batch_number: string; quantity: number;
  planned_start_date: string | null; planned_completion_date: string | null;
  estimated_delivery_date: string | null; notes: string | null;
  updated_at: string; created_at: string;
  engineering_job: {
    id: string; job_number: string; status: string;
    sales_order_item: {
      id: string; item_name: string; quantity: number; unit: string | null;
      sales_order: { id: string; so_number: string;
        customer: { id: string; name: string } | null } | null;
    } | null;
    material_status: { status: string } | null;
  } | null;
  steps: ProductionBatchStepRow[];   // already sorted by sequence_order asc
}
```

Note: the batch's routing *instance* is its `steps` array (already sorted). Do not parse the `routing` JSON column — use `steps`.

---

## Task 1: Column-assignment logic (`board-columns.ts`)

**Files:**
- Create: `src/features/production/lib/board-columns.ts`
- Test: `src/features/production/lib/board-columns.test.ts`

**Interfaces:**
- Consumes: `activeStep`, `isBatchDone` from `../lib/batch-progress`; `computeStartBlocker` from `../lib/start-blocker`; `computeStatus` from `../lib/planning-status`; `PRODUCTION_PROCESSES`, types from `../types`; `BatchWithContext` from `../hooks/use-batches`.
- Produces:
  - `type ColumnId = "antrian" | ProductionProcess | "selesai"`
  - `const BOARD_COLUMNS: { id: ColumnId; label: string }[]` — ordered: Antrian, then the 5 processes in `PRODUCTION_PROCESSES` order (labels from `PROCESS_LABEL`), then Selesai
  - `assignColumn(batch: BatchWithContext): ColumnId`
  - `isDraggable(batch: BatchWithContext): boolean`
  - `nextColumnFor(batch: BatchWithContext): ColumnId | null` — the single valid drop target when `isDraggable(batch)`, else `null`
  - `canDropOn(batch: BatchWithContext, target: ColumnId): boolean`
  - `isAtRisk(batch: BatchWithContext): boolean` — for the "Mepet deadline" filter and the card's target line

- [ ] **Step 1: Write the failing test**

```ts
// src/features/production/lib/board-columns.test.ts
import { describe, it, expect } from "vitest";
import {
  BOARD_COLUMNS,
  assignColumn,
  isDraggable,
  nextColumnFor,
  canDropOn,
  isAtRisk,
} from "./board-columns";
import type { BatchWithContext } from "../hooks/use-batches";
import type {
  ProductionBatchStepRow,
  ProductionProcess,
  ProductionStepStatus,
} from "../types";

function step(
  process: ProductionProcess,
  sequence_order: number,
  status: ProductionStepStatus,
): ProductionBatchStepRow {
  return {
    id: `s-${process}-${sequence_order}`,
    production_batch_id: "b1",
    process,
    sequence_order,
    status,
    operator_id: null,
    qty_completed: 0,
    started_at: null,
    paused_at: null,
    completed_at: null,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function batch(
  steps: ProductionBatchStepRow[],
  overrides: Partial<BatchWithContext> = {},
): BatchWithContext {
  return {
    id: "b1",
    batch_number: "BATCH-2026-0001",
    quantity: 5,
    planned_start_date: "2026-01-01",
    planned_completion_date: "2026-12-31",
    estimated_delivery_date: null,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    engineering_job: {
      id: "j1",
      job_number: "ENG-1",
      status: "approved",
      sales_order_item: {
        id: "i1",
        item_name: "Item",
        quantity: 5,
        unit: "pcs",
        sales_order: { id: "so1", so_number: "SO-1", customer: { id: "c1", name: "Cust" } },
      },
      material_status: { status: "material_ready" },
    },
    steps,
    ...overrides,
  } as BatchWithContext;
}

const FULL: [ProductionProcess, number][] = [
  ["laser_cutting", 1],
  ["bending", 2],
  ["welding_grinding", 3],
  ["powder_coating", 4],
  ["assembly", 5],
];

describe("BOARD_COLUMNS", () => {
  it("is Antrian, 5 processes in order, Selesai", () => {
    expect(BOARD_COLUMNS.map((c) => c.id)).toEqual([
      "antrian",
      "laser_cutting",
      "bending",
      "welding_grinding",
      "powder_coating",
      "assembly",
      "selesai",
    ]);
  });
});

describe("assignColumn", () => {
  it("all steps completed/skipped -> selesai", () => {
    const b = batch(FULL.map(([p, o]) => step(p, o, o === 3 ? "skipped" : "completed")));
    expect(assignColumn(b)).toBe("selesai");
  });

  it("every step still waiting -> antrian", () => {
    const b = batch(FULL.map(([p, o]) => step(p, o, "waiting")));
    expect(assignColumn(b)).toBe("antrian");
  });

  it("step 2 running -> that step's process column", () => {
    const b = batch([
      step("laser_cutting", 1, "completed"),
      step("bending", 2, "running"),
      step("welding_grinding", 3, "waiting"),
    ]);
    expect(assignColumn(b)).toBe("bending");
  });

  it("step 1 skipped, step 2 waiting -> step 2 process, not antrian", () => {
    const b = batch([
      step("laser_cutting", 1, "skipped"),
      step("bending", 2, "waiting"),
    ]);
    expect(assignColumn(b)).toBe("bending");
  });

  it("custom routing without powder_coating -> never returns powder_coating", () => {
    const b = batch([
      step("laser_cutting", 1, "completed"),
      step("welding_grinding", 2, "running"),
      step("assembly", 3, "waiting"),
    ]);
    expect(assignColumn(b)).toBe("welding_grinding");
  });
});

describe("isDraggable / nextColumnFor / canDropOn", () => {
  it("running, not blocked, mid-routing -> draggable, next process is target", () => {
    const b = batch([
      step("laser_cutting", 1, "completed"),
      step("bending", 2, "running"),
      step("welding_grinding", 3, "waiting"),
    ]);
    expect(isDraggable(b)).toBe(true);
    expect(nextColumnFor(b)).toBe("welding_grinding");
    expect(canDropOn(b, "welding_grinding")).toBe(true);
    expect(canDropOn(b, "powder_coating")).toBe(false);
    expect(canDropOn(b, "laser_cutting")).toBe(false);
  });

  it("running on the last step -> target is selesai", () => {
    const b = batch([
      step("laser_cutting", 1, "completed"),
      step("assembly", 2, "running"),
    ]);
    expect(nextColumnFor(b)).toBe("selesai");
    expect(canDropOn(b, "selesai")).toBe(true);
  });

  it("paused -> draggable", () => {
    const b = batch([
      step("laser_cutting", 1, "completed"),
      step("bending", 2, "paused"),
      step("welding_grinding", 3, "waiting"),
    ]);
    expect(isDraggable(b)).toBe(true);
  });

  it("waiting -> not draggable", () => {
    const b = batch([step("laser_cutting", 1, "waiting")]);
    expect(isDraggable(b)).toBe(false);
    expect(nextColumnFor(b)).toBeNull();
    expect(canDropOn(b, "bending")).toBe(false);
  });

  it("blocked (engineering not approved) -> not draggable even if running is impossible", () => {
    const b = batch([step("laser_cutting", 1, "waiting")], {
      engineering_job: {
        id: "j1",
        job_number: "ENG-1",
        status: "in_progress",
        sales_order_item: null,
        material_status: { status: "waiting_material" },
      },
    } as Partial<BatchWithContext>);
    expect(isDraggable(b)).toBe(false);
  });

  it("done batch -> not draggable", () => {
    const b = batch(FULL.map(([p, o]) => step(p, o, "completed")));
    expect(isDraggable(b)).toBe(false);
    expect(nextColumnFor(b)).toBeNull();
  });
});

describe("isAtRisk", () => {
  it("overdue & not done -> true", () => {
    const b = batch([step("laser_cutting", 1, "running")], {
      planned_start_date: "2020-01-01",
      planned_completion_date: "2020-01-05",
    });
    expect(isAtRisk(b)).toBe(true);
  });

  it("completion within 2 days & not done -> true", () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 1);
    const b = batch([step("laser_cutting", 1, "running")], {
      planned_completion_date: soon.toISOString().slice(0, 10),
    });
    expect(isAtRisk(b)).toBe(true);
  });

  it("completion far away -> false", () => {
    const b = batch([step("laser_cutting", 1, "running")], {
      planned_completion_date: "2099-01-01",
    });
    expect(isAtRisk(b)).toBe(false);
  });

  it("done batch -> false even if past due", () => {
    const b = batch(FULL.map(([p, o]) => step(p, o, "completed")), {
      planned_completion_date: "2020-01-01",
    });
    expect(isAtRisk(b)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/features/production/lib/board-columns.test.ts`
Expected: FAIL — `Cannot find module './board-columns'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/features/production/lib/board-columns.ts
import { activeStep, isBatchDone } from "./batch-progress";
import { computeStartBlocker } from "./start-blocker";
import { computeStatus } from "./planning-status";
import { PROCESS_LABEL } from "./process";
import { PRODUCTION_PROCESSES, type ProductionProcess } from "../types";
import type { BatchWithContext } from "../hooks/use-batches";

export type ColumnId = "antrian" | ProductionProcess | "selesai";

export const BOARD_COLUMNS: { id: ColumnId; label: string }[] = [
  { id: "antrian", label: "Antrian" },
  ...PRODUCTION_PROCESSES.map((p) => ({ id: p as ColumnId, label: PROCESS_LABEL[p] })),
  { id: "selesai", label: "Selesai" },
];

export function assignColumn(batch: BatchWithContext): ColumnId {
  if (isBatchDone(batch.steps)) return "selesai";
  if (batch.steps.length > 0 && batch.steps.every((s) => s.status === "waiting")) {
    return "antrian";
  }
  const active = activeStep(batch.steps);
  return (active?.process ?? "antrian") as ColumnId;
}

export function isDraggable(batch: BatchWithContext): boolean {
  const active = activeStep(batch.steps);
  if (!active) return false;
  if (active.status !== "running" && active.status !== "paused") return false;
  if (computeStartBlocker(active, batch)) return false;
  return true;
}

export function nextColumnFor(batch: BatchWithContext): ColumnId | null {
  if (!isDraggable(batch)) return null;
  const active = activeStep(batch.steps)!;
  const next = [...batch.steps]
    .sort((a, b) => a.sequence_order - b.sequence_order)
    .find((s) => s.sequence_order > active.sequence_order && s.status !== "skipped");
  return next ? (next.process as ColumnId) : "selesai";
}

export function canDropOn(batch: BatchWithContext, target: ColumnId): boolean {
  return nextColumnFor(batch) === target;
}

export function isAtRisk(batch: BatchWithContext): boolean {
  if (isBatchDone(batch.steps)) return false;
  if (computeStatus(batch) === "overdue") return true;
  if (!batch.planned_completion_date) return false;
  const end = new Date(batch.planned_completion_date + "T00:00:00").getTime();
  const twoDays = Date.now() + 2 * 24 * 60 * 60 * 1000;
  return end <= twoDays;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/features/production/lib/board-columns.test.ts`
Expected: PASS — all cases green.

- [ ] **Step 5: Typecheck & lint**

Run: `npx tsc --noEmit` → 0 errors. `bun run lint` → 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/production/lib/board-columns.ts src/features/production/lib/board-columns.test.ts
git commit -m "feat(production): board column-assignment logic

$(printf '\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

## Task 2: `BatchCard` — revive and expand

**Files:**
- Rewrite: `src/features/production/components/batch-card.tsx` (currently exists, unused, ~135 lines — replace wholesale)
- Test: `src/features/production/components/batch-card.test.tsx`

**Interfaces:**
- Consumes: `ColumnId`, `isDraggable`, `isAtRisk` from `../lib/board-columns`; `activeStep`, `isBatchDone` from `../lib/batch-progress`; `computeStartBlocker` from `../lib/start-blocker`; `computeStatus` from `../lib/planning-status`; `actionsFor`, `isActionDisabled`, type `StepAction` from `../lib/step-actions`; `PROCESS_LABEL`, `formatDurationSince` from `../lib/process`; `StepStatusBadge`; `useDraggable` from `@dnd-kit/core`; `BatchWithContext`, `ProductionBatchStepRow` types.
- Produces:

```ts
type BatchCardProps = {
  batch: BatchWithContext;
  canWrite: boolean;
  operatorName?: string;
  isPending: boolean;          // any mutation in flight -> disable action buttons
  pendingComplete: boolean;    // show the inline "Selesaikan X?" confirm
  onOpen: () => void;
  onAction: (step: ProductionBatchStepRow, action: StepAction) => void;
  onConfirmComplete: (stepId: string) => void;
  onCancelComplete: () => void;
};
export function BatchCard(props: BatchCardProps): JSX.Element;
```

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/production/components/batch-card.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DndContext } from "@dnd-kit/core";
import { BatchCard } from "./batch-card";
import type { BatchWithContext } from "../hooks/use-batches";
import type {
  ProductionBatchStepRow,
  ProductionProcess,
  ProductionStepStatus,
} from "../types";

function step(
  process: ProductionProcess,
  sequence_order: number,
  status: ProductionStepStatus,
): ProductionBatchStepRow {
  return {
    id: `s-${sequence_order}`,
    production_batch_id: "b1",
    process,
    sequence_order,
    status,
    operator_id: null,
    qty_completed: 0,
    started_at: status === "running" ? "2026-01-01T00:00:00Z" : null,
    paused_at: null,
    completed_at: null,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function makeBatch(
  steps: ProductionBatchStepRow[],
  overrides: Partial<BatchWithContext> = {},
): BatchWithContext {
  return {
    id: "b1",
    batch_number: "BATCH-2026-0001",
    quantity: 7,
    planned_start_date: "2026-01-01",
    planned_completion_date: "2099-01-01",
    estimated_delivery_date: null,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    engineering_job: {
      id: "j1",
      job_number: "ENG-1",
      status: "approved",
      sales_order_item: {
        id: "i1",
        item_name: "Panel Pintu Kabinet",
        quantity: 7,
        unit: "pcs",
        sales_order: { id: "so1", so_number: "SO-2026-0064", customer: { id: "c1", name: "PT Sumber Rejeki" } },
      },
      material_status: { status: "material_ready" },
    },
    steps,
    ...overrides,
  } as BatchWithContext;
}

function renderCard(props: Partial<Parameters<typeof BatchCard>[0]> = {}) {
  const base = {
    batch: makeBatch([step("bending", 1, "running")]),
    canWrite: true,
    isPending: false,
    pendingComplete: false,
    onOpen: vi.fn(),
    onAction: vi.fn(),
    onConfirmComplete: vi.fn(),
    onCancelComplete: vi.fn(),
  };
  const merged = { ...base, ...props };
  render(
    <DndContext>
      <BatchCard {...merged} />
    </DndContext>,
  );
  return merged;
}

describe("BatchCard", () => {
  it("shows identity, item, SO/customer, qty", () => {
    renderCard();
    expect(screen.getByText("BATCH-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("Panel Pintu Kabinet")).toBeInTheDocument();
    expect(screen.getByText(/SO-2026-0064/)).toBeInTheDocument();
    expect(screen.getByText(/PT Sumber Rejeki/)).toBeInTheDocument();
    expect(screen.getByText(/7/)).toBeInTheDocument();
  });

  it("running step shows Pause and Complete buttons", () => {
    renderCard({ batch: makeBatch([step("bending", 1, "running")]) });
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Complete" })).toBeInTheDocument();
  });

  it("waiting step shows Start and Skip buttons", () => {
    renderCard({ batch: makeBatch([step("bending", 1, "waiting")]) });
    expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skip" })).toBeInTheDocument();
  });

  it("paused step shows Resume and Complete", () => {
    renderCard({ batch: makeBatch([step("bending", 1, "paused")]) });
    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
  });

  it("done batch shows no action buttons", () => {
    renderCard({ batch: makeBatch([step("assembly", 1, "completed")]) });
    expect(screen.queryByRole("button", { name: "Complete" })).not.toBeInTheDocument();
  });

  it("blocked batch shows blocker box with source link", () => {
    const blocked = makeBatch([step("laser_cutting", 1, "waiting")], {
      engineering_job: {
        id: "j1",
        job_number: "ENG-1",
        status: "approved",
        sales_order_item: null,
        material_status: { status: "waiting_material" },
      },
    } as Partial<BatchWithContext>);
    renderCard({ batch: blocked });
    expect(screen.getByText(/Menunggu material ready/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Material/ })).toHaveAttribute("href", "/material");
  });

  it("overdue batch shows red target line", () => {
    const late = makeBatch([step("bending", 1, "running")], {
      planned_start_date: "2020-01-01",
      planned_completion_date: "2020-01-05",
    });
    renderCard({ batch: late });
    expect(screen.getByText(/Target lewat/)).toBeInTheDocument();
  });

  it("unscheduled batch shows 'Belum dijadwalkan'", () => {
    const un = makeBatch([step("bending", 1, "running")], {
      planned_start_date: null,
      planned_completion_date: null,
    });
    renderCard({ batch: un });
    expect(screen.getByText(/Belum dijadwalkan/)).toBeInTheDocument();
  });

  it("clicking the card body calls onOpen", async () => {
    const props = renderCard();
    await userEvent.click(screen.getByText("Panel Pintu Kabinet"));
    expect(props.onOpen).toHaveBeenCalled();
  });

  it("pendingComplete shows the inline confirm; Ya calls onConfirmComplete with the active step id", async () => {
    const props = renderCard({
      batch: makeBatch([step("bending", 1, "running")]),
      pendingComplete: true,
    });
    expect(screen.getByText(/Selesaikan Bending\?/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Ya" }));
    expect(props.onConfirmComplete).toHaveBeenCalledWith("s-1");
  });

  it("pendingComplete: Batal calls onCancelComplete and not onConfirmComplete", async () => {
    const props = renderCard({
      batch: makeBatch([step("bending", 1, "running")]),
      pendingComplete: true,
    });
    await userEvent.click(screen.getByRole("button", { name: "Batal" }));
    expect(props.onCancelComplete).toHaveBeenCalled();
    expect(props.onConfirmComplete).not.toHaveBeenCalled();
  });

  it("action button click calls onAction with step and action", async () => {
    const props = renderCard({ batch: makeBatch([step("bending", 1, "running")]) });
    await userEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(props.onAction).toHaveBeenCalled();
    const [calledStep, calledAction] = props.onAction.mock.calls[0];
    expect(calledStep.id).toBe("s-1");
    expect(calledAction.key).toBe("pause");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/features/production/components/batch-card.test.tsx`
Expected: FAIL — assertions fail / component still renders the old shape.

- [ ] **Step 3: Write the implementation**

```tsx
// src/features/production/components/batch-card.tsx
import { Package, Lock, ExternalLink, GripVertical } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useDraggable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { StepStatusBadge } from "./step-status-badge";
import {
  PROCESS_LABEL,
  formatDurationSince,
} from "../lib/process";
import { activeStep, isBatchDone } from "../lib/batch-progress";
import { computeStartBlocker } from "../lib/start-blocker";
import { computeStatus } from "../lib/planning-status";
import { actionsFor, isActionDisabled, type StepAction } from "../lib/step-actions";
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
    const rel = days <= 0 ? "hari ini" : days === 1 ? "besok" : `${days} hari lagi`;
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
          <div className="font-medium text-sm truncate">{item?.item_name ?? "—"}</div>
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
                done
                  ? "bg-emerald-500"
                  : now
                    ? "bg-blue-500"
                    : "bg-muted",
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/features/production/components/batch-card.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck, lint, prettier**

Run: `npx prettier --write src/features/production/components/batch-card.tsx src/features/production/components/batch-card.test.tsx`
Run: `npx tsc --noEmit` → 0 errors. `bun run lint` → 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/production/components/batch-card.tsx src/features/production/components/batch-card.test.tsx
git commit -m "feat(production): revive BatchCard with actions, target line, drag handle, inline confirm

$(printf '\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

## Task 3: `BoardColumn` + `ProductionBoard` (assembly)

**Files:**
- Create: `src/features/production/components/board-column.tsx`
- Create: `src/features/production/components/production-board.tsx`
- Test: `src/features/production/components/production-board.test.tsx`

**Interfaces:**
- Consumes: `BOARD_COLUMNS`, `ColumnId`, `assignColumn`, `canDropOn`, `isAtRisk` from `../lib/board-columns`; `activeStep` from `../lib/batch-progress`; `computeStartBlocker` from `../lib/start-blocker`; `PROCESS_LABEL` from `../lib/process`; `actionsFor`, type `StepAction` from `../lib/step-actions`; `BatchCard`; `StepOperatorDialog`; `useProductionBatches`, `BatchWithContext`; `useUpdateBatchStep`; `useOperators`; `EmptyState`; `ErrorNotice`; `notifyError`; `@dnd-kit/core` (`DndContext`, `useDroppable`, sensors); shadcn `Input`, `Select`, `Button`, `Badge`, `Skeleton`; `Package`, `Search`, `X` from lucide.
- Produces:

```ts
// board-column.tsx
type BoardColumnProps = {
  id: ColumnId;
  label: string;
  count: number;
  collapsible?: boolean;          // true only for "selesai"
  children: React.ReactNode;
};
export function BoardColumn(props: BoardColumnProps): JSX.Element;

// production-board.tsx
export type BoardFilters = {
  q: string;
  customer: string;   // "all" | customer id
  so: string;         // "all" | SO id
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
export function ProductionBoard(props: ProductionBoardProps): JSX.Element;
```

- [ ] **Step 1: Write `board-column.tsx`**

```tsx
// src/features/production/components/board-column.tsx
import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ColumnId } from "../lib/board-columns";

const STORAGE_KEY = "dsm-board-selesai-collapsed";

type BoardColumnProps = {
  id: ColumnId;
  label: string;
  count: number;
  collapsible?: boolean;
  children: React.ReactNode;
};

export function BoardColumn({ id, label, count, collapsible, children }: BoardColumnProps) {
  const [collapsed, setCollapsed] = useState(() => {
    if (!collapsible) return false;
    try {
      return localStorage.getItem(STORAGE_KEY) !== "false";
    } catch {
      return true;
    }
  });
  const { setNodeRef, isOver } = useDroppable({ id });

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border bg-card",
        collapsible && collapsed ? "w-11 shrink-0" : "w-[220px] shrink-0",
        isOver && "ring-2 ring-[#D81E1C]",
      )}
    >
      <button
        type="button"
        onClick={collapsible ? toggle : undefined}
        aria-expanded={collapsible ? !collapsed : undefined}
        className={cn(
          "flex items-center justify-between gap-2 px-3 py-2 text-xs font-bold border-b",
          collapsible && collapsed && "flex-col h-full [writing-mode:vertical-rl]",
          !collapsible && "cursor-default",
        )}
      >
        <span className="flex items-center gap-1">
          {collapsible && (collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
          {label}
        </span>
        <span className="rounded-full bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground">
          {count}
        </span>
      </button>
      {!(collapsible && collapsed) && (
        <div
          ref={setNodeRef}
          className="flex-1 min-h-[120px] max-h-[calc(100vh-16rem)] overflow-y-auto p-2 space-y-2"
        >
          {count === 0 ? (
            <div className="text-center text-xs text-muted-foreground/60 py-4">—</div>
          ) : (
            children
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write the failing test for `ProductionBoard`**

```tsx
// src/features/production/components/production-board.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { ProductionBoard, type BoardFilters } from "./production-board";
import type { BatchWithContext } from "../hooks/use-batches";
import type { ProductionBatchStepRow, ProductionProcess, ProductionStepStatus } from "../types";

vi.mock("../hooks/use-operators", () => ({
  useOperators: () => ({ data: [], isLoading: false }),
}));
vi.mock("../hooks/use-batch-steps", () => ({
  useUpdateBatchStep: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function step(process: ProductionProcess, sequence_order: number, status: ProductionStepStatus): ProductionBatchStepRow {
  return {
    id: `s-${process}-${sequence_order}`, production_batch_id: "b", process, sequence_order, status,
    operator_id: null, qty_completed: 0, started_at: null, paused_at: null, completed_at: null,
    notes: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
  };
}
function batch(id: string, name: string, steps: ProductionBatchStepRow[], custName = "Cust"): BatchWithContext {
  return {
    id, batch_number: id.toUpperCase(), quantity: 3,
    planned_start_date: "2026-01-01", planned_completion_date: "2099-01-01",
    estimated_delivery_date: null, notes: null,
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    engineering_job: {
      id: "j-" + id, job_number: "ENG", status: "approved",
      sales_order_item: {
        id: "i", item_name: name, quantity: 3, unit: "pcs",
        sales_order: { id: "so-" + id, so_number: "SO-" + id, customer: { id: "c-" + custName, name: custName } },
      },
      material_status: { status: "material_ready" },
    },
    steps,
  } as BatchWithContext;
}

const filters: BoardFilters = { q: "", customer: "all", so: "all", blocked: false, due: false };

function renderBoard(batches: BatchWithContext[], f: Partial<BoardFilters> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rootRoute = createRootRoute();
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => (
      <ProductionBoard
        batches={batches}
        canWrite
        filters={{ ...filters, ...f }}
        onFiltersChange={vi.fn()}
        onOpenDetail={vi.fn()}
      />
    ),
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("ProductionBoard", () => {
  it("places a running batch in its process column", async () => {
    renderBoard([
      batch("b1", "Rangka Motor", [step("laser_cutting", 1, "completed"), step("bending", 2, "running")]),
      batch("b2", "Cover Plate", [step("laser_cutting", 1, "waiting"), step("bending", 2, "waiting")]),
    ]);
    // wait for async router render
    expect(await screen.findByText("Rangka Motor")).toBeInTheDocument();
    // Antrian column shows the not-started batch
    expect(screen.getByText("Cover Plate")).toBeInTheDocument();
  });

  it("q filter narrows visible cards", async () => {
    renderBoard(
      [
        batch("b1", "Rangka Motor", [step("bending", 1, "running")]),
        batch("b2", "Cover Plate", [step("bending", 1, "running")]),
      ],
      { q: "rangka" },
    );
    expect(await screen.findByText("Rangka Motor")).toBeInTheDocument();
    expect(screen.queryByText("Cover Plate")).not.toBeInTheDocument();
  });

  it("empty batch list shows EmptyState", async () => {
    renderBoard([]);
    expect(await screen.findByText(/Belum ada batch produksi/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bunx vitest run src/features/production/components/production-board.test.tsx`
Expected: FAIL — `Cannot find module './production-board'`.

- [ ] **Step 4: Write `production-board.tsx`**

```tsx
// src/features/production/components/production-board.tsx
import { useMemo, useState } from "react";
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
import { PROCESS_LABEL } from "../lib/process";
import type { StepAction } from "../lib/step-actions";
import { useProductionBatches, type BatchWithContext } from "../hooks/use-batches";
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
  const [pending, setPending] = useState<{ batchId: string; stepId: string } | null>(null);
  const [operatorDialog, setOperatorDialog] = useState<{
    step: ProductionBatchStepRow;
    action: StepAction;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
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
      if (filters.customer !== "all" && so.customer?.id !== filters.customer) continue;
      m.set(so.id, so.so_number);
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [batches, filters.customer]);

  const filtered = useMemo(() => {
    return batches.filter((b) => {
      if (!matchesQuery(b, filters.q)) return false;
      const so = b.engineering_job?.sales_order_item?.sales_order;
      if (filters.customer !== "all" && so?.customer?.id !== filters.customer) return false;
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
    map.get("selesai")!.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return map;
  }, [filtered]);

  async function runComplete(stepId: string) {
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
            value={filters.q}
            onChange={(e) => onFiltersChange({ q: e.target.value })}
          />
          {filters.q && (
            <button
              type="button"
              aria-label="Bersihkan pencarian"
              onClick={() => onFiltersChange({ q: "" })}
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
              <SelectItem key={id} value={id}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.so} onValueChange={(v) => onFiltersChange({ so: v })}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="SO" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua SO</SelectItem>
            {salesOrders.map(([id, num]) => (
              <SelectItem key={id} value={id}>{num}</SelectItem>
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
                  const opName = operators.find((o) => o.id === act?.operator_id)?.name;
                  return (
                    <BatchCard
                      key={b.id}
                      batch={b}
                      canWrite={canWrite}
                      operatorName={opName}
                      isPending={update.isPending}
                      pendingComplete={pending?.batchId === b.id}
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
            void runAction(operatorDialog.step, operatorDialog.action, operatorId)
          }
        />
      )}
    </div>
  );
}
```

> The board receives `batches` as a prop; the route owns the query and renders `<ErrorNotice>` itself (Task 4). The board does not import or render `ErrorNotice`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `bunx vitest run src/features/production/components/production-board.test.tsx src/features/production/components/batch-card.test.tsx src/features/production/lib/board-columns.test.ts`
Expected: PASS (all three files).

- [ ] **Step 6: Typecheck, lint, prettier**

Run: `npx prettier --write "src/features/production/components/board-column.tsx" "src/features/production/components/production-board.tsx" "src/features/production/components/production-board.test.tsx"`
Run: `npx tsc --noEmit` → 0 errors. `bun run lint` → 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/features/production/components/board-column.tsx src/features/production/components/production-board.tsx src/features/production/components/production-board.test.tsx
git commit -m "feat(production): BoardColumn + ProductionBoard 7-column control board

$(printf '\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

## Task 4: Wire route, add search params, delete old kanban, verify in browser

**Files:**
- Modify: `src/routes/_authenticated/production.tsx`
- Delete: `src/features/production/components/kanban-board.tsx`

**Interfaces:**
- Consumes: `ProductionBoard`, `BoardFilters` from `../features/production/components/production-board`; `useProductionBatches`, `BatchWithContext`; `BatchDetailDrawer`; `PageHeader`; `Skeleton`; `ErrorNotice`; `useMyRoles`.

- [ ] **Step 1: Rewrite the route**

```tsx
// src/routes/_authenticated/production.tsx
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorNotice } from "@/components/error-notice";
import { useMyRoles } from "@/hooks/use-my-roles";
import {
  useProductionBatches,
  type BatchWithContext,
} from "@/features/production/hooks/use-batches";
import {
  ProductionBoard,
  type BoardFilters,
} from "@/features/production/components/production-board";
import { BatchDetailDrawer } from "@/features/production/components/batch-detail-drawer";

type ProdSearch = BoardFilters;

export const Route = createFileRoute("/_authenticated/production")({
  validateSearch: (search: Record<string, unknown>): ProdSearch => ({
    q: typeof search.q === "string" ? search.q : "",
    customer: typeof search.customer === "string" ? search.customer : "all",
    so: typeof search.so === "string" ? search.so : "all",
    blocked: search.blocked === true || search.blocked === "true",
    due: search.due === true || search.due === "true",
  }),
  head: () => ({
    meta: [
      { title: "Production — DSM MOS" },
      {
        name: "description",
        content: "Papan kontrol produksi shop floor: kolom per proses.",
      },
      { property: "og:title", content: "Production — DSM MOS" },
      {
        property: "og:description",
        content: "Papan kontrol produksi shop floor DSM MOS.",
      },
    ],
  }),
  component: ProductionPage,
});

function ProductionPage() {
  const { hasAnyRole } = useMyRoles();
  const canWrite = hasAnyRole(["admin", "production"]);
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: batches = [], isLoading, isError, error } = useProductionBatches();
  const [openBatch, setOpenBatch] = useState<BatchWithContext | null>(null);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Production"
        description="Board kontrol per proses. Seret kartu ke kolom berikutnya untuk menyelesaikan tahapan."
      />

      {isError ? (
        <ErrorNotice error={error} />
      ) : isLoading ? (
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-[220px] shrink-0" />
          ))}
        </div>
      ) : (
        <ProductionBoard
          batches={batches}
          canWrite={canWrite}
          filters={search}
          onFiltersChange={(patch) =>
            navigate({ search: (prev) => ({ ...prev, ...patch }) })
          }
          onOpenDetail={setOpenBatch}
        />
      )}

      <BatchDetailDrawer
        batch={openBatch}
        onClose={() => setOpenBatch(null)}
        canWrite={canWrite}
      />
    </div>
  );
}
```

- [ ] **Step 2: Delete the old kanban board**

```bash
git rm src/features/production/components/kanban-board.tsx
```

- [ ] **Step 3: Grep for stragglers**

Run: `grep -rn "kanban-board\|KanbanBoard\|KanbanCell\|ActionDropButton" src`
Expected: no matches. If the old `kanban-board.tsx` had a test, delete it too and re-check.

- [ ] **Step 4: Typecheck, lint, prettier, full test run**

Run: `npx prettier --write src/routes/_authenticated/production.tsx`
Run: `npx tsc --noEmit` → 0 errors.
Run: `bun run lint` → 0 errors (37 pre-existing `react-refresh` warnings are acceptable; 0 errors).
Run: `bunx vitest run` → the 3 new files pass; the only failures are the 5 pre-existing in `blocker-history.test.tsx`.

- [ ] **Step 5: Browser verification**

Start the dev server and log in (test user `test@dsm.com` / `admin 1234` on the local Supabase stack).

1. `preview_start` name `dsm-mos-dev`, navigate `/production`.
2. Confirm: 7 columns render (Antrian … Selesai); Selesai is collapsed.
3. A `running` batch card sits in its process column with Pause/Complete buttons; a not-started batch sits in Antrian with a Start button; a blocked batch shows the amber blocker box and no drag handle.
4. Target line: find an overdue batch (or edit `planned_completion_date` via SQL on the local stack) → red "Target lewat".
5. Drag a `running` card to the immediately-next column → inline "Selesaikan {proses}? Ya/Batal" appears → click Ya → card moves to next column, toast "Tahapan selesai". Try dragging two columns ahead → drop rejected, toast.
6. Type in search → cards filter across all columns; URL gains `?q=…`; refresh keeps it.
7. Toggle "Terblokir" / "Mepet deadline" chips → filtering works, URL reflects it.
8. Click a card body → `BatchDetailDrawer` opens.
9. `resize_window` mobile (375) → columns scroll horizontally, no body horizontal scroll.
10. Toggle dark mode → board readable.
11. `read_console_messages` (fresh tab) → no errors. `preview_logs` → no server errors.

- [ ] **Step 6: Update the audit backlog doc**

In `tasks/ui-ux-audit-plan.md` and `tasks/ui-ux-audit-todo.md`, mark the Phase 4 "Redesign Kanban jadi board kolom-per-proses" item as done, referencing this plan + spec.

- [ ] **Step 7: Commit**

```bash
git add src/routes/_authenticated/production.tsx tasks/ui-ux-audit-plan.md tasks/ui-ux-audit-todo.md
git commit -m "feat(production): switch /production to the 7-column control board

Replaces the single-batch dropdown Kanban with ProductionBoard. Filter
state (q/customer/so/blocked/due) lives in URL search params. Deletes the
old kanban-board.tsx.

$(printf '\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>')"
```

---

## Self-Review

**Spec coverage:**

| Spec item | Task |
|---|---|
| Model A drag = advance | Task 1 (`nextColumnFor`/`canDropOn`), Task 3 (`handleDragEnd` → pending), Task 2 (confirm popover) |
| Start button + operator dialog; drag only from running/paused | Task 2 (buttons via `actionsFor`), Task 3 (`StepOperatorDialog` wiring), Task 1 (`isDraggable`) |
| 7 columns Antrian…Selesai | Task 1 (`BOARD_COLUMNS`), Task 3 (render) |
| Card content: identity, qty, badge+duration, mini strip, target line, blocker, actions | Task 2 |
| Click body → drawer | Task 2 (`onOpen`), Task 3/4 wiring |
| Filters q/customer/so/blocked/due in URL params | Task 3 (filter bar + logic), Task 4 (`validateSearch`) |
| Inline drop confirm | Task 2 (popover), Task 3 (`pending` state) |
| `assignColumn` rules (done / all-waiting / active process / skipped edge / custom routing) | Task 1 tests |
| `canDropOn` rules (next only, no backward, no skip, blocked, antrian, done) | Task 1 tests |
| Target line colours (overdue/soon/ok/unscheduled) | Task 2 (`targetLine`) + tests |
| Selesai collapsed default, localStorage, newest first | Task 3 (`BoardColumn` collapse + `byColumn` sort) |
| Error / empty / loading states | Task 4 (`ErrorNotice`, skeleton), Task 3 (`EmptyState`) |
| DnD a11y: pointer+keyboard+touch sensors + Indonesian announcements | Task 3 |
| Delete `kanban-board.tsx` | Task 4 |
| No DB changes | (none) |

**Placeholder scan:** No TODO/TBD/"handle edge cases". All test bodies contain real assertions. All code steps contain real code. The board correctly does not import `ErrorNotice` (route owns it).

**Type consistency:**
- `ColumnId = "antrian" | ProductionProcess | "selesai"` — used identically in Tasks 1, 3.
- `BatchCardProps` in Task 2 matches exactly how Task 3 renders `<BatchCard>` (props: batch, canWrite, operatorName, isPending, pendingComplete, onOpen, onAction, onConfirmComplete, onCancelComplete).
- `BoardFilters` defined in Task 3, imported and used as `ProdSearch` in Task 4 — same 5 fields, same types.
- `onConfirmComplete(stepId: string)` — Task 2 calls it with `active.id` (string); Task 3's `runComplete(stepId: string)` matches.
- `useUpdateBatchStep().mutateAsync({ id, status, operator_id? })` — matches the existing hook input in `use-batch-steps.ts`.
- `activeStep`, `computeStartBlocker`, `computeStatus`, `actionsFor`, `isActionDisabled` — signatures used match the existing files listed in "Existing code reused".

## Execution notes

- Branch off `main` (not `ui-ux-phase4`). Name suggestion: `production-board-redesign`.
- If `ui-ux-phase4` is still unmerged at execution time, that's fine — this feature is independent.
- The visual mockups from brainstorming persist in `.superpowers/brainstorm/` (gitignored) for reference.
