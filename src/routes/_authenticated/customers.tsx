import { useState } from "react";
import { notifyError } from "@/lib/error-message";
import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  customerSchema,
  useCreateCustomer,
  useCustomers,
  useDeleteCustomer,
  useUpdateCustomer,
  type Customer,
  type CustomerFormValues,
} from "@/features/customers/hooks/use-customers";
import { useMyRoles } from "@/hooks/use-my-roles";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({
    meta: [
      { title: "Customers — DSM MOS" },
      { name: "description", content: "Master data pelanggan pada DSM MOS." },
    ],
  }),
  component: CustomersPage,
});

function CustomersPage() {
  const { hasAnyRole } = useMyRoles();
  const canWrite = hasAnyRole(["admin", "sales"]);
  const [search, setSearch] = useState("");
  const { data = [], isLoading } = useCustomers(search);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [openCreate, setOpenCreate] = useState(false);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Customers"
        description="Master data pelanggan."
        actions={
          canWrite && (
            <Dialog open={openCreate} onOpenChange={setOpenCreate}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-1" /> Customer Baru
                </Button>
              </DialogTrigger>
              <CustomerFormDialog onClose={() => setOpenCreate(false)} />
            </Dialog>
          )
        }
      />

      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Cari nama atau kode..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="rounded-xl border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kode</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>Contact Person</TableHead>
              <TableHead>Telepon</TableHead>
              <TableHead>Alamat</TableHead>
              {canWrite && <TableHead className="w-24" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && data.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground py-8"
                >
                  Belum ada customer.
                </TableCell>
              </TableRow>
            )}
            {data.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono">{c.code}</TableCell>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.contact_person ?? "—"}</TableCell>
                <TableCell>{c.phone ?? "—"}</TableCell>
                <TableCell className="max-w-xs truncate">
                  {c.address ?? "—"}
                </TableCell>
                {canWrite && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditing(c)}
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <DeleteCustomerButton id={c.id} name={c.name} />
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <CustomerFormDialog
            customer={editing}
            onClose={() => setEditing(null)}
          />
        )}
      </Dialog>
    </div>
  );
}

function CustomerFormDialog({
  customer,
  onClose,
}: {
  customer?: Customer;
  onClose: () => void;
}) {
  const create = useCreateCustomer();
  const update = useUpdateCustomer();
  const isEdit = !!customer;
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      code: customer?.code ?? "",
      name: customer?.name ?? "",
      contact_person: customer?.contact_person ?? "",
      phone: customer?.phone ?? "",
      address: customer?.address ?? "",
    },
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit Customer" : "Customer Baru"}</DialogTitle>
        <DialogDescription>Kode harus unik dalam sistem.</DialogDescription>
      </DialogHeader>
      <form
        className="space-y-3"
        onSubmit={handleSubmit(async (values) => {
          try {
            if (isEdit) await update.mutateAsync({ id: customer!.id, values });
            else await create.mutateAsync(values);
            toast.success(
              isEdit ? "Customer diperbarui" : "Customer ditambahkan",
            );
            onClose();
          } catch (e) {
            notifyError(e);
          }
        })}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Kode</Label>
            <Input {...register("code")} placeholder="CUST-001" />
            {errors.code && (
              <p className="text-xs text-destructive">{errors.code.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Nama</Label>
            <Input {...register("name")} />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Contact Person</Label>
          <Input {...register("contact_person")} />
        </div>
        <div className="space-y-1.5">
          <Label>Telepon</Label>
          <Input {...register("phone")} />
        </div>
        <div className="space-y-1.5">
          <Label>Alamat</Label>
          <Textarea rows={3} {...register("address")} />
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={create.isPending || update.isPending}>
            {isEdit ? "Simpan" : "Tambah"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function DeleteCustomerButton({ id, name }: { id: string; name: string }) {
  const del = useDeleteCustomer();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Hapus">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus customer?</AlertDialogTitle>
          <AlertDialogDescription>
            {name} akan dihapus. Tidak bisa dihapus bila masih dipakai di sales
            order.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction
            onClick={async () => {
              try {
                await del.mutateAsync(id);
                toast.success("Customer dihapus");
              } catch (e) {
                notifyError(e);
              }
            }}
          >
            Hapus
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
