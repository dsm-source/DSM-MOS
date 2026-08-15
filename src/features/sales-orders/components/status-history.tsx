import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/features/sales-orders/components/status-badge";
import { useSalesOrderStatusHistory } from "@/features/sales-orders/hooks/use-sales-orders";

export function StatusHistory({ salesOrderId }: { salesOrderId: string }) {
  const {
    data: history = [],
    isLoading,
    isError,
    error,
  } = useSalesOrderStatusHistory(salesOrderId);

  if (isLoading) {
    return <Skeleton className="h-24 w-full" />;
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive py-6 text-center">
        Gagal memuat riwayat status:{" "}
        {error instanceof Error ? error.message : "Unknown error"}
      </p>
    );
  }

  if (history.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Belum ada riwayat status.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {history.map((h) => (
        <li
          key={h.id}
          className="rounded-xl border p-3 flex items-center justify-between gap-3 flex-wrap"
        >
          <div className="flex items-center gap-2 flex-wrap">
            {h.from_status && <StatusBadge status={h.from_status} />}
            {h.from_status && (
              <span className="text-muted-foreground text-xs">→</span>
            )}
            <StatusBadge status={h.to_status} />
          </div>
          <div className="text-xs text-muted-foreground">
            {new Date(h.changed_at).toLocaleString("id-ID")}
            {h.changed_by && <span> · oleh {h.changed_by.slice(0, 8)}…</span>}
          </div>
        </li>
      ))}
    </ol>
  );
}
