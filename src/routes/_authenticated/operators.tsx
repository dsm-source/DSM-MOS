import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { UserCog, Plus, Pencil, Power } from "lucide-react";
import { toast } from "sonner";
import { useMyRoles } from "@/hooks/use-my-roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorNotice } from "@/components/error-notice";
import {
  useOperators,
  useCreateOperator,
  useUpdateOperator,
  useToggleOperatorActive,
  type OperatorRow,
} from "@/features/operators/hooks/use-operators";

export const Route = createFileRoute("/_authenticated/operators")({
  head: () => ({
    meta: [
      { title: "Operators — DSM MOS" },
      {
        name: "description",
        content: "Master data operator produksi DSM MOS.",
      },
    ],
  }),
  component: OperatorsPage,
});

function OperatorsPage() {
  const { hasAnyRole } = useMyRoles();
  const canEdit = hasAnyRole(["admin", "production_planning"]);
  const { data: operators = [], isLoading, error } = useOperators();
  const [q, setQ] = useState("");

  const filtered = operators.filter((o) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return (
      o.name.toLowerCase().includes(s) ||
      (o.employee_number ?? "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <UserCog className="h-5 w-5" />
          <div>
            <h1 className="text-2xl font-semibold">Operators</h1>
            <p className="text-sm text-muted-foreground">
              Master data operator produksi. Kelola nama & status aktif.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama atau NPK..."
            className="w-full sm:w-64"
          />
          {canEdit && <CreateOperatorDialog />}
        </div>
      </div>

      {error ? (
        <ErrorNotice error={error} />
      ) : isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>NPK</TableHead>
                <TableHead>Status</TableHead>
                {canEdit && <TableHead className="text-right">Aksi</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={canEdit ? 4 : 3}
                    className="text-center text-muted-foreground py-8"
                  >
                    Belum ada operator.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((op) => (
                <TableRow key={op.id}>
                  <TableCell className="font-medium">{op.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {op.employee_number ?? "—"}
                  </TableCell>
                  <TableCell>
                    {op.is_active ? (
                      <Badge className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                        Aktif
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Nonaktif</Badge>
                    )}
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <EditOperatorDialog operator={op} />
                        <ToggleActiveButton operator={op} />
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function CreateOperatorDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [npk, setNpk] = useState("");
  const create = useCreateOperator();

  const submit = () => {
    if (!name.trim()) {
      toast.error("Nama wajib diisi.");
      return;
    }
    create.mutate(
      { name, employee_number: npk || null },
      {
        onSuccess: () => {
          toast.success("Operator ditambahkan.");
          setName("");
          setNpk("");
          setOpen(false);
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" /> Tambah
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah Operator</DialogTitle>
          <DialogDescription>
            Isi nama operator dan nomor pegawai (NPK) opsional.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="op-name">Nama *</Label>
            <Input
              id="op-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama lengkap"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="op-npk">NPK</Label>
            <Input
              id="op-npk"
              value={npk}
              onChange={(e) => setNpk(e.target.value)}
              placeholder="Nomor pegawai (opsional)"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={create.isPending}>
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditOperatorDialog({ operator }: { operator: OperatorRow }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(operator.name);
  const [npk, setNpk] = useState(operator.employee_number ?? "");
  const update = useUpdateOperator();

  const submit = () => {
    if (!name.trim()) {
      toast.error("Nama wajib diisi.");
      return;
    }
    update.mutate(
      {
        id: operator.id,
        values: { name: name.trim(), employee_number: npk.trim() || null },
      },
      {
        onSuccess: () => {
          toast.success("Operator diperbarui.");
          setOpen(false);
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Edit">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Operator</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="ed-name">Nama *</Label>
            <Input
              id="ed-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ed-npk">NPK</Label>
            <Input
              id="ed-npk"
              value={npk}
              onChange={(e) => setNpk(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={update.isPending}>
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ToggleActiveButton({ operator }: { operator: OperatorRow }) {
  const toggle = useToggleOperatorActive();
  const [confirm, setConfirm] = useState(false);

  const onToggle = () => {
    toggle.mutate(
      { id: operator.id, is_active: !operator.is_active },
      {
        onSuccess: () => {
          toast.success(
            operator.is_active
              ? "Operator dinonaktifkan."
              : "Operator diaktifkan.",
          );
          setConfirm(false);
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        title={operator.is_active ? "Nonaktifkan" : "Aktifkan"}
        onClick={() => {
          if (operator.is_active) setConfirm(true);
          else onToggle();
        }}
      >
        <Power className="h-4 w-4" />
      </Button>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nonaktifkan operator?</AlertDialogTitle>
            <AlertDialogDescription>
              Operator <strong>{operator.name}</strong> akan dinonaktifkan dan
              tidak tersedia untuk batch baru. Data tetap tersimpan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={onToggle}>
              Nonaktifkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
