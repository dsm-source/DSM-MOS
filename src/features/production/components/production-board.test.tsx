// src/features/production/components/production-board.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { ProductionBoard, type BoardFilters } from "./production-board";
import type { BatchWithContext } from "../hooks/use-batches";
import type {
  ProductionBatchStepRow,
  ProductionProcess,
  ProductionStepStatus,
} from "../types";

vi.mock("@/features/operators/hooks/use-operators", () => ({
  useOperators: () => ({ data: [], isLoading: false }),
}));
vi.mock("../hooks/use-batch-steps", () => ({
  useUpdateBatchStep: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function step(
  process: ProductionProcess,
  sequence_order: number,
  status: ProductionStepStatus,
): ProductionBatchStepRow {
  return {
    id: `s-${process}-${sequence_order}`,
    production_batch_id: "b",
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
  id: string,
  name: string,
  steps: ProductionBatchStepRow[],
  custName = "Cust",
): BatchWithContext {
  return {
    id,
    batch_number: id.toUpperCase(),
    quantity: 3,
    planned_start_date: "2026-01-01",
    planned_completion_date: "2099-01-01",
    estimated_delivery_date: null,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    engineering_job: {
      id: "j-" + id,
      job_number: "ENG",
      status: "approved",
      sales_order_item: {
        id: "i",
        item_name: name,
        quantity: 3,
        unit: "pcs",
        sales_order: {
          id: "so-" + id,
          so_number: "SO-" + id,
          customer: { id: "c-" + custName, name: custName },
        },
      },
      material_status: { status: "material_ready" },
    },
    steps,
  } as BatchWithContext;
}

const filters: BoardFilters = {
  q: "",
  customer: "all",
  so: "all",
  blocked: false,
  due: false,
};

function renderBoard(
  batches: BatchWithContext[],
  f: Partial<BoardFilters> = {},
) {
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
      batch("b1", "Rangka Motor", [
        step("laser_cutting", 1, "completed"),
        step("bending", 2, "running"),
      ]),
      batch("b2", "Cover Plate", [
        step("laser_cutting", 1, "waiting"),
        step("bending", 2, "waiting"),
      ]),
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
    expect(
      await screen.findByText(/Belum ada batch produksi/),
    ).toBeInTheDocument();
  });
});
