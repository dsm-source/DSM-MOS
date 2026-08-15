import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QcStatusBadge } from "./qc-status-badge";
import type { QcInspectionWithContext } from "../types";

export function InspectionCard({
  inspection,
  onOpen,
}: {
  inspection: QcInspectionWithContext;
  onOpen: () => void;
}) {
  const batch = inspection.production_batch;
  const so = batch?.engineering_job?.sales_order_item?.sales_order;
  const item = batch?.engineering_job?.sales_order_item;

  return (
    <Card className="p-4 space-y-3 hover:border-primary/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <div className="font-medium text-sm">{batch?.batch_number ?? "?"}</div>
          <div className="text-xs text-muted-foreground">
            SO {so?.so_number ?? "?"} · {so?.customer?.name ?? "-"}
          </div>
        </div>
        <QcStatusBadge status={inspection.status} />
      </div>

      <div className="text-sm">
        <div className="truncate">{item?.item_name ?? "-"}</div>
        <div className="text-xs text-muted-foreground">
          Qty batch: {batch?.quantity} {item?.unit ?? ""}
        </div>
      </div>

      {(inspection.status === "pass" || inspection.status === "reject") && (
        <div className="flex gap-3 text-xs">
          <span className="text-emerald-700 dark:text-emerald-300">OK: {inspection.qty_ok}</span>
          <span className="text-red-700 dark:text-red-300">Tolak: {inspection.qty_reject}</span>
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <div className="text-xs text-muted-foreground">
          {format(new Date(inspection.updated_at), "d MMM yyyy HH:mm", { locale: idLocale })}
        </div>
        <Button size="sm" variant="outline" onClick={onOpen}>
          Buka
        </Button>
      </div>
    </Card>
  );
}
