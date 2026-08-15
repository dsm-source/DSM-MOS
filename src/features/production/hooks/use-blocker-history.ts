import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mapPgError } from "@/lib/pg-error";
import { invalidateActorEmails, resolveActorEmails } from "./use-actor-emails";

export type BlockerEvent = {
  id: string;
  source: "engineering" | "material";
  from_status: string | null;
  to_status: string;
  changed_at: string;
  changed_by: string | null;
  actor_email: string | null;
};

export function useBlockerHistory(engineeringJobId: string | undefined) {
  const queryClient = useQueryClient();
  // Saat berpindah batch, tandai cache email aktor sebagai basi supaya
  // perubahan email/pengguna baru tidak tersembunyi oleh hasil batch sebelumnya.
  useEffect(() => {
    if (engineeringJobId) invalidateActorEmails(queryClient);
  }, [engineeringJobId, queryClient]);
  return useQuery({
    enabled: !!engineeringJobId,
    queryKey: ["blocker-history", engineeringJobId],
    queryFn: async (): Promise<BlockerEvent[]> => {
      const [engRes, matRes] = await Promise.all([
        supabase
          .from("engineering_job_history")
          .select("id, field_changed, from_value, to_value, changed_at, changed_by")
          .eq("engineering_job_id", engineeringJobId!)
          .eq("field_changed", "status")
          .order("changed_at", { ascending: true }),
        supabase
          .from("material_status_history")
          .select("id, from_status, to_status, changed_at, changed_by")
          .eq("engineering_job_id", engineeringJobId!)
          .order("changed_at", { ascending: true }),
      ]);
      if (engRes.error) throw new Error(mapPgError(engRes.error));
      if (matRes.error) throw new Error(mapPgError(matRes.error));

      const base: BlockerEvent[] = [
        ...(engRes.data ?? []).map((r) => ({
          id: `eng-${r.id}`,
          source: "engineering" as const,
          from_status: r.from_value,
          to_status: r.to_value ?? "",
          changed_at: r.changed_at,
          changed_by: r.changed_by,
          actor_email: null,
        })),
        ...(matRes.data ?? []).map((r) => ({
          id: `mat-${r.id}`,
          source: "material" as const,
          from_status: r.from_status,
          to_status: r.to_status,
          changed_at: r.changed_at,
          changed_by: r.changed_by,
          actor_email: null,
        })),
      ];

      const userIds = base.map((e) => e.changed_by).filter((v): v is string => !!v);

      // Kegagalan resolusi email tidak boleh menggagalkan render timeline.
      // Panel Riwayat Blocker punya indikator loading/error + tombol retry
      // sendiri untuk memicu pemanggilan ulang bila perlu.
      const emailMap = await resolveActorEmails(queryClient, userIds).catch(
        () => new Map<string, string | null>(),
      );

      const events = base.map((e) => ({
        ...e,
        actor_email: e.changed_by ? (emailMap.get(e.changed_by) ?? null) : null,
      }));
      events.sort((a, b) => a.changed_at.localeCompare(b.changed_at));
      return events;
    },
    staleTime: 30_000,
  });
}
