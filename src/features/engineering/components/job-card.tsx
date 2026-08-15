import { Link } from "@tanstack/react-router";
import { User } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { TargetBadge } from "./target-badge";
import type { EngineeringJobWithContext } from "../hooks/use-engineering-jobs";

export function JobCard({
  job,
  assigneeEmail,
}: {
  job: EngineeringJobWithContext;
  assigneeEmail: string | null;
}) {
  const item = job.sales_order_item;
  const so = item?.sales_order;
  return (
    <Link
      to="/engineering/$id"
      params={{ id: job.id }}
      className="block rounded-xl border bg-card p-3 hover:shadow-sm transition-shadow space-y-2"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-muted-foreground">
          {job.job_number}
        </span>
        <TargetBadge target={job.target_completion_date} status={job.status} />
      </div>
      <div>
        <div className="text-sm font-medium truncate">
          {item?.item_name ?? "—"}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {so ? `${so.so_number} · ${so.customer?.name ?? ""}` : ""}
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <User className="h-3 w-3" />
        <span className="truncate">
          {job.assigned_to
            ? (assigneeEmail ?? job.assigned_to.slice(0, 8))
            : "Belum di-assign"}
        </span>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium">{job.progress_percent}%</span>
        </div>
        <Progress value={job.progress_percent} className="h-1.5" />
      </div>
    </Link>
  );
}
