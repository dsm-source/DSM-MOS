import { toast } from "sonner";
import { notifyError } from "@/lib/error-message";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDeleteAssignment,
  useSOAssignments,
  useUpsertAssignment,
  useUsersByRole,
} from "@/features/sales-orders/hooks/use-so-assignments";
import type { AppRole } from "@/lib/roles.functions";

const ASSIGNABLE_ROLES: { role: AppRole; label: string }[] = [
  { role: "engineering", label: "Engineering" },
  { role: "material", label: "Material" },
  { role: "production_planning", label: "Production Planning" },
  { role: "production", label: "Production" },
  { role: "qc", label: "QC" },
  { role: "delivery", label: "Delivery" },
];

export function AssignmentsEditor({
  salesOrderId,
  canWrite,
}: {
  salesOrderId: string;
  canWrite: boolean;
}) {
  const { data: assignments = [], isLoading } = useSOAssignments(salesOrderId);
  const byRole = new Map(assignments.map((a) => [a.role, a]));

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Penanggung Jawab</h2>
        <span className="text-xs text-muted-foreground">
          Notifikasi status akan dikirim ke user yang ditugaskan di sini.
        </span>
      </div>
      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {ASSIGNABLE_ROLES.map((r) => (
            <AssignmentRow
              key={r.role}
              salesOrderId={salesOrderId}
              role={r.role}
              label={r.label}
              currentUserId={byRole.get(r.role)?.user_id ?? null}
              canWrite={canWrite}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AssignmentRow({
  salesOrderId,
  role,
  label,
  currentUserId,
  canWrite,
}: {
  salesOrderId: string;
  role: AppRole;
  label: string;
  currentUserId: string | null;
  canWrite: boolean;
}) {
  const { data: users = [], isLoading } = useUsersByRole(
    canWrite ? role : null,
  );
  const upsert = useUpsertAssignment();
  const del = useDeleteAssignment();

  const currentUser = users.find((u) => u.user_id === currentUserId);
  const displayEmail =
    currentUser?.email ??
    (currentUserId ? `(user ${currentUserId.slice(0, 8)}…)` : null);

  return (
    <div className="flex items-center gap-2 border rounded-xl px-3 py-2">
      <div className="min-w-[140px]">
        <div className="text-xs text-muted-foreground">{label}</div>
        {!canWrite && (
          <div className="text-sm font-medium truncate">
            {displayEmail ?? (
              <span className="text-muted-foreground">— belum di-assign</span>
            )}
          </div>
        )}
      </div>
      {canWrite && (
        <div className="flex-1 flex items-center gap-2">
          <Select
            value={currentUserId ?? ""}
            onValueChange={async (v) => {
              try {
                await upsert.mutateAsync({ salesOrderId, role, userId: v });
                toast.success(`${label} di-assign`);
              } catch (e) {
                notifyError(e);
              }
            }}
            disabled={isLoading || upsert.isPending}
          >
            <SelectTrigger className="h-9">
              <SelectValue
                placeholder={
                  isLoading
                    ? "Memuat..."
                    : users.length === 0
                      ? "Tidak ada user dengan role ini"
                      : "Pilih user"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {users.map((u) => (
                <SelectItem key={u.user_id} value={u.user_id}>
                  {u.email ?? u.user_id.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {currentUserId && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 flex-shrink-0"
              disabled={del.isPending}
              onClick={async () => {
                try {
                  await del.mutateAsync({ salesOrderId, role });
                  toast.success(`${label} dilepas`);
                } catch (e) {
                  notifyError(e);
                }
              }}
              aria-label={`Lepas ${label}`}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
