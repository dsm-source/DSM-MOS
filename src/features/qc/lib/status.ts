import {
  Clock,
  Search,
  CircleCheckBig,
  XCircle,
  RotateCcw,
} from "lucide-react";
import type { StatusMeta } from "@/lib/status-tone";
import type { QcStatus } from "../types";

export const QC_STATUS_META: Record<QcStatus, StatusMeta> = {
  waiting: { label: "Menunggu", icon: Clock, tone: "neutral" },
  inspection: { label: "Inspeksi", icon: Search, tone: "active" },
  pass: { label: "Lulus", icon: CircleCheckBig, tone: "success" },
  reject: { label: "Tolak", icon: XCircle, tone: "danger" },
  rework: { label: "Rework", icon: RotateCcw, tone: "attention" },
};

export const QC_STATUS_LABEL: Record<QcStatus, string> = Object.fromEntries(
  Object.entries(QC_STATUS_META).map(([k, v]) => [k, v.label]),
) as Record<QcStatus, string>;

export const QC_STATUS_ORDER: QcStatus[] = [
  "waiting",
  "inspection",
  "reject",
  "rework",
  "pass",
];
