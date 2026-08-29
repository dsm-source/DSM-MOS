import { createFileRoute, redirect } from "@tanstack/react-router";
import { notifyError } from "@/lib/error-message";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listUsersWithRoles,
  assignRole,
  unassignRole,
  listAuditLogs,
} from "@/lib/admin-users.functions";
import type { AppRole } from "@/lib/roles.functions";
import { myRolesQueryOptions } from "@/hooks/use-my-roles";
import { CreateUserDialog } from "@/features/admin/components/create-user-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

const ALL_ROLES: AppRole[] = [
  "admin",
  "sales",
  "engineering",
  "material",
  "production_planning",
  "production",
  "qc",
  "delivery",
  "viewer",
];

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ context }) => {
    const roles =
      await context.queryClient.ensureQueryData(myRolesQueryOptions);
    if (!roles.includes("admin")) {
      throw redirect({ to: "/dashboard" });
    }
  },
  head: () => ({
    meta: [
      { title: "Kelola Peran User — DSM MOS" },
      {
        name: "description",
        content: "Kelola peran user pada DSM Manufacturing Operating System.",
      },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listUsersWithRoles);
  const assignFn = useServerFn(assignRole);
  const unassignFn = useServerFn(unassignRole);
  const auditLogsFn = useServerFn(listAuditLogs);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users-with-roles"],
    queryFn: () => listFn(),
  });

  const {
    data: auditLogs,
    isLoading: isLoadingAuditLogs,
    isError: isAuditLogsError,
    error: auditLogsError,
  } = useQuery({
    queryKey: ["admin", "audit-logs"],
    queryFn: () => auditLogsFn(),
  });

  const mutation = useMutation({
    mutationFn: async (v: {
      userId: string;
      role: AppRole;
      assign: boolean;
    }) => {
      if (v.assign)
        return assignFn({ data: { userId: v.userId, role: v.role } });
      return unassignFn({ data: { userId: v.userId, role: v.role } });
    },
    onSuccess: (_r, v) => {
      toast.success(v.assign ? "Peran ditambahkan" : "Peran dicabut");
      qc.invalidateQueries({ queryKey: ["admin", "users-with-roles"] });
      qc.invalidateQueries({ queryKey: ["my-roles"] });
    },
    onError: (e: Error) => notifyError(e),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Kelola Peran User</h1>
          <p className="text-sm text-muted-foreground">
            Centang untuk menugaskan peran. Hanya admin yang dapat mengubah.
          </p>
        </div>
        <CreateUserDialog roles={ALL_ROLES} />
      </div>

      <div className="rounded-xl border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[220px]">User</TableHead>
              {ALL_ROLES.map((r) => (
                <TableHead key={r} className="text-center text-xs">
                  {r}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={ALL_ROLES.length + 1}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {data?.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="text-sm font-medium">
                    {u.email ?? "(no email)"}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {u.id.slice(0, 8)}…
                  </div>
                </TableCell>
                {ALL_ROLES.map((role) => {
                  const has = u.roles.includes(role);
                  return (
                    <TableCell key={role} className="text-center">
                      <Checkbox
                        checked={has}
                        disabled={mutation.isPending}
                        onCheckedChange={(v) =>
                          mutation.mutate({
                            userId: u.id,
                            role,
                            assign: v === true,
                          })
                        }
                        aria-label={`${role} untuk ${u.email ?? u.id}`}
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
            {data && data.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={ALL_ROLES.length + 1}
                  className="text-center text-muted-foreground"
                >
                  Belum ada user.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div>
        <h2 className="text-xl font-semibold">Audit Log</h2>
        <p className="text-sm text-muted-foreground">
          100 perubahan terbaru pada data sistem.
        </p>
      </div>

      {isAuditLogsError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Gagal memuat audit log</AlertTitle>
          <AlertDescription>
            {auditLogsError instanceof Error
              ? auditLogsError.message
              : "Coba muat ulang halaman untuk mengambil data terbaru."}
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-xl border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Waktu</TableHead>
              <TableHead>Tabel</TableHead>
              <TableHead>Aksi</TableHead>
              <TableHead>Status Lama</TableHead>
              <TableHead>Status Baru</TableHead>
              <TableHead>Diubah Oleh</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingAuditLogs &&
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {auditLogs?.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-sm">
                  {new Date(log.changed_at).toLocaleString("id-ID")}
                </TableCell>
                <TableCell className="text-sm">{log.table_name}</TableCell>
                <TableCell className="text-sm">{log.action}</TableCell>
                <TableCell className="text-sm">
                  {log.old_status ?? "-"}
                </TableCell>
                <TableCell className="text-sm">
                  {log.new_status ?? "-"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground font-mono">
                  {log.changed_by ? `${log.changed_by.slice(0, 8)}…` : "sistem"}
                </TableCell>
              </TableRow>
            ))}
            {auditLogs && auditLogs.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground"
                >
                  Belum ada log.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
