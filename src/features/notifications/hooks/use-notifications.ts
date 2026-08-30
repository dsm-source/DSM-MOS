import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type NotificationRow =
  Database["public"]["Tables"]["notifications"]["Row"];

const KEY = ["notifications"] as const;

export function useNotifications(limit = 20) {
  return useQuery({
    queryKey: [...KEY, limit],
    queryFn: async (): Promise<NotificationRow[]> => {
      // A cache invalidation can race a just-revoked session (e.g. forced
      // password change): bail before hitting PostgREST with a dead token
      // so it never logs a 401.
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return [];
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: [...KEY, "unread-count"],
    queryFn: async (): Promise<number> => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return 0;
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id)
        .is("read_at", null);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      if (sessionError) throw new Error(sessionError.message);
      const uid = sessionData.session?.user.id;
      if (!uid) return;
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", uid)
        .is("read_at", null);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

/** Subscribe to realtime inserts for the current user's notifications. */
export function useNotificationsRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error || cancelled) return;
      const uid = data.session?.user.id;
      if (!uid || cancelled) return;

      channel = supabase
        .channel(`notifications:${uid}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${uid}`,
          },
          () => {
            qc.invalidateQueries({ queryKey: KEY });
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [qc]);
}
