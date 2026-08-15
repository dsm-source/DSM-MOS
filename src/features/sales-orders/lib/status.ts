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
// Pengelompokan warna: draft = warn, confirmed..delivery = blue (dalam proses), completed = green, cancelled = gray.
export const STATUS_CLASS: Record<SalesOrderStatus, string> = {
  draft:
    "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800",
  confirmed:
    "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-800",
  engineering:
    "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-800",
  production:
    "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-800",
  quality_control:
    "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-800",
  delivery:
    "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-800",
  completed:
    "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-800",
  cancelled:
    "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
};
