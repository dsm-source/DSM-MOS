import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { notifyError } from "@/lib/error-message";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { SalesOrderForm } from "@/features/sales-orders/components/sales-order-form";
import { useCreateSalesOrder } from "@/features/sales-orders/hooks/use-sales-orders";

export const Route = createFileRoute("/_authenticated/sales-orders/new")({
  head: () => ({ meta: [{ title: "SO Baru — DSM MOS" }] }),
  component: NewSalesOrderPage,
});

function NewSalesOrderPage() {
  const navigate = useNavigate();
  const create = useCreateSalesOrder();

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate({ to: "/sales-orders" })}
          aria-label="Kembali"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">SO Baru</h1>
          <p className="text-sm text-muted-foreground">
            Nomor SO akan dibuat otomatis saat disimpan.
          </p>
        </div>
      </div>

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
