import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Ruler } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  useEngineeringJobs,
  type EngineeringJobWithContext,
} from "@/features/engineering/hooks/use-engineering-jobs";
import { useEngineers } from "@/features/engineering/hooks/use-engineers";
import { JobCard } from "@/features/engineering/components/job-card";
import { ENG_STATUS_LABEL } from "@/features/engineering/lib/status";
import {
  ENGINEERING_STATUSES,
  type EngineeringStatus,
} from "@/features/engineering/types";
import { useMyRoles } from "@/hooks/use-my-roles";

export const Route = createFileRoute("/_authenticated/engineering/")({
  head: () => ({
    meta: [
      { title: "Engineering Job — DSM MOS" },
      {
        name: "description",
        content:
          "Papan Engineering Job DSM MOS: draft, in progress, review, approved.",
      },
      { property: "og:title", content: "Engineering Job — DSM MOS" },
      { property: "og:description", content: "Papan Engineering Job DSM MOS." },
    ],
  }),
  component: EngineeringBoardPage,
});

function EngineeringBoardPage() {
  const { hasAnyRole } = useMyRoles();
  const canManage = hasAnyRole(["admin", "engineering"]);
  const { data: jobs = [], isLoading } = useEngineeringJobs();
  const { data: engineers = [] } = useEngineers(canManage);

  const emailById = useMemo(
    () => new Map(engineers.map((e) => [e.user_id, e.email])),
    [engineers],
  );

  const grouped = useMemo(() => {
    const map = new Map<EngineeringStatus, EngineeringJobWithContext[]>();
    ENGINEERING_STATUSES.forEach((s) => map.set(s, []));
    jobs.forEach((j) => map.get(j.status)?.push(j));
    return map;
  }, [jobs]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Ruler className="h-5 w-5" />
          <div>
            <h1 className="text-2xl font-semibold">Engineering Job</h1>
            <p className="text-sm text-muted-foreground">
              Job dibuat otomatis saat Sales Order dikonfirmasi.
            </p>
          </div>
        </div>
        {canManage && (
          <Button variant="outline" asChild>
            <Link to="/engineering/workload">Lihat Workload</Link>
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {ENGINEERING_STATUSES.map((s) => (
            <Skeleton key={s} className="h-64" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {ENGINEERING_STATUSES.map((s) => {
            const items = grouped.get(s) ?? [];
            return (
              <div
                key={s}
                className="rounded-xl border bg-muted/30 p-3 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">
                    {ENG_STATUS_LABEL[s]}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {items.length}
                  </span>
                </div>
                <div className="space-y-2 min-h-[80px]">
                  {items.length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-6">
                      Kosong
                    </div>
                  )}
                  {items.map((j) => (
                    <JobCard
                      key={j.id}
                      job={j}
                      assigneeEmail={
                        j.assigned_to
                          ? (emailById.get(j.assigned_to) ?? null)
                          : null
                      }
                    />
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
