import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { BlockerEvent } from "../hooks/use-blocker-history";

// --- Mocks ---------------------------------------------------------------

const sampleEvents: BlockerEvent[] = [
  {
    id: "e1",
    source: "engineering",
    from_status: "in_progress",
    to_status: "approved",
    changed_at: "2026-01-10T03:00:00.000Z",
    changed_by: "user-1",
    actor_email: null,
  },
  {
    id: "m1",
    source: "material",
    from_status: "waiting_material",
    to_status: "material_ready",
    changed_at: "2026-01-10T05:00:00.000Z",
    changed_by: "user-2",
    actor_email: null,
  },
];

vi.mock("../hooks/use-blocker-history", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../hooks/use-blocker-history")>();
  return {
    ...actual,
    useBlockerHistory: () => ({
      data: sampleEvents,
      isLoading: false,
      error: null,
    }),
  };
});

const resolveActorEmailsMock = vi.fn();
vi.mock("../hooks/use-actor-emails", () => ({
  resolveActorEmails: (...args: unknown[]) => resolveActorEmailsMock(...args),
  invalidateActorEmails: vi.fn(),
}));

// Silence sonner toasts in jsdom
const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

// Avoid importing jspdf in jsdom (heavy + not needed for these assertions).
vi.mock("jspdf", () => ({
  jsPDF: class {
    setFontSize() {}
    text() {}
    save() {}
  },
}));
vi.mock("jspdf-autotable", () => ({ default: () => {} }));

// URL.createObjectURL / revokeObjectURL for CSV path
beforeEach(() => {
  resolveActorEmailsMock.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
});

// --- Helpers -------------------------------------------------------------

async function renderComponent() {
  const { BlockerHistory } = await import("./blocker-history");
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <BlockerHistory engineeringJobId="job-1" batchLabel="Batch A" />
    </QueryClientProvider>,
  );
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// --- Tests ---------------------------------------------------------------

describe("BlockerHistory - resolve/export UI", () => {
  it("menampilkan spinner 'Menyiapkan nama aktor…' saat prefetch berjalan", async () => {
    const d = deferred<Map<string, string>>();
    resolveActorEmailsMock.mockReturnValue(d.promise);
    const user = userEvent.setup();
    await renderComponent();

    const csvBtn = screen.getByRole("button", { name: /CSV/i });
    await user.hover(csvBtn);

    // Visible status bar with spinner
    const bar = await screen.findByText(
      /Menyiapkan nama aktor untuk pencarian & ekspor/i,
    );
    expect(bar).toBeInTheDocument();
    // Spinner icon (Loader2) has class animate-spin
    expect(bar.parentElement?.querySelector(".animate-spin")).toBeTruthy();

    // sr-only live region also announces
    const live = document.querySelector('[role="status"][aria-live="polite"]');
    expect(live?.textContent).toMatch(/Menyiapkan nama aktor/i);

    d.resolve(new Map());
    await waitFor(() =>
      expect(
        screen.queryByText(/Menyiapkan nama aktor untuk pencarian & ekspor/i),
      ).not.toBeInTheDocument(),
    );
  });

  it("menampilkan bar error merah + tombol 'Coba lagi' saat resolve gagal, dan retry memanggil ulang", async () => {
    resolveActorEmailsMock.mockRejectedValueOnce(new Error("Network down"));
    const user = userEvent.setup();
    await renderComponent();

    await user.hover(screen.getByRole("button", { name: /CSV/i }));

    // Retry button appears only in visible error bar → use it as anchor.
    const retry = await screen.findByRole("button", {
      name: /Coba lagi — Gagal memuat nama aktor/i,
    });
    const container = retry.closest("div");
    expect(container?.className).toMatch(/destructive/);
    expect(container?.textContent).toMatch(
      /Gagal memuat nama aktor: Network down/i,
    );

    // Assertive alert live region present
    const alertRegion = document.querySelector(
      '[role="alert"][aria-live="assertive"]',
    );
    expect(alertRegion?.textContent).toMatch(/Gagal memuat nama aktor/i);

    // Clicking retry triggers another resolveActorEmails call
    resolveActorEmailsMock.mockResolvedValueOnce(new Map());
    await user.click(retry);
    await waitFor(() =>
      expect(resolveActorEmailsMock).toHaveBeenCalledTimes(2),
    );
  });

  it("menonaktifkan tombol CSV & PDF selama ekspor berlangsung", async () => {
    const d = deferred<Map<string, string>>();
    resolveActorEmailsMock.mockReturnValue(d.promise);
    const user = userEvent.setup();
    await renderComponent();

    const csvBtn = screen.getByRole("button", { name: /CSV/i });
    const pdfBtn = screen.getByRole("button", { name: /PDF/i });

    await user.click(csvBtn);

    // While pending: CSV shows "Menyiapkan…" with spinner and aria-busy=true
    await waitFor(() => {
      expect(csvBtn).toHaveAttribute("aria-busy", "true");
      expect(csvBtn).toBeDisabled();
      expect(pdfBtn).toBeDisabled();
    });
    expect(within(csvBtn).getByText(/Menyiapkan…/i)).toBeInTheDocument();
    expect(csvBtn.querySelector(".animate-spin")).toBeTruthy();

    // Finish export
    d.resolve(new Map());
    await waitFor(() => {
      expect(csvBtn).not.toBeDisabled();
      expect(pdfBtn).not.toBeDisabled();
      expect(csvBtn).toHaveAttribute("aria-busy", "false");
    });
  });

  it.each([
    ["CSV", /^CSV$/i],
    ["PDF", /^PDF$/i],
  ])(
    "setelah ekspor %s berhasil: tombol aktif kembali, label normal, dan toast sukses muncul",
    async (fmt, nameRe) => {
      resolveActorEmailsMock.mockResolvedValue(new Map());
      const user = userEvent.setup();
      await renderComponent();

      const btn = screen.getByRole("button", { name: nameRe });
      const csvBtn = screen.getByRole("button", { name: /^CSV$/i });
      const pdfBtn = screen.getByRole("button", { name: /^PDF$/i });

      await user.click(btn);

      await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));

      // Toast sukses berisi format + jumlah baris + label batch
      const [title, opts] = toastSuccess.mock.calls[0] as [
        string,
        { description: string },
      ];
      expect(title).toMatch(new RegExp(`Ekspor ${fmt} berhasil`, "i"));
      expect(opts.description).toMatch(
        new RegExp(`${sampleEvents.length} baris`),
      );
      expect(opts.description).toMatch(/Batch A/);
      expect(toastError).not.toHaveBeenCalled();

      // Tombol kembali aktif & label kembali normal (tidak ada spinner)
      expect(csvBtn).not.toBeDisabled();
      expect(pdfBtn).not.toBeDisabled();
      expect(csvBtn).toHaveAttribute("aria-busy", "false");
      expect(pdfBtn).toHaveAttribute("aria-busy", "false");
      expect(screen.queryByText(/Menyiapkan…/i)).not.toBeInTheDocument();
      expect(document.querySelector(".animate-spin")).toBeNull();

      // Tidak ada state error tersisa
      expect(
        screen.queryByText(/Gagal memuat nama aktor/i),
      ).not.toBeInTheDocument();
    },
  );
});
