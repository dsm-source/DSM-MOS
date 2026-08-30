import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { notifyError } from "@/lib/error-message";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { SalesOrderForm } from "@/features/sales-orders/components/sales-order-form";
import {
  useSalesOrder,
  useUpdateSalesOrder,
} from "@/features/sales-orders/hooks/use-sales-orders";
import { myRolesQueryOptions } from "@/hooks/use-my-roles";

export const Route = createFileRoute("/_authenticated/sales-orders/$id/edit")({
  beforeLoad: async ({ context }) => {
    const roles =
      await context.queryClient.ensureQueryData(myRolesQueryOptions);
    if (!roles.some((r) => r === "admin" || r === "sales")) {
      throw redirect({
        to: "/sales-orders",
        search: { page: 1, status: "all", q: "" },
      });
    }
  },
  head: () => ({ meta: [{ title: "Edit SO — DSM MOS" }] }),
  component: EditSalesOrderPage,
});

function EditSalesOrderPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useSalesOrder(id);
  const update = useUpdateSalesOrder();

  if (isLoading)
    return (
      <div className="p-6">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  if (!data) return <div className="p-6">SO tidak ditemukan.</div>;

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <PageHeader
        onBack={() => navigate({ to: "/sales-orders/$id", params: { id } })}
        titleClassName="font-mono"
        title={data.so_number}
        description="Edit sales order"
      />

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
