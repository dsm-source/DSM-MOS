# DSM MOS — Task Checklist

> Detail lengkap tiap task (acceptance criteria, files, dependencies) ada di `tasks/plan.md`. File ini untuk tracking cepat harian. Centang seiring progres; jangan mulai milestone berikutnya sebelum checkpoint milestone saat ini lolos.

## Phase 0 — Blocker & Audit
- [x] 0.1 Verifikasi koneksi MCP Supabase ke project `jtzwawtfymljfqfrplib` (user run `claude /mcp` + auth)
- [x] 0.2 Audit menyeluruh 24 migration lokal vs PRD v3 (RLS, trigger, number generator — bukan cuma tabel)
- [x] **Checkpoint 0**: `list_tables` sukses ke project benar; tidak ada gap baru ditemukan

## M0 — Foundation
- [x] M0.1 Deploy migration yang sudah benar (local stack: 24 migration lama + 1 baru = 25, `supabase start` sukses)
- [x] M0.2 Migration: tabel `operators` + RLS (file: `20260726000000_m0_foundation.sql`, local deploy sukses)
- [x] M0.3 UI admin: buat user manual + assign role (`src/routes/_authenticated/admin.tsx` sudah ada — list user + checkbox assign role, terverifikasi di local Supabase stack)
- [x] M0.4 Verifikasi/bangun route guard per role (layout auth guard + sidebar role filter + RLS backstop; fix: engineering.workload guard dibuka ke semua peran sesuai PRD §11 #6)
- [x] **Checkpoint M0**: admin buat user → user login → lihat menu sesuai role; build+test lulus (get_advisors: MCP tidak tersedia di sesi ini, verifikasi via local stack)

## M1 — Sales Order + Notifikasi
- [x] M1.1 Verifikasi migration & RLS SO/assignments/history/notifications
- [x] M1.2 UI list SO (pagination, filter, search)
- [x] M1.3 UI detail SO + assignment PIC per role + riwayat status
- [x] M1.4 UI form create/edit SO + item dinamis (sales+admin) — route guard
- [x] M1.5 Master data customer CRUD
- [x] M1.6 Bell notifikasi realtime + mark-as-read
- [x] M1.7 pgTAP: SO confirmed→job+material auto; status change→history+notification (23/23 pass)
- [x] **Checkpoint M1**: SO confirmed → job+material otomatis (trigger terverifikasi), notifikasi masuk (Realtime aktif), pgTAP 23/23 pass, build+lint lulus

## M2 — Engineering
- [x] M2.1 Migration: hapus `drawing_url`
- [x] M2.2 Buat/verifikasi `v_engineering_workload` (akses semua peran)
- [x] M2.3 UI papan Engineering Job per status
- [x] M2.4 UI detail job (tanpa upload drawing)
- [x] M2.5 Tab riwayat dari `engineering_job_history`
- [x] M2.6 Halaman Engineering Workload (semua peran)
- [x] M2.7 pgTAP: gate in_progress, progress lock 100, workload RLS (23/23 pass)
- [x] **Checkpoint M2**: full flow assign→approve, riwayat muncul; pgTAP 46/46 pass (M1+M2), build lulus


## M3 — Material Status
- [x] M3.1 Verifikasi migration & RLS
- [x] M3.2 UI papan status Material
- [x] M3.3 Detail + tab riwayat
- [x] M3.4 pgTAP: 1:1 job, no duplikat, history tercatat
- [x] **Checkpoint M3**: full flow waiting→ready, riwayat tercatat; pgTAP lulus (verifikasi local stack)

## M4 — Production Planning
- [x] M4.1 Migration: tambah `production_batches.routing jsonb` (file: `20260816000006_production_routing_operator_fk.sql`)
- [x] M4.2 Migration: `operator_id` FK → `operators`; revisi trigger steps ikuti routing (juga menghapus auto-set `operator_id := auth.uid()` di trigger validasi transisi, karena tidak valid lagi terhadap FK baru — operator kini harus dipilih eksplisit, sesuai M5.4)
- [x] M4.3 UI master data Operators CRUD
- [x] M4.4 UI form buat batch + routing checkbox
- [x] M4.5 Gantt Production (tombol, bukan drag)
- [x] M4.6 pgTAP: RLS insert batch/operators; routing→steps benar; Gantt isolated dari deliveries
- [x] **Checkpoint M4**: batch dengan routing custom → steps yang dibuat sesuai; pgTAP lulus (verifikasi local stack)

## M5 — Production Execution
- [x] M5.1 Migration: tambah `rework` ke `production_step_status` (file: `20260816000007_m5_add_rework_enum.sql`)
- [x] M5.2 Migration: trigger gate (§7 rule #1) dengan pesan error spesifik (file: `20260816000008_m5_validate_transition_rework.sql`)
- [x] M5.3 UI satu Kanban Per-Batch, drag-and-drop (`@dnd-kit/core`); hapus `station-step-card.tsx` + tab "Per Stasiun"
- [x] M5.4 Form pilih `operator_id` saat pindah kartu (`StepOperatorDialog`)
- [x] M5.5 Realtime Kanban (channel `operators-realtime` di `useProductionBatches`)
- [x] M5.6 pgTAP + manual: percobaan lewati gate via SQL/RPC ditolak (file: `production_execution.test.sql`, 43 assertions)
- [x] **Checkpoint M5**: batch jalan step-by-step sesuai gate; bypass gate ditolak; `get_advisors` bersih

## M6 — Quality Control
- [x] M6.1 Migration: `qc_inspections` relasi ke step, hapus foto, tambah `rework_triggered_at` (file: `20260817000003_m6_qc_step_level.sql`)
- [x] M6.2 Migration: RPC `trigger_rework` (security definer, role qc/admin) + gate GUC di trigger transisi step (file: `20260817000004_m6_trigger_rework_rpc.sql`)
- [x] M6.3 UI mobile-responsive antrian + form (tanpa foto) (`src/features/qc/*`, `src/routes/_authenticated/qc.tsx`, `tsc/lint/build` hijau)
- [x] M6.4 Tombol "Trigger Rework" (RPC `trigger_rework` via `useTriggerRework()`, no direct rework mutation)
- [x] M6.5 Timeline riwayat multi-cycle (per `production_batch_step_id`, bukan per-batch)
- [x] M6.6 Offline queue (localStorage) + indikator + auto-sync (`src/features/qc/lib/offline-queue.ts`, `src/features/qc/hooks/use-offline-qc-queue.ts`, integrasi di `inspection-dialog.tsx` + `qc.tsx`; tsc/lint/build hijau)
- [x] M6.7 pgTAP: gate completed-only, RLS insert/RPC (file: `supabase/tests/qc_rework.test.sql`, suite pass 215/215)
- [x] M6.8 Manual test offline→online sync — **dieksekusi & PASS** (2026-08-20) di browser real (`/qc`, item `ENG-2026-000046-B1`). `navigator.onLine` disimulasikan via `Object.defineProperty` + dispatch event `offline`/`online` (setara DevTools Network throttling). Hasil: (1) simpan draft offline → toast "Tersimpan lokal, menunggu sinkronisasi" ✅; (2) transisi `waiting→inspection` offline → toast queued lagi, dialog tetap terbuka ✅; (3) indikator "2 data tersimpan lokal, menunggu sinkronisasi" ✅; (4) online → auto-sync via event `online`, toast "2 data lokal berhasil disinkronkan", indikator hilang, badge kartu update ke "Inspeksi" ✅; (5) hard reload → status & qty (OK:8, Tolak:2) tetap tersimpan di server (bukan cuma client state) ✅; (6) opsional reject→rework offline/online: Tolak (online) → offline, klik Trigger Rework → toast queued, dialog tertutup ✅ → online → toast "1 data lokal berhasil disinkronkan", badge "Rework" ✅, diverifikasi server-side: `qc_inspections.status='rework'` + `rework_triggered_at` terisi, `production_batch_steps` step 1 ikut `rework` ✅. Detail lengkap di `tasks/route-outlet-audit.md`.
- [x] **Checkpoint M6**: pass/reject/rework cycle penuh ✅ (lihat M6.8); `get_advisors` dijalankan (2026-08-20) terhadap project remote `jtzwawtfymljfqfrplib` — security: 1 WARN `auth_leaked_password_protection` (toggle Auth dashboard, bukan gap RLS/schema; owner keputusan: accepted risk, non-blocking), performance: 0 temuan. Detail di `tasks/route-outlet-audit.md`.

### Bugfix — anti-pattern parent route tanpa `<Outlet />` (2026-08-20)
- [x] `/sales-orders/new` — diverifikasi end-to-end di browser (klik link, hard reload, submit → redirect ke detail). Fix sebelumnya (`sales-orders.tsx` jadi layout + `sales-orders.index.tsx`) terbukti benar.
- [x] `/sales-orders/$id/edit` — bug sama ditemukan & diperbaiki: `sales-orders.$id.tsx` (parent route untuk child `/edit`) tidak render `<Outlet />`. Fix: rename ke `sales-orders.$id.index.tsx` (route path `/sales-orders/$id/`), TanStack Router plugin auto-regenerate `routeTree.gen.ts` dan auto-fix path string di file. Diverifikasi browser: title+DOM edit page benar, submit tetap jalan, detail page tidak regresi. `tsc`/`lint`/`build` PASS.
- [x] `/delivery/schedule`, `/delivery/$id`, `/engineering/workload`, `/engineering/$id` — **difix** (2026-08-20, sesi lanjutan): pola sama seperti `sales-orders` — `delivery.tsx`/`engineering.tsx` di-rename ke `delivery.index.tsx`/`engineering.index.tsx` (auto-fix route path oleh plugin), file `delivery.tsx`/`engineering.tsx` baru dibuat sebagai layout `<Outlet/>`. Diverifikasi browser hard-reload untuk keempat route (termasuk `/delivery/$id` pakai 1 delivery row test yang langsung dihapus lagi setelah verifikasi) — semua render benar sekarang, tidak ada regresi di `/delivery` dan `/engineering` list/board. `tsc`/`lint`/`build` PASS. Detail di `tasks/route-outlet-audit.md`.

## M7 — Delivery
- [x] M7.1 Verifikasi migration deliveries/delivery_items (2026-08-20: schema dasar di `20260722065755_dfe9973d-dda0-4834-b0d0-e40b3709806c.sql` sesuai PRD §6.2/§8; gate step-level M6 ter-cover oleh rewrite `delivery_items_validate()` di `20260817000003_m6_qc_step_level.sql` baris 215+)
- [x] M7.2 UI list + form rencana (2026-08-20: terverifikasi ada di `src/routes/_authenticated/delivery.index.tsx` + `src/features/delivery/components/create-delivery-dialog.tsx`; flow create/detail memakai hook `useDeliveries`/`useCreateDelivery`; `bunx tsc --noEmit`, `bun run lint`, `bun run build` PASS)
- [x] M7.3 Gantt Delivery (2026-08-20: terverifikasi ada di `src/routes/_authenticated/delivery.schedule.tsx` + `src/features/delivery/components/delivery-gantt.tsx`; pakai `gantt-task-react`, toggle Weekly/Monthly, warna status, overdue merah; `bunx tsc --noEmit`, `bun run lint`, `bun run build` PASS)
- [x] M7.4 pgTAP: no cetak/export; gate draft; gate qc pass (2026-08-20: tambah `supabase/tests/delivery.test.sql` 9 assertion PASS via `supabase test db supabase/tests/delivery.test.sql`; juga tambah migration `20260820000001_m7_fix_delivery_defaults_security.sql` untuk fix blocker nyata `permission denied for function generate_do_number` saat INSERT delivery. Verifikasi tambahan: `bunx tsc --noEmit`, `bun run lint`, `bun run build` PASS)
- [x] **Checkpoint M7**: batch→delivery→delivered→SO completed; `get_advisors` ditinjau (2026-08-20: full-flow DB PASS via `supabase/tests/m7_full_flow.test.sql` 13/13 + `supabase/tests/delivery.test.sql` 19/19; Codex final PASS untuk sisi kode/DB, lihat `tasks/m7-checkpoint-codex-review-summary.md`. Advisory tersisa `auth_leaked_password_protection` adalah batas fitur Supabase Free plan, bukan bug app — accepted risk / platform limitation)

## M8 — Audit Log & Dashboard
- [x] M8.1 Verifikasi audit_logs + dashboard views (2026-08-20: `audit_logs` tervalidasi ada, RLS enabled, policy SELECT admin-only, tanpa policy INSERT/UPDATE/DELETE; `v_dashboard_so_status`, `v_dashboard_material_waiting`, `v_dashboard_production_running` ada dan dipakai frontend via `use-dashboard-stats.ts`; `bunx tsc --noEmit`, `bun run lint`, `bun run build` PASS; Codex verdict PASS, lihat `tasks/m8-1-codex-review-summary.md`)
- [x] M8.2 UI dashboard dari views (2026-08-20: dashboard memakai `use-dashboard-stats.ts` yang query langsung ke `v_dashboard_so_status`, `v_dashboard_material_waiting`, `v_dashboard_production_running`; UI menampilkan stat card Sales Order Aktif, Job Menunggu Material, Produksi Berjalan, dan grid distribusi SO per status. `bunx tsc --noEmit`, `bun run lint`, `bun run build` PASS. Codex verdict `pass_with_minor`; follow-up minor: error state query dashboard belum eksplisit, lihat `tasks/m8-2-codex-review-summary.md`. UPDATE 2026-08-21: follow-up sudah selesai — error state query dashboard dibuat eksplisit dan fallback yang misleading sudah dibereskan di `dashboard.tsx`; lolos review Codex final)
- [x] M8.3 Halaman admin lihat audit_logs (2026-08-20: route admin existing `/_authenticated/admin` diperluas untuk menampilkan 100 audit log terbaru dari `audit_logs` via server function admin-only `listAuditLogs`; urut `changed_at desc`, kolom inti tampil, fallback `changed_by` null -> `sistem`, empty state `Belum ada log.` `bunx tsc --noEmit`, `bun run lint`, `bun run build` PASS. Codex verdict `pass_with_minor`; follow-up minor: error state query audit log belum eksplisit, lihat `tasks/m8-3-codex-review-summary.md`. UPDATE 2026-08-21: follow-up sudah selesai — error state query audit log dibuat eksplisit di `admin.tsx`; lolos review Codex final)
- [x] M8.4 pgTAP: no INSERT policy audit_logs (2026-08-21: tambah `supabase/tests/audit_logs.test.sql` untuk membuktikan `audit_logs` tidak punya policy INSERT/UPDATE/DELETE, hanya 1 policy SELECT admin-only, direct INSERT oleh authenticated/admin ditolak, admin bisa SELECT, non-admin tersaring RLS. `supabase db reset`, `supabase test db supabase/tests/audit_logs.test.sql`, `bunx tsc --noEmit`, `bun run lint`, `bun run build` PASS. Codex verdict `pass`, lihat `tasks/m8-4-codex-review-summary.md`)
- [x] **Checkpoint M8 (FINAL)**: semua DoD M8 terverifikasi; RLS Matrix §8 untuk scope M8 tervalidasi lewat `supabase/tests/audit_logs.test.sql`; admin UI untuk create user + assign role + audit log sudah ada; `get_advisors` performance bersih, security masih 1 WARN `auth_leaked_password_protection` yang diputuskan owner sebagai accepted risk / platform limitation seperti M6-M7 (2026-08-21). Detail di `tasks/m8-checkpoint-summary.md`.

---

## Follow-up M7 — Prefill `planned_delivery_date` (PRD §11 poin #10, resolved 2026-08-21)
- [ ] Keputusan sudah final (lihat PRD.md §11 #10 dan §9 M7): `deliveries.planned_delivery_date` di-prefill dari `MAX(estimated_delivery_date)` seluruh `production_batches` milik SO, editable, one-time saat create. `planned_ship_date` tetap manual.
- [ ] Cek `create-delivery-dialog.tsx` / `useCreateDelivery` — fitur ini dibangun sebelum keputusan ini dikonfirmasi (checkpoint M7 FINAL: 2026-08-20), kemungkinan belum ada logic prefill. Implementasikan + pgTAP/manual test kalau belum ada.
