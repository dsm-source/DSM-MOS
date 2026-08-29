import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Copy, RefreshCw } from "lucide-react";
import { notifyError } from "@/lib/error-message";
import { createUserManual } from "@/lib/admin-users.functions";
import type { AppRole } from "@/lib/roles.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PASSWORD_CHARS =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

function generatePassword(length = 12): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(
    bytes,
    (b) => PASSWORD_CHARS[b % PASSWORD_CHARS.length],
  ).join("");
}

export function CreateUserDialog({ roles }: { roles: AppRole[] }) {
  const qc = useQueryClient();
  const createFn = useServerFn(createUserManual);

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(() => generatePassword());
  const [role, setRole] = useState<AppRole | "">("");
  const [copied, setCopied] = useState(false);
  const [created, setCreated] = useState<{
    email: string;
    password: string;
  } | null>(null);

  const reset = () => {
    setEmail("");
    setPassword(generatePassword());
    setRole("");
    setCopied(false);
    setCreated(null);
  };

  const create = useMutation({
    mutationFn: () => {
      if (!role) throw new Error("Pilih peran awal untuk user ini");
      return createFn({ data: { email: email.trim(), password, role } });
    },
    onSuccess: () => {
      setCreated({ email: email.trim(), password });
      qc.invalidateQueries({ queryKey: ["admin", "users-with-roles"] });
    },
    onError: (e: Error) => notifyError(e, { title: "Gagal membuat user" }),
  });

  const copyCredentials = async () => {
    if (!created) return;
    await navigator.clipboard.writeText(
      `Email: ${created.email}\nKata sandi: ${created.password}`,
    );
    setCopied(true);
    toast.success("Disalin ke clipboard");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        setOpen(o);
      }}
    >
      <Button onClick={() => setOpen(true)}>Buat User Baru</Button>
      <DialogContent>
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>User dibuat</DialogTitle>
              <DialogDescription>
                Bagikan kredensial ini ke user secara langsung. Kata sandi tidak
                akan ditampilkan lagi setelah jendela ini ditutup.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-xl border bg-muted/40 p-3 space-y-1.5 font-mono text-sm">
              <div>
                <span className="text-muted-foreground">Email </span>
                {created.email}
              </div>
              <div>
                <span className="text-muted-foreground">Kata sandi </span>
                {created.password}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={copyCredentials}>
                {copied ? (
                  <>
                    <Check className="size-4" /> Tersalin
                  </>
                ) : (
                  <>
                    <Copy className="size-4" /> Salin
                  </>
                )}
              </Button>
              <Button
                onClick={() => {
                  reset();
                  setOpen(false);
                }}
              >
                Selesai
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Buat User Baru</DialogTitle>
              <DialogDescription>
                Akun dibuat langsung aktif dengan kata sandi sementara. User
                akan dipaksa menggantinya sebelum bisa mengakses halaman lain
                setelah masuk pertama kali.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="new-user-email">Email</Label>
                <Input
                  id="new-user-email"
                  type="email"
                  autoComplete="off"
                  placeholder="nama@perusahaan.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="new-user-password">Kata sandi sementara</Label>
                <div className="flex gap-2">
                  <Input
                    id="new-user-password"
                    className="font-mono"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    title="Buat kata sandi baru"
                    onClick={() => setPassword(generatePassword())}
                  >
                    <RefreshCw className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="new-user-role">Peran awal</Label>
                <Select
                  value={role}
                  onValueChange={(v) => setRole(v as AppRole)}
                >
                  <SelectTrigger id="new-user-role">
                    <SelectValue placeholder="Pilih peran" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button
                onClick={() => create.mutate()}
                disabled={
                  create.isPending || !email.trim() || !password || !role
                }
              >
                {create.isPending ? "Membuat..." : "Buat User"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
