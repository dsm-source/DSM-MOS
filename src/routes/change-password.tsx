import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { changePasswordAndClearFlag } from "@/lib/roles.functions";
import { notifyError } from "@/lib/error-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/change-password")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
  },
  component: ChangePasswordPage,
});

function ChangePasswordPage() {
  const changePassword = useServerFn(changePasswordAndClearFlag);
  const queryClient = useQueryClient();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Kata sandi terlalu pendek", {
        description: "Minimal 8 karakter.",
      });
      return;
    }
    if (password !== confirm) {
      toast.error("Kata sandi tidak cocok", {
        description: "Konfirmasi kata sandi harus sama.",
      });
      return;
    }
    setLoading(true);
    try {
      await changePassword({ data: { password } });
      // Changing the password server-side (via the admin API) already revoked
      // this browser's session. Any signOut() call — even scope:"local" —
      // still hits the logout endpoint with the dead token and logs a 403.
      // Drop the persisted session directly instead, then hard-reload to /auth
      // so the client re-initialises with no session.
      //
      // Stop and drop every cached query first: the auth client emits
      // USER_UPDATED after the password change, and the root listener reacts
      // with queryClient.invalidateQueries() — refetching against the now-dead
      // token and logging 401s — before the hard reload lands.
      // Drop the persisted token FIRST: once it is gone, supabase.auth
      // .getSession() resolves to null, and the notifications queries (which
      // now guard on that) short-circuit instead of refetching with a dead
      // token. Then cancel/clear so nothing keeps a stale result around.
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
          localStorage.removeItem(key);
        }
      }
      await queryClient.cancelQueries();
      queryClient.clear();
      toast.success("Kata sandi berhasil diganti", {
        description: "Silakan masuk lagi dengan kata sandi baru.",
      });
      // Give the success toast a beat to paint before the hard reload wipes it.
      setTimeout(() => window.location.assign("/auth"), 800);
      return;
    } catch (e) {
      notifyError(e, { title: "Gagal mengganti kata sandi" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">DSM MOS</h1>
          <p className="text-sm text-muted-foreground">
            Manufacturing Operating System
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Ganti kata sandi</CardTitle>
            <CardDescription>
              Akun ini masih memakai kata sandi sementara dari admin. Buat kata
              sandi baru sebelum melanjutkan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={submit}>
              <div className="space-y-2">
                <Label htmlFor="new-password">Kata sandi baru</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">
                  Konfirmasi kata sandi baru
                </Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Memproses..." : "Ganti kata sandi"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
