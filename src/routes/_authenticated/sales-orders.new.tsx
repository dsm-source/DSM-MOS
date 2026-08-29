import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { notifyError } from "@/lib/error-message";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { SalesOrderForm } from "@/features/sales-orders/components/sales-order-form";
import { useCreateSalesOrder } from "@/features/sales-orders/hooks/use-sales-orders";
import { useMyRoles } from "@/hooks/use-my-roles";

export const Route = createFileRoute("/_authenticated/sales-orders/new")({
  head: () => ({ meta: [{ title: "SO Baru — DSM MOS" }] }),
  component: NewSalesOrderPage,
});

function NewSalesOrderPage() {
  const navigate = useNavigate();
  const create = useCreateSalesOrder();
  const { hasAnyRole } = useMyRoles();

  if (!hasAnyRole(["admin", "sales"])) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">
          Anda tidak memiliki akses untuk membuat sales order.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <PageHeader
        backTo="/sales-orders"
        title="SO Baru"
        description="Nomor SO akan dibuat otomatis saat disimpan."
      />

      <SalesOrderForm
        submitLabel="Simpan sebagai Draft"
        submitting={create.isPending}
        onSubmit={async (values) => {
          try {
            const so = await create.mutateAsync(values);
            toast.success(`SO ${so.so_number} dibuat`);
            navigate({ to: "/sales-orders/$id", params: { id: so.id } });
          } catch (e) {
            notifyError(e);
          }
        }}
      />
    </div>
  );
}
