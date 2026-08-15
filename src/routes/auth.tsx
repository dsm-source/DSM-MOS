import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Masuk — DSM MOS" },
      {
        name: "description",
        content:
          "Masuk ke DSM Manufacturing Operating System untuk mengelola pekerjaan sheet metal dari Sales Order hingga Delivery.",
      },
      { property: "og:title", content: "Masuk — DSM MOS" },
      {
        property: "og:description",
        content: "Portal login DSM Manufacturing Operating System.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

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
            <CardTitle>Masuk ke akun</CardTitle>
            <CardDescription>
              Gunakan email dan kata sandi yang diberikan admin. Akun baru hanya
              dibuat oleh admin lewat halaman Kelola User.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SignInForm
              onSuccess={() => navigate({ to: "/dashboard", replace: true })}
            />
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:underline">
            Kembali ke beranda
          </Link>
        </p>
      </div>
    </div>
  );
}

function SignInForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) {
      toast.error("Gagal masuk", { description: error.message });
      return;
    }
    onSuccess();
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="space-y-2">
        <Label htmlFor="signin-email">Email</Label>
        <Input
          id="signin-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signin-password">Kata sandi</Label>
        <Input
          id="signin-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Memproses..." : "Masuk"}
      </Button>
    </form>
  );
}
