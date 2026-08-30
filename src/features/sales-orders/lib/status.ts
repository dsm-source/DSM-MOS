import {
  FileText,
  ClipboardCheck,
  Ruler,
  Factory,
  ShieldCheck,
  Truck,
  CircleCheckBig,
  Ban,
} from "lucide-react";
import type { StatusMeta } from "@/lib/status-tone";
import type { SalesOrderStatus } from "../types";

export const SO_STATUS_META: Record<SalesOrderStatus, StatusMeta> = {
  draft: { label: "Draft", icon: FileText, tone: "neutral" },
  confirmed: { label: "Confirmed", icon: ClipboardCheck, tone: "active" },
  engineering: { label: "Engineering", icon: Ruler, tone: "active" },
  production: { label: "Production", icon: Factory, tone: "active" },
  quality_control: {
    label: "Quality Control",
    icon: ShieldCheck,
    tone: "active",
  },
  delivery: { label: "Delivery", icon: Truck, tone: "active" },
  completed: { label: "Completed", icon: CircleCheckBig, tone: "success" },
  cancelled: { label: "Cancelled", icon: Ban, tone: "neutral" },
};

export const STATUS_LABEL: Record<SalesOrderStatus, string> =
  Object.fromEntries(
    Object.entries(SO_STATUS_META).map(([k, v]) => [k, v.label]),
  ) as Record<SalesOrderStatus, string>;
