import { FileText, PackageCheck, Truck, CircleCheckBig } from "lucide-react";
import type { StatusMeta } from "@/lib/status-tone";
import type { DeliveryStatus } from "../types";

export const DELIVERY_STATUS_META: Record<DeliveryStatus, StatusMeta> = {
  draft: { label: "Draft", icon: FileText, tone: "neutral" },
  prepared: { label: "Disiapkan", icon: PackageCheck, tone: "active" },
  shipped: { label: "Dikirim", icon: Truck, tone: "active" },
  delivered: { label: "Terkirim", icon: CircleCheckBig, tone: "success" },
};

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> =
  Object.fromEntries(
    Object.entries(DELIVERY_STATUS_META).map(([k, v]) => [k, v.label]),
  ) as Record<DeliveryStatus, string>;

export const DELIVERY_STATUS_ORDER: DeliveryStatus[] = [
  "draft",
  "prepared",
  "shipped",
  "delivered",
];

// Gantt bar colors (semantic hues) — must be readable on dark and light.
export const DELIVERY_STATUS_COLOR: Record<
  DeliveryStatus,
  { bg: string; bgSel: string; progress: string }
> = {
  draft: {
    bg: "hsl(220 9% 60%)",
    bgSel: "hsl(220 9% 50%)",
    progress: "hsl(220 9% 45%)",
  },
  prepared: {
    bg: "hsl(217 91% 60%)",
    bgSel: "hsl(217 91% 50%)",
    progress: "hsl(217 91% 45%)",
  },
  shipped: {
    bg: "hsl(38 92% 55%)",
    bgSel: "hsl(38 92% 45%)",
    progress: "hsl(38 92% 40%)",
  },
  delivered: {
    bg: "hsl(142 71% 45%)",
    bgSel: "hsl(142 71% 38%)",
    progress: "hsl(142 71% 32%)",
  },
};

export const OVERDUE_COLOR = {
  bg: "hsl(0 84% 60%)",
  bgSel: "hsl(0 84% 50%)",
  progress: "hsl(0 74% 45%)",
};
