import { useEffect, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Plus, Pencil, Power, CircleCheck, CircleSlash } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { toast } from "sonner";
import { z } from "zod";
import { myRolesQueryOptions, useMyRoles } from "@/hooks/use-my-roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  type OperatorFormInput,
  type OperatorRow,
} from "@/features/operators/hooks/use-operators";

const operatorSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama wajib diisi")
    .max(120, "Nama maksimal 120 karakter"),
  employee_number: z
    .string()
    .trim()
    .max(40, "NPK maksimal 40 karakter")
    .regex(
      /^[A-Za-z0-9._-]*$/,
      "NPK hanya boleh huruf, angka, titik, underscore, dan dash",
    )
    .transform((v) => v || null),
});

type OperatorFormErrors = Partial<Record<keyof OperatorFormInput, string>>;

export const Route = createFileRoute("/_authenticated/operators")({
  beforeLoad: async ({ context }) => {
    const roles =
      await context.queryClient.ensureQueryData(myRolesQueryOptions);
    if (!roles.includes("admin") && !roles.includes("production_planning")) {
      throw redirect({ to: "/dashboard" });
    }
  },
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

function validateOperatorForm(values: OperatorFormInput) {
  const parsed = operatorSchema.safeParse(values);
  if (parsed.success) return { values: parsed.data, errors: {} };

  const errors: OperatorFormErrors = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0] as keyof OperatorFormInput | undefined;
    if (key) errors[key] = issue.message;
  }
  return { values: null, errors };
}

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
      <PageHeader
        title="Operators"
        description="Master data operator produksi. Kelola nama, NPK, dan status aktif."
        actions={
          <>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari nama atau NPK..."
              className="w-full sm:w-64"
            />
            {canEdit && <CreateOperatorDialog />}
          </>
        }
      />

      {error ? (
        <ErrorNotice error={error} />
      ) : isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="rounded-xl border">
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
                      <StatusPill
                        icon={CircleCheck}
                        label="Aktif"
                        tone="success"
                      />
                    ) : (
                      <StatusPill
                        icon={CircleSlash}
                        label="Nonaktif"
                        tone="neutral"
                      />
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

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

function CreateOperatorDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [npk, setNpk] = useState("");
  const [errors, setErrors] = useState<OperatorFormErrors>({});
  const create = useCreateOperator();

  const reset = () => {
    setName("");
    setNpk("");
    setErrors({});
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (create.isPending) return;
    setOpen(nextOpen);
    if (!nextOpen) reset();
  };

  const submit = () => {
    const parsed = validateOperatorForm({ name, employee_number: npk });
    if (!parsed.values) {
      setErrors(parsed.errors);
      return;
    }
    create.mutate(parsed.values, {
      onSuccess: () => {
        toast.success("Operator ditambahkan.");
        reset();
        setOpen(false);
      },
      onError: (e) => toast.error((e as Error).message),
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" /> Tambah
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah Operator</DialogTitle>
          <DialogDescription>
            Isi nama operator dan NPK. NPK harus unik jika diisi.
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
              aria-invalid={Boolean(errors.name)}
            />
            <FieldError message={errors.name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="op-npk">NPK</Label>
            <Input
              id="op-npk"
              value={npk}
              onChange={(e) => setNpk(e.target.value)}
              placeholder="Nomor pegawai (unik jika diisi)"
              aria-invalid={Boolean(errors.employee_number)}
            />
            <FieldError message={errors.employee_number} />
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
  const [errors, setErrors] = useState<OperatorFormErrors>({});
  const update = useUpdateOperator();

  useEffect(() => {
    if (!open) {
      setName(operator.name);
      setNpk(operator.employee_number ?? "");
      setErrors({});
    }
  }, [open, operator.employee_number, operator.name, operator.updated_at]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (update.isPending) return;
    setOpen(nextOpen);
  };

  const submit = () => {
    const parsed = validateOperatorForm({ name, employee_number: npk });
    if (!parsed.values) {
      setErrors(parsed.errors);
      return;
    }
    update.mutate(
      {
        id: operator.id,
        values: { ...parsed.values, is_active: operator.is_active },
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Edit">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Operator</DialogTitle>
          <DialogDescription>
            Perbarui nama dan NPK operator. NPK harus unik jika diisi.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor={`ed-name-${operator.id}`}>Nama *</Label>
            <Input
              id={`ed-name-${operator.id}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={Boolean(errors.name)}
            />
            <FieldError message={errors.name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`ed-npk-${operator.id}`}>NPK</Label>
            <Input
              id={`ed-npk-${operator.id}`}
              value={npk}
              onChange={(e) => setNpk(e.target.value)}
              aria-invalid={Boolean(errors.employee_number)}
            />
            <FieldError message={errors.employee_number} />
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

  const onToggle = async () => {
    try {
      await toggle.mutateAsync({
        id: operator.id,
        is_active: !operator.is_active,
      });
      toast.success(
        operator.is_active ? "Operator dinonaktifkan." : "Operator diaktifkan.",
      );
      setConfirm(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        title={operator.is_active ? "Nonaktifkan" : "Aktifkan"}
        disabled={toggle.isPending}
        onClick={() => {
          if (operator.is_active) setConfirm(true);
          else void onToggle();
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
            <AlertDialogCancel disabled={toggle.isPending}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={toggle.isPending}
              onClick={(event) => {
                event.preventDefault();
                void onToggle();
              }}
            >
              Nonaktifkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
