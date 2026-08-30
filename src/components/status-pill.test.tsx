import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CircleCheck } from "lucide-react";
import { StatusPill } from "./status-pill";
import { toneClass } from "@/lib/status-tone";
import { SO_STATUS_META } from "@/features/sales-orders/lib/status";
import { STEP_STATUS_META } from "@/features/production/lib/process";

describe("StatusPill", () => {
  it("renders the label, an icon, and the tone's classes", () => {
    render(<StatusPill icon={CircleCheck} label="Selesai" tone="success" />);
    const pill = screen.getByText("Selesai");
    // icon is decorative
    expect(pill.querySelector("svg")).toBeInTheDocument();
    expect(pill.querySelector("svg")).toHaveAttribute("aria-hidden");
    // success tone -> emerald classes
    expect(pill.className).toContain("bg-emerald-100");
  });

  it("merges a passed className", () => {
    render(
      <StatusPill
        icon={CircleCheck}
        label="X"
        tone="neutral"
        className="ml-2"
      />,
    );
    expect(screen.getByText("X").className).toContain("ml-2");
  });
});

describe("toneClass", () => {
  it("returns a non-empty class string for every tone", () => {
    for (const t of [
      "neutral",
      "active",
      "attention",
      "success",
      "danger",
    ] as const) {
      expect(toneClass(t).length).toBeGreaterThan(0);
    }
  });
});

describe("status meta maps", () => {
  it("every sales-order status has a label, icon and tone (no colour-only status)", () => {
    for (const meta of Object.values(SO_STATUS_META)) {
      expect(meta.label).toBeTruthy();
      expect(meta.icon).toBeTruthy();
      expect(meta.tone).toBeTruthy();
    }
  });

  it("every production step status has an icon", () => {
    for (const meta of Object.values(STEP_STATUS_META)) {
      expect(meta.icon).toBeTruthy();
    }
  });
});
