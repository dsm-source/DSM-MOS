import { createFileRoute } from "@tanstack/react-router";
import { notifyError } from "@/lib/error-message";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Boxes, Factory, AlertCircle } from "lucide-react";
import { useMyRoles } from "@/hooks/use-my-roles";
import { claimFirstAdmin, isRolesTableEmpty } from "@/lib/roles.functions";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  useSoStatusCounts,
  useMaterialWaitingCount,
  useProductionRunningCount,
} from "@/features/dashboard/hooks/use-dashboard-stats";
import { SO_STATUS_META } from "@/features/sales-orders/lib/status";
import { toneClass } from "@/lib/status-tone";
import type { SalesOrderStatus } from "@/features/sales-orders/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — DSM MOS" },
      { name: "description", content: "Ringkasan modul DSM MOS." },
    ],
  }),
  component: DashboardPage,
});

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  loading,
  error,
}: {
  title: string;
  value: number | string;
  icon: typeof FileText;
  description?: string;
  loading?: boolean;
  error?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-9 w-16" />
        ) : (
          <div className="text-3xl font-semibold tracking-tight">
            {error ? "—" : value}
          </div>
        )}
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function DashboardPage() {
  const { roles } = useMyRoles();
  const queryClient = useQueryClient();

  const checkEmpty = useServerFn(isRolesTableEmpty);
  const claim = useServerFn(claimFirstAdmin);

  const emptyQuery = useQuery({
    queryKey: ["roles-table-empty"],
    queryFn: () => checkEmpty(),
    enabled: roles.length === 0,
  });

  const claimMutation = useMutation({
    mutationFn: () => claim(),
    onSuccess: (data) => {
      if (data.claimed) {
        toast.success("Anda sekarang admin pertama.");
        queryClient.invalidateQueries({ queryKey: ["my-roles"] });
        queryClient.invalidateQueries({ queryKey: ["roles-table-empty"] });
      } else {
        toast.error("Tidak bisa klaim admin", {
          description: "Admin sudah pernah ditetapkan sebelumnya.",
        });
      }
    },
    onError: (e) => notifyError(e, { title: "Gagal klaim admin" }),
  });

  const soStatus = useSoStatusCounts();
  const materialWaiting = useMaterialWaitingCount();
  const productionRunning = useProductionRunningCount();

  const dashboardError =
    soStatus.error ?? materialWaiting.error ?? productionRunning.error;
  const hasDashboardError =
    soStatus.isError || materialWaiting.isError || productionRunning.isError;

  const soByStatus = new Map<string, number>();
  for (const row of soStatus.data ?? []) soByStatus.set(row.status, row.count);
  const soTotal = (soStatus.data ?? []).reduce((sum, r) => sum + r.count, 0);
  const soActive =
    soTotal -
    (soByStatus.get("completed") ?? 0) -
    (soByStatus.get("cancelled") ?? 0);

  const orderedStatuses: SalesOrderStatus[] = [
    "draft",
    "confirmed",
    "engineering",
    "production",
    "quality_control",
    "delivery",
    "completed",
    "cancelled",
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Dashboard"
        description="Ringkasan operasional lintas modul."
      />

      {/* Peran & bootstrap admin */}
      {roles.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Peran Anda</CardTitle>
            <CardDescription>
              Menentukan modul yang bisa Anda akses.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Belum ada peran yang ditugaskan ke akun Anda. Hubungi admin
              sistem.
            </p>
            {emptyQuery.data?.empty && (
              <div className="rounded-md border border-dashed p-4">
                <p className="text-sm font-medium">Belum ada admin di sistem</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Karena tabel peran masih kosong, Anda dapat mengklaim posisi
                  admin pertama. Aksi ini hanya bisa dilakukan sekali.
                </p>
                <Button
                  className="mt-3"
                  size="sm"
                  onClick={() => claimMutation.mutate()}
                  disabled={claimMutation.isPending}
                >
                  {claimMutation.isPending
                    ? "Memproses..."
                    : "Klaim admin pertama"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Peran Anda:</span>
          {roles.map((r) => (
            <Badge key={r} variant="secondary">
              {r}
            </Badge>
          ))}
        </div>
      )}

      {hasDashboardError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Gagal memuat ringkasan dashboard</AlertTitle>
          <AlertDescription>
            {dashboardError instanceof Error
              ? dashboardError.message
              : "Coba muat ulang halaman untuk mengambil data terbaru."}
          </AlertDescription>
        </Alert>
      )}

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Sales Order Aktif"
          value={soActive}
          icon={FileText}
          description={
            soStatus.isError
              ? "Gagal memuat data"
              : `${soTotal} total (termasuk selesai & dibatalkan)`
          }
          loading={soStatus.isLoading}
          error={soStatus.isError}
        />
        <StatCard
          title="Job Menunggu Material"
          value={materialWaiting.data ?? 0}
          icon={Boxes}
          description={
            materialWaiting.isError
              ? "Gagal memuat data"
              : "Engineering job dengan status material 'Waiting Material'"
          }
          loading={materialWaiting.isLoading}
          error={materialWaiting.isError}
        />
        <StatCard
          title="Produksi Berjalan"
          value={productionRunning.data ?? 0}
          icon={Factory}
          description={
            productionRunning.isError
              ? "Gagal memuat data"
              : "Tahapan produksi yang sedang running"
          }
          loading={productionRunning.isLoading}
          error={productionRunning.isError}
        />
      </div>

      {/* Sales Order per status */}
      <Card>
        <CardHeader>
          <CardTitle>Sales Order per Status</CardTitle>
          <CardDescription>
            Distribusi seluruh SO berdasarkan status saat ini.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {soStatus.isLoading ? (
            <p className="text-sm text-muted-foreground">Memuat…</p>
          ) : soStatus.isError ? (
            <p className="text-sm text-destructive">
              Gagal memuat distribusi Sales Order.
            </p>
          ) : soTotal === 0 ? (
            <EmptyState
              icon={FileText}
              title="Belum ada Sales Order"
              description="Distribusi status akan muncul di sini setelah SO pertama dibuat."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {orderedStatuses.map((status) => {
                const count = soByStatus.get(status) ?? 0;
                const meta = SO_STATUS_META[status];
                const Icon = meta.icon;
                return (
                  <div
                    key={status}
                    className={cn(
                      "rounded-xl border px-4 py-3 flex items-center justify-between",
                      toneClass(meta.tone),
                    )}
                  >
                    <span className="text-sm font-medium flex items-center gap-1.5">
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      {meta.label}
                    </span>
                    <span className="text-xl font-semibold tabular-nums">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
