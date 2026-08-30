import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { notifyError } from "@/lib/error-message";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { SalesOrderForm } from "@/features/sales-orders/components/sales-order-form";
import { useCreateSalesOrder } from "@/features/sales-orders/hooks/use-sales-orders";
import { myRolesQueryOptions } from "@/hooks/use-my-roles";

export const Route = createFileRoute("/_authenticated/sales-orders/new")({
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
  head: () => ({ meta: [{ title: "SO Baru — DSM MOS" }] }),
  component: NewSalesOrderPage,
});

function NewSalesOrderPage() {
  const navigate = useNavigate();
  const create = useCreateSalesOrder();

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <PageHeader
        onBack={() =>
          navigate({
            to: "/sales-orders",
            search: { page: 1, status: "all", q: "" },
          })
        }
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
