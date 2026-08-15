import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { useQcInspectionsForBatch } from "../hooks/use-inspections";
import { QcStatusBadge } from "./qc-status-badge";

export function InspectionTimeline({
  batchId,
  currentId,
}: {
  batchId: string;
  currentId?: string;
}) {
  const { data = [], isLoading } = useQcInspectionsForBatch(batchId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat riwayat…
      </div>
    );
  }
  if (data.length === 0) {
    return <div className="text-sm text-muted-foreground">Belum ada riwayat.</div>;
  }

  return (
    <ol className="relative border-l pl-4 space-y-3">
      {data.map((r, idx) => {
        const active = r.id === currentId;
        return (
          <li key={r.id} className="relative">
            <span
              className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 ${
                active ? "bg-primary border-primary" : "bg-background border-muted-foreground/40"
              }`}
            />
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium">Putaran {idx + 1}</span>
              <QcStatusBadge status={r.status} />
              <span className="text-xs text-muted-foreground">
                {format(new Date(r.updated_at), "d MMM yyyy HH:mm", { locale: idLocale })}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Total: {r.qty_total} · OK: {r.qty_ok} · Tolak: {r.qty_reject}
              {r.photo_urls && r.photo_urls.length > 0 ? ` · ${r.photo_urls.length} foto` : ""}
            </div>
            {r.defect_notes && (
              <div className="text-xs mt-1 whitespace-pre-wrap">{r.defect_notes}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
