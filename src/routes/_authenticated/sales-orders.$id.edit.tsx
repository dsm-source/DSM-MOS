import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { notifyError } from "@/lib/error-message";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SalesOrderForm } from "@/features/sales-orders/components/sales-order-form";
import {
  useSalesOrder,
  useUpdateSalesOrder,
} from "@/features/sales-orders/hooks/use-sales-orders";
import { useMyRoles } from "@/hooks/use-my-roles";

export const Route = createFileRoute("/_authenticated/sales-orders/$id/edit")({
  head: () => ({ meta: [{ title: "Edit SO — DSM MOS" }] }),
  component: EditSalesOrderPage,
});

function EditSalesOrderPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useSalesOrder(id);
  const update = useUpdateSalesOrder();
  const { hasAnyRole } = useMyRoles();

  if (!hasAnyRole(["admin", "sales"])) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">
          Anda tidak memiliki akses untuk mengubah sales order.
        </p>
      </div>
    );
  }

  if (isLoading)
    return (
      <div className="p-6">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  if (!data) return <div className="p-6">SO tidak ditemukan.</div>;

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate({ to: "/sales-orders/$id", params: { id } })}
          aria-label="Kembali"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold font-mono">{data.so_number}</h1>
          <p className="text-sm text-muted-foreground">Edit sales order</p>
        </div>
      </div>

      <SalesOrderForm
        submitLabel="Simpan perubahan"
        submitting={update.isPending}
        defaultValues={{
          customer_id: data.customer_id,
          order_date: data.order_date,
          due_date: data.due_date ?? "",
          notes: data.notes ?? "",
          items: (data.items ?? []).map((it) => ({
            id: it.id,
            item_name: it.item_name,
            drawing_number: it.drawing_number ?? "",
            quantity: Number(it.quantity),
            unit: it.unit,
            material_spec: it.material_spec ?? "",
          })),
        }}
        onSubmit={async (values) => {
          try {
            await update.mutateAsync({ id, values });
            toast.success("SO diperbarui");
            navigate({ to: "/sales-orders/$id", params: { id } });
          } catch (e) {
            notifyError(e);
          }
        }}
      />
    </div>
  );
}
