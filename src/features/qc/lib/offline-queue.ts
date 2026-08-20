import type { QcStatus } from "../types";

export type OfflineQueueItem = {
  id: string;
  kind: "update-inspection" | "trigger-rework";
  inspectionId: string;
  payload?: {
    status?: QcStatus;
    qty_total?: number;
    qty_ok?: number;
    qty_reject?: number;
    defect_notes?: string | null;
  };
  createdAt: string;
};

const STORAGE_KEY = "dsm-mos:qc-offline-queue";
export const QUEUE_CHANGED_EVENT = "dsm-mos:qc-offline-queue-changed";

function notifyChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(QUEUE_CHANGED_EVENT));
  }
}

export function readQueue(): OfflineQueueItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as OfflineQueueItem[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: OfflineQueueItem[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    notifyChange();
    return true;
  } catch {
    return false;
  }
}

export function enqueue(
  item: Omit<OfflineQueueItem, "id" | "createdAt">,
): OfflineQueueItem | null {
  const full: OfflineQueueItem = {
    ...item,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  return writeQueue([...readQueue(), full]) ? full : null;
}

export function dequeue(id: string): boolean {
  return writeQueue(readQueue().filter((i) => i.id !== id));
}

export function isOffline(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

/** Deteksi konservatif error yang kemungkinan disebabkan koneksi mati, bukan validasi server. */
export function isOfflineLikeError(err: unknown): boolean {
  if (isOffline()) return true;
  const msg =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";
  return /failed to fetch|network|fetch/i.test(msg);
}
