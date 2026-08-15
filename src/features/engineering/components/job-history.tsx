import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEngineeringJobHistory, type JobHistoryRow } from "../hooks/use-job-history";
import { getEngineerEmails, type UserEmail } from "@/lib/engineering-users.functions";
import { ENG_STATUS_LABEL } from "../lib/status";
import type { EngineeringStatus } from "../types";
import { Skeleton } from "@/components/ui/skeleton";

const FIELD_LABEL: Record<string, string> = {
  created: "Job dibuat",
  status: "Status",
  assigned_to: "Penanggung jawab",
  progress_percent: "Progress",
  target_completion_date: "Target penyelesaian",
  drawing_url: "Drawing",
  notes: "Catatan",
  approved_by: "Approved oleh",
};

function isUuid(v: string | null | undefined): v is string {
  return !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function isEngStatus(v: string | null): v is EngineeringStatus {
  return v === "draft" || v === "in_progress" || v === "review" || v === "approved";
}

function formatValue(
  field: string,
  value: string | null,
  emailById: Map<string, string | null>,
): string {
  if (value === null || value === "") return "—";
  if (field === "status" || field === "created") {
    return isEngStatus(value) ? ENG_STATUS_LABEL[value] : value;
  }
  if (field === "assigned_to" || field === "approved_by") {
    return emailById.get(value) ?? value.slice(0, 8);
  }
  if (field === "progress_percent") return `${value}%`;
  if (field === "drawing_url") return value.split("/").pop() ?? "file";
  if (field === "notes" && value.length > 80) return value.slice(0, 80) + "…";
  return value;
}

export function JobHistory({ jobId }: { jobId: string }) {
  const { data: rows = [], isLoading } = useEngineeringJobHistory(jobId);
  const getEmails = useServerFn(getEngineerEmails);

  const userIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of rows) {
      if (r.changed_by) ids.add(r.changed_by);
      if (r.field_changed === "assigned_to" || r.field_changed === "approved_by") {
        if (isUuid(r.from_value)) ids.add(r.from_value);
        if (isUuid(r.to_value)) ids.add(r.to_value);
      }
    }
    return Array.from(ids);
  }, [rows]);

  const { data: emails = [] } = useQuery<UserEmail[]>({
    enabled: userIds.length > 0,
    queryKey: ["user-emails", userIds.sort().join(",")],
    queryFn: () => getEmails({ data: { userIds } }),
    staleTime: 60_000,
  });
  const emailById = useMemo(
    () => new Map<string, string | null>(emails.map((e) => [e.id, e.email])),
    [emails],
  );

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Belum ada riwayat.</p>;
  }

  return (
    <ol className="relative border-l pl-4 space-y-3">
      {rows.map((r) => (
        <HistoryItem key={r.id} row={r} emailById={emailById} />
      ))}
    </ol>
  );
}

function HistoryItem({
  row,
  emailById,
}: {
  row: JobHistoryRow;
  emailById: Map<string, string | null>;
}) {
  const label = FIELD_LABEL[row.field_changed] ?? row.field_changed;
  const actor = row.changed_by
    ? (emailById.get(row.changed_by) ?? row.changed_by.slice(0, 8))
    : "Sistem";
  const when = new Date(row.changed_at).toLocaleString();

  const isCreated = row.field_changed === "created";
  const to = formatValue(row.field_changed, row.to_value, emailById);
  const from = formatValue(row.field_changed, row.from_value, emailById);

  return (
    <li className="relative">
      <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />
      <div className="text-sm">
        <span className="font-medium">{label}</span>{" "}
        {isCreated ? (
          <span className="text-muted-foreground">
            dengan status <span className="font-medium text-foreground">{to}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">
            berubah dari <span className="text-foreground">{from}</span> menjadi{" "}
            <span className="font-medium text-foreground">{to}</span>
          </span>
        )}
      </div>
      <div className="text-xs text-muted-foreground mt-0.5">
        {when} · oleh {actor}
      </div>
    </li>
  );
}
