import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { mapPgError } from "@/lib/pg-error";
import {
  QUEUE_CHANGED_EVENT,
  dequeue,
  isOffline,
  readQueue,
  type OfflineQueueItem,
} from "../lib/offline-queue";

const QC_KEY = ["qc-inspections"] as const;
let syncLock = false;

async function processItem(item: OfflineQueueItem): Promise<void> {
  if (item.kind === "update-inspection") {
    const { error } = await supabase
      .from("qc_inspections")
      .update(item.payload as never)
      .eq("id", item.inspectionId);
    if (error) throw new Error(mapPgError(error));
    return;
  }
  const { error } = await supabase.rpc("trigger_rework", {
    _qc_inspection_id: item.inspectionId,
  });
  if (error) throw new Error(mapPgError(error));
}

/** Antrian offline QC: sinkronisasi serial, berhenti di kegagalan pertama (jaringan atau validasi). */
export function useOfflineQcQueue() {
  const qc = useQueryClient();
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(() => setPending(readQueue().length), []);

  useEffect(() => {
    refresh();
    window.addEventListener(QUEUE_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(QUEUE_CHANGED_EVENT, refresh);
  }, [refresh]);

  const sync = useCallback(async () => {
    if (syncLock || isOffline()) return;
    syncLock = true;
    setSyncing(true);
    let synced = 0;
    try {
      let queue = readQueue();
      while (queue.length > 0) {
        const item = queue[0];
        try {
          await processItem(item);
        } catch (e) {
          toast.error("Sinkronisasi berhenti", {
            description:
              e instanceof Error ? e.message : "Gagal menyinkronkan data lokal",
          });
          break;
        }
        if (!dequeue(item.id)) {
          toast.error("Sinkronisasi berhenti", {
            description:
              "Gagal memperbarui antrian lokal setelah sinkronisasi berhasil",
          });
          break;
        }
        synced++;
        queue = readQueue();
      }
    } finally {
      syncLock = false;
      setSyncing(false);
      if (synced > 0) {
        qc.invalidateQueries({ queryKey: QC_KEY });
        toast.success(`${synced} data lokal berhasil disinkronkan`);
      }
    }
  }, [qc]);

  useEffect(() => {
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, [sync]);

  return { pending, syncing, sync };
}
