import type * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DndContext } from "@dnd-kit/core";

// The board card links out with @tanstack/react-router's <Link>, which needs a
// RouterProvider. These tests only exercise the card, so stub Link as an anchor.
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params,
    children,
    ...rest
  }: {
    to: string;
    params?: Record<string, string>;
    children: React.ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
    const href = params
      ? Object.entries(params).reduce(
          (acc, [k, v]) => acc.replace(`$${k}`, v),
          to,
        )
      : to;
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  },
}));

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
        sales_order: {
          id: "so1",
          so_number: "SO-2026-0064",
          customer: { id: "c1", name: "PT Sumber Rejeki" },
        },
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
    expect(
      screen.getByRole("button", { name: "Complete" }),
    ).toBeInTheDocument();
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
    expect(
      screen.queryByRole("button", { name: "Complete" }),
    ).not.toBeInTheDocument();
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
    expect(screen.getByRole("link", { name: /Material/ })).toHaveAttribute(
      "href",
      "/material",
    );
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
    const props = renderCard({
      batch: makeBatch([step("bending", 1, "running")]),
    });
    await userEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(props.onAction).toHaveBeenCalled();
    const [calledStep, calledAction] = vi.mocked(props.onAction).mock.calls[0];
    expect(calledStep.id).toBe("s-1");
    expect(calledAction.key).toBe("pause");
  });
});
