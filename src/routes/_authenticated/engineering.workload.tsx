import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEngineeringWorkload } from "@/features/engineering/hooks/use-workload";
import { getMyRoles } from "@/lib/roles.functions";

export const Route = createFileRoute("/_authenticated/engineering/workload")({
  head: () => ({ meta: [{ title: "Engineering Workload — DSM MOS" }] }),
  beforeLoad: async () => {
    const roles = await getMyRoles();
    const allowed = roles.some((r) => r === "admin" || r === "engineering");
    if (!allowed) throw redirect({ to: "/dashboard" });
  },
  component: WorkloadPage,
});

function WorkloadPage() {
  const { data = [], isLoading } = useEngineeringWorkload(true);

  const sorted = [...data].sort((a, b) => {
    if (b.overdue_count !== a.overdue_count) return b.overdue_count - a.overdue_count;
    return b.total_jobs - a.total_jobs;
  });

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild aria-label="Kembali">
          <Link to="/engineering">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Engineering Workload</h1>
          <p className="text-sm text-muted-foreground">
            Beban kerja per engineer. Baris dengan job terlambat disorot.
          </p>
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-x-auto">
        {isLoading ? (
          <div className="p-4">
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Engineer</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Draft</TableHead>
                <TableHead className="text-right">In Progress</TableHead>
                <TableHead className="text-right">Review</TableHead>
                <TableHead className="text-right">Approved</TableHead>
                <TableHead className="text-right">Rata-rata Progress</TableHead>
                <TableHead className="text-right">Terlambat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Belum ada job yang di-assign.
                  </TableCell>
                </TableRow>
              )}
              {sorted.map((r) => {
                const overdue = r.overdue_count > 0;
                return (
                  <TableRow
                    key={r.assigned_to}
                    className={overdue ? "bg-rose-50/60 dark:bg-rose-900/10" : undefined}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {overdue && (
                          <AlertTriangle
                            className="h-4 w-4 text-rose-600"
                            aria-label="Ada job terlambat"
                          />
                        )}
                        <span>{r.assignee_email ?? r.assigned_to.slice(0, 8)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">{r.total_jobs}</TableCell>
                    <TableCell className="text-right font-mono">{r.draft_count}</TableCell>
                    <TableCell className="text-right font-mono">{r.in_progress_count}</TableCell>
                    <TableCell className="text-right font-mono">{r.review_count}</TableCell>
                    <TableCell className="text-right font-mono">{r.approved_count}</TableCell>
                    <TableCell className="text-right font-mono">
                      {r.avg_progress != null ? `${r.avg_progress}%` : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {overdue ? (
                        <span className="inline-flex items-center rounded-md border border-rose-300 bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800 dark:bg-rose-900/40 dark:text-rose-200 dark:border-rose-800">
                          {r.overdue_count} terlambat
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
