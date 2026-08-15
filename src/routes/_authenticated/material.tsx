import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Boxes } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useMyRoles } from "@/hooks/use-my-roles";
import {
  MATERIAL_STATUSES,
  useMaterialStatuses,
  useMaterialStatusesRealtime,
  type MaterialStatus,
  type MaterialWithContext,
} from "@/features/material/hooks/use-material-statuses";
import { MaterialCard } from "@/features/material/components/material-card";

export const Route = createFileRoute("/_authenticated/material")({
  head: () => ({
    meta: [
      { title: "Material Status — DSM MOS" },
      {
        name: "description",
        content: "Papan status material DSM MOS: menunggu, sebagian, siap.",
      },
      { property: "og:title", content: "Material Status — DSM MOS" },
      { property: "og:description", content: "Papan status material DSM MOS." },
    ],
  }),
  component: MaterialBoardPage,
});

function MaterialBoardPage() {
  const { hasAnyRole } = useMyRoles();
  const canEdit = hasAnyRole(["admin", "material"]);
  useMaterialStatusesRealtime();
  const { data: rows = [], isLoading } = useMaterialStatuses();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      const item = r.engineering_job?.sales_order_item;
      return [
        r.engineering_job?.job_number,
        item?.item_name,
        item?.drawing_number,
        item?.material_spec,
        item?.sales_order?.so_number,
        item?.sales_order?.customer?.name,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(s));
    });
  }, [rows, q]);

  const grouped = useMemo(() => {
    const map = new Map<MaterialStatus, MaterialWithContext[]>();
    MATERIAL_STATUSES.forEach((s) => map.set(s.key, []));
    filtered.forEach((r) => map.get(r.status)?.push(r));
    return map;
  }, [filtered]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Boxes className="h-5 w-5" />
          <div>
            <h1 className="text-2xl font-semibold">Material Status</h1>
            <p className="text-sm text-muted-foreground">
              Kesiapan bahan per engineering job. Salah satu penentu produksi
              boleh berjalan.
            </p>
          </div>
        </div>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari job, SO, customer, item, spek..."
          className="w-full sm:w-80"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {MATERIAL_STATUSES.map((s) => (
            <Skeleton key={s.key} className="h-64" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {MATERIAL_STATUSES.map((s) => {
            const items = grouped.get(s.key) ?? [];
            return (
              <div
                key={s.key}
                className={`rounded-xl border-2 p-3 space-y-3 ${s.className}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-3 w-3 rounded-full ${s.dot}`}
                      aria-hidden
                    />
                    <div className="text-sm font-bold uppercase tracking-wide">
                      {s.label}
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-background/70">
                    {items.length}
                  </span>
                </div>
                <div className="space-y-2 min-h-[80px]">
                  {items.length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-6">
                      Kosong
                    </div>
                  )}
                  {items.map((r) => (
                    <MaterialCard key={r.id} row={r} canEdit={canEdit} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
