import type { SalesOrderStatus } from "../types";

export const STATUS_LABEL: Record<SalesOrderStatus, string> = {
  draft: "Draft",
  confirmed: "Confirmed",
  engineering: "Engineering",
  production: "Production",
  quality_control: "Quality Control",
  delivery: "Delivery",
  completed: "Completed",
  cancelled: "Cancelled",
};

// Kelas Tailwind — pakai warna eksplisit agar tidak bergantung theme token yang belum tentu ada.
// Warna DAN teks agar aksesibel di layar shop floor.
export const STATUS_CLASS: Record<SalesOrderStatus, string> = {
  draft:
    "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
  confirmed:
    "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-800",
  engineering:
    "bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-900/40 dark:text-indigo-200 dark:border-indigo-800",
  production:
    "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800",
  quality_control:
    "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/40 dark:text-purple-200 dark:border-purple-800",
  delivery:
    "bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-900/40 dark:text-cyan-200 dark:border-cyan-800",
  completed:
    "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-800",
  cancelled:
    "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/40 dark:text-rose-200 dark:border-rose-800",
};
