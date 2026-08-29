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
        sales_order: {
          id: "so1",
          so_number: "SO-1",
          customer: { id: "c1", name: "Cust" },
        },
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
    const b = batch(
      FULL.map(([p, o]) => step(p, o, o === 3 ? "skipped" : "completed")),
    );
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
    const b = batch(
      FULL.map(([p, o]) => step(p, o, "completed")),
      {
        planned_completion_date: "2020-01-01",
      },
    );
    expect(isAtRisk(b)).toBe(false);
  });
});
