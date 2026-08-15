import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Wrench,
  Package,
  Clock,
  Hourglass,
  FileText,
  FileDown,
  Search,
  X,
  Loader2,
  UserX,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorNotice } from "@/components/error-notice";
import { notifyError } from "@/lib/error-message";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  useBlockerHistory,
  type BlockerEvent,
} from "../hooks/use-blocker-history";
import { resolveActorEmails } from "../hooks/use-actor-emails";

type MilestoneFilter = "all" | "approved" | "material_ready" | "non_milestone";
type SourceFilter = "all" | "engineering" | "material";

const ENG_LABEL: Record<string, string> = {
  draft: "Draft",
  in_progress: "Dikerjakan",
  review: "Review",
  approved: "Approved",
};

const MAT_LABEL: Record<string, string> = {
  waiting_material: "Menunggu Material",
  partial_material: "Material Sebagian",
  material_ready: "Material Ready",
};

function label(
  source: "engineering" | "material",
  status: string | null,
): string {
  if (!status) return "—";
  return (
    (source === "engineering" ? ENG_LABEL[status] : MAT_LABEL[status]) ?? status
  );
}

function actorName(e: BlockerEvent): string {
  if (!e.changed_by) return "Sistem";
  if (!e.actor_email) return `Pengguna ${shortActorId(e.changed_by)}`;
  const at = e.actor_email.indexOf("@");
  return at > 0 ? e.actor_email.slice(0, at) : e.actor_email;
}

/** Potongan pendek user id, dipakai sebagai placebo identitas saat email gagal dimuat. */
function shortActorId(id: string): string {
  return id.slice(0, 8);
}

/** True bila event punya aktor tapi namanya belum/gagal ter-resolve. */
function isActorUnresolved(e: BlockerEvent): boolean {
  return Boolean(e.changed_by) && !e.actor_email;
}

/** Stable identifier for an actor across events (used by the actor filter). */
function actorKeyOf(e: BlockerEvent): string {
  return e.changed_by ?? e.actor_email ?? "__system__";
}

/** Format durasi antara dua ISO timestamps (menit/jam/hari). */
function formatDurationBetween(fromIso: string, toIso: string): string {
  const ms = Math.max(
    0,
    new Date(toIso).getTime() - new Date(fromIso).getTime(),
  );
  let s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  if (d > 0) return `${d}h ${h}j`;
  if (h > 0) return `${h}j ${m}m`;
  return `${m}m`;
}

function WaitSummary({ events }: { events: BlockerEvent[] }) {
  const engApproved = events.find(
    (e) => e.source === "engineering" && e.to_status === "approved",
  );
  const matReady = events.find(
    (e) => e.source === "material" && e.to_status === "material_ready",
  );
  const nowIso = new Date().toISOString();

  // Kedua milestone sudah tercapai → tampilkan gap antar milestone.
  if (engApproved && matReady) {
    const [firstMs, secondMs] = [engApproved, matReady].sort((a, b) =>
      a.changed_at.localeCompare(b.changed_at),
    );
    const firstLabel =
      firstMs.source === "engineering"
        ? "Engineering approved"
        : "Material ready";
    const secondLabel =
      secondMs.source === "engineering"
        ? "Engineering approved"
        : "Material ready";
    const gap = formatDurationBetween(firstMs.changed_at, secondMs.changed_at);
    return (
      <div className="rounded-md border border-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 dark:border-emerald-800 p-2 mb-3 flex items-start gap-2">
        <Hourglass className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-300" />
        <div className="text-xs text-emerald-900 dark:text-emerald-100 space-y-0.5">
          <div className="font-medium">Total menunggu: {gap}</div>
          <div className="text-emerald-800/80 dark:text-emerald-200/80">
            Dari <strong>{firstLabel}</strong> oleh{" "}
            <strong>{actorName(firstMs)}</strong> (
            {new Date(firstMs.changed_at).toLocaleString()}) sampai{" "}
            <strong>{secondLabel}</strong> oleh{" "}
            <strong>{actorName(secondMs)}</strong> (
            {new Date(secondMs.changed_at).toLocaleString()}).
          </div>
        </div>
      </div>
    );
  }

  // Salah satu tercapai → tampilkan berapa lama sudah menunggu sisi yang lain.
  if (engApproved || matReady) {
    const reached = (engApproved ?? matReady)!;
    const reachedLabel =
      reached.source === "engineering"
        ? "Engineering approved"
        : "Material ready";
    const pendingLabel =
      reached.source === "engineering"
        ? "Material ready"
        : "Engineering approved";
    const dur = formatDurationBetween(reached.changed_at, nowIso);
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-900/30 dark:border-amber-800 p-2 mb-3 flex items-start gap-2">
        <Hourglass className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-700 dark:text-amber-300" />
        <div className="text-xs text-amber-900 dark:text-amber-100 space-y-0.5">
          <div className="font-medium">
            Menunggu {pendingLabel}: {dur}
          </div>
          <div className="text-amber-800/80 dark:text-amber-200/80">
            {reachedLabel} oleh <strong>{actorName(reached)}</strong> sejak{" "}
            {new Date(reached.changed_at).toLocaleString()}.
          </div>
        </div>
      </div>
    );
  }

  // Belum ada milestone → hitung dari event paling awal.
  const first = events[0];
  if (!first) return null;
  const dur = formatDurationBetween(first.changed_at, nowIso);
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-900/30 dark:border-amber-800 p-2 mb-3 flex items-start gap-2">
      <Hourglass className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-700 dark:text-amber-300" />
      <div className="text-xs text-amber-900 dark:text-amber-100">
        <div className="font-medium">
          Menunggu Engineering & Material: {dur}
        </div>
        <div className="text-amber-800/80 dark:text-amber-200/80">
          Sejak perubahan pertama {new Date(first.changed_at).toLocaleString()}{" "}
          oleh <strong>{actorName(first)}</strong>.
        </div>
      </div>
    </div>
  );
}

type ActorStat = {
  key: string;
  name: string;
  email: string | null;
  approved: number;
  materialReady: number;
};

function ActorMilestoneStats({
  events,
  activeKey,
  onSelectActor,
}: {
  events: BlockerEvent[];
  activeKey: string | null;
  onSelectActor: (key: string | null) => void;
}) {
  const stats = useMemo<ActorStat[]>(() => {
    const map = new Map<string, ActorStat>();
    for (const e of events) {
      const isApproved =
        e.source === "engineering" && e.to_status === "approved";
      const isMatReady =
        e.source === "material" && e.to_status === "material_ready";
      if (!isApproved && !isMatReady) continue;
      const key = actorKeyOf(e);
      let row = map.get(key);
      if (!row) {
        row = {
          key,
          name: actorName(e),
          email: e.actor_email ?? null,
          approved: 0,
          materialReady: 0,
        };
        map.set(key, row);
      }
      if (isApproved) row.approved += 1;
      if (isMatReady) row.materialReady += 1;
    }
    return Array.from(map.values()).sort(
      (a, b) =>
        b.approved + b.materialReady - (a.approved + a.materialReady) ||
        a.name.localeCompare(b.name),
    );
  }, [events]);

  if (stats.length === 0) return null;

  const totalApproved = stats.reduce((s, r) => s + r.approved, 0);
  const totalMatReady = stats.reduce((s, r) => s + r.materialReady, 0);

  return (
    <div className="rounded-md border p-2 mb-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold">Milestone per aktor</div>
        <div className="text-[11px] text-muted-foreground flex items-center gap-2">
          <span className="inline-flex items-center gap-1">
            <Wrench className="h-3 w-3 text-blue-600 dark:text-blue-400" />{" "}
            Approved: {totalApproved}
          </span>
          <span className="text-muted-foreground/60">•</span>
          <span className="inline-flex items-center gap-1">
            <Package className="h-3 w-3 text-amber-600 dark:text-amber-400" />{" "}
            Material ready: {totalMatReady}
          </span>
        </div>
      </div>
      <ul className="divide-y divide-border">
        {stats.map((r) => {
          const isActive = activeKey === r.key;
          return (
            <li key={r.key} className="py-1">
              <button
                type="button"
                onClick={() => onSelectActor(isActive ? null : r.key)}
                className={
                  "w-full flex items-center justify-between text-xs rounded px-1.5 py-1 transition-colors " +
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background " +
                  (isActive
                    ? "bg-primary/10 text-foreground ring-1 ring-primary/40"
                    : "hover:bg-muted/60")
                }
                title={
                  isActive
                    ? "Klik lagi untuk menampilkan semua aktor"
                    : `Tampilkan semua aksi ${r.name} pada batch ini`
                }
                aria-pressed={isActive}
              >
                <span className="truncate mr-2 text-left">
                  <span className="font-medium text-foreground/90">
                    {r.name}
                  </span>
                  {r.email && (
                    <span className="text-muted-foreground"> · {r.email}</span>
                  )}
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <span
                    className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                    title="Engineering approved"
                  >
                    <Wrench className="h-3 w-3" />
                    {r.approved}
                  </span>
                  <span
                    className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                    title="Material ready"
                  >
                    <Package className="h-3 w-3" />
                    {r.materialReady}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function eventRow(e: BlockerEvent): [string, string, string, string, string] {
  return [
    new Date(e.changed_at).toLocaleString(),
    e.source === "engineering" ? "Engineering" : "Material",
    label(e.source, e.from_status),
    label(e.source, e.to_status),
    e.actor_email || (e.changed_by ? "Pengguna" : "Sistem"),
  ];
}

function slug(s: string): string {
  return s.replace(/[^a-zA-Z0-9-_]+/g, "_").slice(0, 40) || "batch";
}

async function exportCsv(events: BlockerEvent[], batchLabel: string) {
  const header = ["Waktu", "Sumber", "Dari", "Menjadi", "Aktor"];
  const rows = events.map(eventRow);
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = [header, ...rows].map((r) => r.map(escape).join(",")).join("\n");
  // BOM agar Excel mengenali UTF-8
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `riwayat-blocker-${slug(batchLabel)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function exportPdf(events: BlockerEvent[], batchLabel: string) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setFontSize(14);
  doc.text("Riwayat Blocker Batch", 40, 40);
  doc.setFontSize(10);
  doc.text(`Batch: ${batchLabel}`, 40, 58);
  doc.text(`Diekspor: ${new Date().toLocaleString()}`, 40, 72);
  autoTable(doc, {
    startY: 90,
    head: [["Waktu", "Sumber", "Dari", "Menjadi", "Aktor"]],
    body: events.map(eventRow),
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [30, 41, 59] },
  });
  doc.save(`riwayat-blocker-${slug(batchLabel)}.pdf`);
}

export function BlockerHistory({
  engineeringJobId,
  batchLabel,
}: {
  engineeringJobId: string | undefined;
  batchLabel?: string;
}) {
  const {
    data: events,
    isLoading,
    error,
    refetch,
  } = useBlockerHistory(engineeringJobId);
  const queryClient = useQueryClient();
  const label_ = batchLabel ?? "batch";

  const dateFromId = useId();
  const dateToId = useId();

  const [search, setSearch] = useState("");
  const [milestone, setMilestone] = useState<MilestoneFilter>("all");
  const [source, setSource] = useState<SourceFilter>("all");
  const [actorKey, setActorKey] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filtered = useMemo<BlockerEvent[]>(() => {
    if (!events) return [];
    const q = search.trim().toLowerCase();
    const fromMs = dateFrom ? new Date(dateFrom + "T00:00:00").getTime() : null;
    const toMs = dateTo ? new Date(dateTo + "T23:59:59.999").getTime() : null;
    return events.filter((e) => {
      const isEng = e.source === "engineering";
      const isApproved = isEng && e.to_status === "approved";
      const isMatReady = !isEng && e.to_status === "material_ready";
      const isMilestone = isApproved || isMatReady;
      if (milestone === "approved" && !isApproved) return false;
      if (milestone === "material_ready" && !isMatReady) return false;
      if (milestone === "non_milestone" && isMilestone) return false;
      if (source !== "all" && e.source !== source) return false;
      if (actorKey !== null && actorKeyOf(e) !== actorKey) return false;

      const t = new Date(e.changed_at).getTime();
      if (fromMs !== null && t < fromMs) return false;
      if (toMs !== null && t > toMs) return false;

      if (q) {
        const hay = [
          isEng ? "engineering" : "material",
          label(e.source, e.from_status),
          label(e.source, e.to_status),
          e.from_status ?? "",
          e.to_status,
          e.actor_email ?? "",
          actorName(e),
        ]

          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [events, search, milestone, source, actorKey, dateFrom, dateTo]);

  const hasEvents = !!events && events.length > 0;
  const hasFilters = !!(
    search ||
    milestone !== "all" ||
    source !== "all" ||
    actorKey ||
    dateFrom ||
    dateTo
  );
  const canExport = filtered.length > 0;

  const activeActorLabel = useMemo(() => {
    if (!actorKey || !events) return null;
    const ev = events.find((e) => actorKeyOf(e) === actorKey);
    return ev ? actorName(ev) : null;
  }, [actorKey, events]);

  const clearFilters = () => {
    setSearch("");
    setMilestone("all");
    setSource("all");
    setActorKey(null);
    setDateFrom("");
    setDateTo("");
  };

  // Kumpulkan user_id aktor pada baris terfilter agar bisa di-prefetch.
  const filteredActorIds = useMemo(
    () =>
      Array.from(
        new Set(
          filtered.map((e) => e.changed_by).filter((v): v is string => !!v),
        ),
      ),
    [filtered],
  );

  // Status resolusi email aktor terpisah agar pencarian & ekspor punya
  // indikator loading/error yang jelas — cache RPC bisa gagal (jaringan/RLS)
  // tanpa menggagalkan render timeline.
  const [emailsPrefetching, setEmailsPrefetching] = useState(false);
  const [emailsError, setEmailsError] = useState<string | null>(null);
  const [exportingFmt, setExportingFmt] = useState<"csv" | "pdf" | null>(null);
  const retryBtnRef = useRef<HTMLButtonElement | null>(null);
  const csvBtnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const prevErrorRef = useRef<string | null>(null);
  // Elemen yang dipegang pengguna sebelum bar error muncul — dipakai untuk
  // mengembalikan fokus ke area yang sama setelah error hilang.
  const focusBeforeErrorRef = useRef<HTMLElement | null>(null);
  // Menandai fokus yang dipindahkan oleh kode (bukan oleh pengguna) agar
  // handler onFocus tidak memicu prefetch berulang.
  const programmaticFocusRef = useRef(false);

  const focusProgrammatically = (el: HTMLElement | null) => {
    if (!el || !el.isConnected) return false;
    programmaticFocusRef.current = true;
    el.focus();
    queueMicrotask(() => {
      programmaticFocusRef.current = false;
    });
    return document.activeElement === el;
  };

  const focusIsLost = () => {
    const active = document.activeElement as HTMLElement | null;
    return !active || active === document.body || !active.isConnected;
  };

  // Aturan fokus:
  // 1. Error BARU muncul → pindahkan fokus ke "Coba lagi" (setelah menyimpan
  //    posisi fokus pengguna sebelumnya).
  // 2. Error yang sama muncul lagi (retry gagal) → jangan curi fokus; hanya
  //    pulihkan bila fokus hilang karena re-render melepas tombolnya.
  // 3. Error hilang → kembalikan fokus ke elemen asal pengguna bila masih ada,
  //    jika tidak, ke tombol ekspor CSV. Fokus yang sudah dipindahkan pengguna
  //    sendiri ke tempat lain tidak diganggu.
  useEffect(() => {
    const prev = prevErrorRef.current;

    if (emailsError && emailsError !== prev) {
      if (!prev) {
        const active = document.activeElement as HTMLElement | null;
        focusBeforeErrorRef.current =
          active &&
          active !== document.body &&
          panelRef.current?.contains(active)
            ? active
            : null;
      }
      queueMicrotask(() => focusProgrammatically(retryBtnRef.current));
    } else if (emailsError && emailsError === prev) {
      // Re-render dengan error yang sama: jaga fokus tetap di area yang sama.
      queueMicrotask(() => {
        if (focusIsLost()) focusProgrammatically(retryBtnRef.current);
      });
    } else if (!emailsError && prev) {
      const active = document.activeElement;
      if (focusIsLost() || active === retryBtnRef.current) {
        const previous = focusBeforeErrorRef.current;
        queueMicrotask(() => {
          if (!focusProgrammatically(previous)) {
            focusProgrammatically(csvBtnRef.current);
          }
        });
      }
      focusBeforeErrorRef.current = null;
    }
    prevErrorRef.current = emailsError;
  }, [emailsError]);

  // Hangatkan cache email aktor sebelum klik ekspor (hover/focus) sehingga
  // saat tombol ditekan hasilnya sudah tersedia tanpa menunggu RPC.
  const prefetchActorEmails = () => {
    if (filteredActorIds.length === 0) return;
    setEmailsPrefetching(true);
    resolveActorEmails(queryClient, filteredActorIds)
      .then(() => setEmailsError(null))
      .catch((e) =>
        setEmailsError(
          e instanceof Error ? e.message : "Gagal memuat nama aktor",
        ),
      )
      .finally(() => setEmailsPrefetching(false));
  };

  const prefetchOnFocus = () => {
    if (programmaticFocusRef.current) return;
    prefetchActorEmails();
  };

  const retryResolveEmails = () => {
    setEmailsError(null);
    prefetchActorEmails();
  };

  const handleExport = async (fmt: "csv" | "pdf") => {
    if (filtered.length === 0 || exportingFmt) return;
    setExportingFmt(fmt);
    try {
      // Pastikan email aktor tersedia (biasanya sudah warm dari hover di atas).
      const emailMap = await resolveActorEmails(queryClient, filteredActorIds);
      setEmailsError(null);
      const rows: BlockerEvent[] = filtered.map((e) =>
        e.changed_by
          ? { ...e, actor_email: emailMap.get(e.changed_by) ?? e.actor_email }
          : e,
      );
      if (fmt === "csv") await exportCsv(rows, label_);
      else await exportPdf(rows, label_);
      toast.success(`Ekspor ${fmt.toUpperCase()} berhasil`, {
        description: `${rows.length} baris riwayat blocker untuk ${label_} telah diunduh.`,
      });
    } catch (e) {
      const { detail } = notifyError(e, {
        title: `Ekspor ${fmt.toUpperCase()} gagal`,
      });
      setEmailsError(detail);
    } finally {
      setExportingFmt(null);
    }
  };

  return (
    <div ref={panelRef} className="rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Riwayat Blocker</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button
            ref={csvBtnRef}
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={!canExport || exportingFmt !== null}
            onMouseEnter={prefetchActorEmails}
            onFocus={prefetchOnFocus}
            onTouchStart={prefetchActorEmails}
            onClick={() => handleExport("csv")}
            aria-busy={exportingFmt === "csv"}
          >
            {exportingFmt === "csv" ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <FileDown className="h-3.5 w-3.5 mr-1" />
            )}
            {exportingFmt === "csv" ? "Menyiapkan…" : "CSV"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={!canExport || exportingFmt !== null}
            onMouseEnter={prefetchActorEmails}
            onFocus={prefetchOnFocus}
            onTouchStart={prefetchActorEmails}
            onClick={() => handleExport("pdf")}
            aria-busy={exportingFmt === "pdf"}
          >
            {exportingFmt === "pdf" ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <FileText className="h-3.5 w-3.5 mr-1" />
            )}
            {exportingFmt === "pdf" ? "Menyiapkan…" : "PDF"}
          </Button>
        </div>
      </div>
      {/* Live regions terpisah dan selalu ter-mount agar pembaca layar
          konsisten mengumumkan perubahan: 'polite' untuk loading, 'assertive'
          untuk error. aria-atomic supaya seluruh pesan dibacakan ulang. */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {emailsPrefetching && !emailsError
          ? "Menyiapkan nama aktor untuk pencarian dan ekspor."
          : ""}
      </div>
      {emailsError && (
        <ErrorNotice
          ref={retryBtnRef}
          className="mb-2"
          compact
          error={emailsError}
          title="Gagal memuat nama aktor"
          hint="Email fallback dipakai."
          srExtra="Email fallback dipakai."
          onRetry={retryResolveEmails}
        />
      )}
      {emailsPrefetching && !emailsError && (
        <div className="mb-2 flex items-center gap-2 rounded-md border border-muted bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground">
          <Loader2
            className="h-4 w-4 shrink-0 animate-spin"
            aria-hidden="true"
          />
          <span>Menyiapkan nama aktor untuk pencarian &amp; ekspor…</span>
        </div>
      )}
      <p className="text-xs text-muted-foreground mb-3">
        Kronologi perubahan status Engineering & Material yang menentukan kapan
        batch boleh mulai.
      </p>

      {hasEvents && (
        <div className="mb-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari status…"
                className="h-8 pl-7 text-xs"
              />
            </div>
            <Select
              value={milestone}
              onValueChange={(v) => setMilestone(v as MilestoneFilter)}
            >
              <SelectTrigger className="h-8 w-[170px] text-xs">
                <SelectValue placeholder="Milestone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua event</SelectItem>
                <SelectItem value="approved">Engineering Approved</SelectItem>
                <SelectItem value="material_ready">Material Ready</SelectItem>
                <SelectItem value="non_milestone">Non-milestone</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={source}
              onValueChange={(v) => setSource(v as SourceFilter)}
            >
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <SelectValue placeholder="Aktor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua aktor</SelectItem>
                <SelectItem value="engineering">Engineering</SelectItem>
                <SelectItem value="material">Material</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor={dateFromId}
              className="text-xs text-muted-foreground"
            >
              Dari
            </label>
            <Input
              id={dateFromId}
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              max={dateTo || undefined}
              className="h-8 w-[140px] text-xs"
            />
            <label htmlFor={dateToId} className="text-xs text-muted-foreground">
              s/d
            </label>
            <Input
              id={dateToId}
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              min={dateFrom || undefined}
              className="h-8 w-[140px] text-xs"
            />

            {hasFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={clearFilters}
              >
                <X className="h-3.5 w-3.5 mr-1" /> Reset
              </Button>
            )}
          </div>
          {hasFilters && (
            <div className="text-xs text-muted-foreground">
              Menampilkan {filtered.length} dari {events!.length} event.
            </div>
          )}
        </div>
      )}

      {isLoading && (
        <div className="text-xs text-muted-foreground">Memuat…</div>
      )}
      {error && (
        <ErrorNotice
          compact
          error={error}
          title="Gagal memuat riwayat blocker"
          actionLabel="Muat ulang"
          onRetry={() => {
            void refetch?.();
          }}
        />
      )}
      {!isLoading && !error && !hasEvents && (
        <div className="text-xs text-muted-foreground">
          Belum ada perubahan tercatat.
        </div>
      )}

      {hasEvents && <WaitSummary events={events!} />}
      {hasEvents && (
        <ActorMilestoneStats
          events={events!}
          activeKey={actorKey}
          onSelectActor={setActorKey}
        />
      )}

      {actorKey && (
        <div className="mb-2 flex items-center justify-between rounded-md border border-primary/40 bg-primary/5 px-2 py-1 text-xs">
          <span>
            Menampilkan aksi dari{" "}
            <strong>{activeActorLabel ?? "aktor terpilih"}</strong> pada batch
            ini.
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setActorKey(null)}
          >
            <X className="h-3 w-3 mr-1" /> Semua aktor
          </Button>
        </div>
      )}

      {hasEvents && filtered.length === 0 && (
        <div className="text-xs text-muted-foreground">
          Tidak ada event yang cocok dengan filter.
        </div>
      )}

      {filtered.length > 0 && (
        <ol className="space-y-2">
          {filtered.map((e) => {
            const isEng = e.source === "engineering";
            const isMilestone =
              (isEng && e.to_status === "approved") ||
              (!isEng && e.to_status === "material_ready");
            const Icon = isMilestone ? CheckCircle2 : isEng ? Wrench : Package;
            return (
              <li key={e.id} className="flex items-start gap-2 text-xs">
                <Icon
                  className={
                    "h-3.5 w-3.5 mt-0.5 shrink-0 " +
                    (isMilestone
                      ? "text-emerald-600 dark:text-emerald-400"
                      : isEng
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-amber-600 dark:text-amber-400")
                  }
                />
                <div className="min-w-0 flex-1">
                  <div>
                    <span className="font-medium">
                      {isEng ? "Engineering" : "Material"}:
                    </span>{" "}
                    <span className="text-muted-foreground">
                      {label(e.source, e.from_status)}
                    </span>
                    <span className="mx-1">→</span>
                    <span
                      className={
                        isMilestone
                          ? "font-semibold text-emerald-700 dark:text-emerald-300"
                          : "font-medium"
                      }
                    >
                      {label(e.source, e.to_status)}
                    </span>
                  </div>
                  <div className="text-muted-foreground flex flex-wrap items-center gap-x-2">
                    <span>{new Date(e.changed_at).toLocaleString()}</span>
                    <span className="text-muted-foreground/60">•</span>
                    <span
                      className="inline-flex items-center gap-1"
                      title={
                        isActorUnresolved(e)
                          ? `Nama aktor belum tersedia. ID pengguna: ${e.changed_by}`
                          : (e.actor_email ?? undefined)
                      }
                    >
                      oleh{" "}
                      {isActorUnresolved(e) && (
                        <UserX
                          className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const k = actorKeyOf(e);
                          setActorKey(actorKey === k ? null : k);
                        }}
                        className={
                          "rounded-sm font-medium underline decoration-dotted underline-offset-2 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background " +
                          (isActorUnresolved(e)
                            ? "text-muted-foreground italic"
                            : "text-foreground/80")
                        }
                        aria-pressed={actorKey === actorKeyOf(e)}
                        title={`Tampilkan semua aksi ${actorName(e)} pada batch ini`}
                      >
                        {actorName(e)}
                      </button>
                      {isActorUnresolved(e) && (
                        <>
                          <span className="sr-only">
                            Nama aktor gagal dimuat, menampilkan ID pengguna
                            singkat.
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1.5 text-[11px]"
                            onClick={retryResolveEmails}
                            disabled={emailsPrefetching}
                            aria-label={`Coba lagi memuat nama aktor untuk pengguna ${shortActorId(e.changed_by!)}`}
                          >
                            {emailsPrefetching ? (
                              <Loader2
                                className="h-3 w-3 mr-1 animate-spin"
                                aria-hidden="true"
                              />
                            ) : (
                              <RefreshCw
                                className="h-3 w-3 mr-1"
                                aria-hidden="true"
                              />
                            )}
                            Coba lagi
                          </Button>
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
