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
- [x] Keputusan sudah final (lihat PRD.md §11 #10 dan §9 M7): `deliveries.planned_delivery_date` di-prefill dari `MAX(estimated_delivery_date)` seluruh `production_batches` milik SO, editable, one-time saat create. `planned_ship_date` tetap manual.
- [x] Implementasi (2026-08-21): hook baru `useMaxEstimatedDeliveryDate(soId)` di `use-deliveries.ts` — query `production_batches` join `engineering_jobs` → `sales_order_items` filter `sales_order_id`, ambil `MAX(estimated_delivery_date)`. Dipakai di `create-delivery-dialog.tsx` via `useEffect` yang prefill `deliveryDate` sekali (state `deliveryDateTouched` berhenti prefill begitu user edit manual atau ganti SO — flag direset). `bunx tsc --noEmit` + `eslint` PASS pada kedua file yang diubah.

## Follow-up — Codex audit findings (2026-08-21)
- [x] **Supabase target mismatch**: `supabase/config.toml` punya `project_id = "uqsbdbchwvjzlftgepeg"` sejak initial commit, tidak pernah cocok dengan project target `jtzwawtfymljfqfrplib` yang dipakai konsisten di `.mcp.json`/docs/tracker. Diperbaiki: `project_id` diubah ke `jtzwawtfymljfqfrplib` (hanya file config lokal, tidak ada mutasi remote). Local stack di-restart (`supabase stop --project-id uqsbdbchwvjzlftgepeg` lalu `supabase start`) untuk verifikasi — migration re-apply bersih.
- [x] **pgTAP `sales_order_triggers.test.sql` gagal (expected 5, actual 6 notifikasi)**: root cause = fixture tidak terisolasi dari admin lain yang mungkin sudah ada di local DB (bukan bug trigger — trigger "notify all admins" sudah benar sesuai PRD). Fix: tambah `DELETE FROM user_roles WHERE role='admin' AND user_id NOT IN (a2, a3)` di awal test (di dalam transaksi yang di-ROLLBACK, jadi tidak mengubah data lokal permanen). `supabase test db` full suite sekarang **256/256 PASS**.
- [x] **`createUserManual()` tidak ada compensating cleanup**: jika insert `user_roles` gagal setelah Auth user dibuat, user Auth jadi orphan. Fix: `src/lib/admin-users.functions.ts` — kalau insert role gagal, panggil `supabaseAdmin.auth.admin.deleteUser()`; kalau cleanup itu sendiri gagal, error message eksplisit menyebut email+id user yang perlu dihapus manual.
- [x] **Klaim first-login password change tanpa enforcement**: dipilih **opsi B (copy correction)** sesuai instruksi (jangan menebak keputusan product/security). Copy di `create-user-dialog.tsx` diubah dari "User mengganti kata sandi ini sendiri setelah masuk pertama kali" menjadi eksplisit bahwa sistem **belum** memaksa penggantian kata sandi. **Follow-up butuh keputusan owner**: apakah mau diimplementasikan flow force-password-change beneran (perlu desain UX + kemungkinan kolom `must_change_password` dan gate di route guard).
- [x] **Delivery prefill dirty state**: saat ganti SO di `create-delivery-dialog.tsx`, `deliveryDate` lama tidak ikut dibersihkan (hanya flag `deliveryDateTouched` yang direset) — kalau SO baru belum punya `estimated_delivery_date`, tanggal SO sebelumnya nyangkut. Fix: `setDeliveryDate("")` ditambahkan ke `onValueChange` Select SO.
- [x] **Dependency audit**: `bun audit` awal 17 kerentanan (11 high/4 moderate/2 low). `jspdf`/`jspdf-autotable` **masih dipakai aktif** (export PDF riwayat blocker produksi, `src/features/production/components/blocker-history.tsx`) — tidak dihapus. Kerentanan jspdf sebenarnya dari `dompurify` transitive (`<=3.4.12`, moderate XSS) yang jadi `optionalDependency` jspdf dengan range `^3.3.1` (mengizinkan versi lebih baru) — ditambahkan `"overrides": {"dompurify": "^3.4.14"}` di `package.json`, `bun install` untuk regenerate lockfile. `bun audit` setelah fix: **16 kerentanan (11 high/3 moderate/2 low)**. Sisa 16 semuanya dari toolchain dev (`eslint`→`brace-expansion`/`js-yaml`, `vite`→`postcss`/`nanoid`/`esbuild`, `@babel/core`) — bukan kode yang di-ship ke browser produksi, butuh bump major eslint/vite/tanstack-start yang berisiko breaking; **tidak dilakukan** (di luar scope "jangan update massal tanpa analisis"), dicatat sebagai follow-up terpisah.
- [x] **Follow-up (query unbounded)** — SELESAI 2026-08-23. Keputusan owner: split query per view (bukan `.range()`/infinite-scroll — dianggap overkill untuk volume data saat ini, lihat catatan di bawah).
  - Delivery: `useDeliveries()` (`src/features/delivery/hooks/use-deliveries.ts`) sekarang default filter status "aktif" (draft/prepared/shipped, exclude delivered) + `.limit(200)` sebagai safety net; opsi "Semua status" tetap tersedia di dropdown `/delivery`. Gantt (`/delivery/schedule`) pakai hook baru `useDeliveriesForSchedule()` — dibatasi rentang tanggal (default 90 hari lalu s/d 180 hari depan, null-safe overlap filter server-side), input Dari/Sampai yang sudah ada sekarang jadi rentang fetch beneran (bukan cuma filter client-side pasca-fetch).
  - QC: `useQcInspections()` dipecah jadi `useQcActiveQueue()` (filter status server-side, tanpa limit — antrian selalu kecil karena item keluar begitu lulus) dan `useQcHistory({from, toExclusive})` (`src/features/qc/hooks/use-inspections.ts`) — default 90 hari terakhir + `.limit(300)`, ada input tanggal baru di tab Riwayat (`qc.tsx`) untuk memperlebar rentang.
  - **Bug ditemukan & diperbaiki saat verifikasi browser**: kedua hook QC awalnya pakai nama Realtime channel yang sama (`"qc-inspections-realtime"`), padahal sekarang keduanya mount bersamaan di `/qc` (tab Antrian + Riwayat) — Supabase melempar error "cannot add postgres_changes callbacks after subscribe()" karena channel kedua numpang ke channel pertama yang sudah subscribed. Fix: channel name dibuat unik per hook (`-active` / `-history`), diverifikasi ulang di browser — 0 console error.
  - `production_batches` (`use-batches.ts`): **dievaluasi, tidak ada perubahan** — volume batch terikat ~1:1 ke SO item (jauh lebih rendah growth-rate-nya dibanding QC inspections per-step atau delivery per-shipment), dan tidak ada gap urgensi seperti dua area di atas. Dibiarkan unbounded untuk saat ini; revisit kalau volume produksi terbukti jadi masalah nyata.
  - Verifikasi: `bunx tsc --noEmit`, `bun run lint`, `bun run build` PASS; `supabase test db` 256/256 PASS (tidak ada perubahan schema, murni query layer); manual browser test (`/delivery`, `/delivery/schedule`, `/qc` kedua tab, `/production`) — 0 console error, default filter tampil benar (status "Aktif" di delivery, tanggal 90-hari-lalu di kedua tempat).

---

## Follow-up — Rekomendasi hasil audit Codex 2026-08-21 (dijadikan task; A selesai, B/C belum dikerjakan)

### A. Implementasi first-login password enforcement (prioritas: keamanan) — SELESAI 2026-08-22
- [x] A.1 Flag `must_change_password` disimpan di **`app_metadata`** (bukan `user_metadata` seperti draft awal) — sengaja diganti karena `user_metadata` bisa ditulis langsung oleh client (`supabase.auth.updateUser`), yang akan membuat user bisa mematikan flag ini sendiri tanpa benar-benar ganti password. `app_metadata` hanya bisa ditulis lewat `supabaseAdmin` (service role).
- [x] A.2 `createUserManual()` (`src/lib/admin-users.functions.ts`) set `app_metadata: { must_change_password: true }` langsung di `supabaseAdmin.auth.admin.createUser()`
- [x] A.3 Route guard di `src/routes/_authenticated/route.tsx` `beforeLoad`: kalau `data.user.app_metadata?.must_change_password === true`, redirect ke `/change-password` sebelum render route manapun di `_authenticated/*`
- [x] A.4 Halaman baru `src/routes/change-password.tsx` (top-level, sejajar `/auth`, bukan di bawah `_authenticated` — supaya tidak kena guard yang sama): form password baru + konfirmasi (min 8 karakter) → server fn `changePasswordAndClearFlag`.
- [x] A.5 Manual test end-to-end di local stack (browser, Chrome DevTools MCP): buat user baru via dialog admin → login user baru → **auto-redirect ke `/change-password`** → coba akses `/dashboard` langsung via URL → **tetap dilempar balik ke `/change-password`** (guard bekerja) → submit password baru → berhasil masuk ke `/dashboard` → reload halaman → **tetap di `/dashboard`, tidak loop balik** (flag benar-benar ter-clear, bukan cuma state di memori). User test dihapus lagi setelah verifikasi.
- [x] Copy dialog `create-user-dialog.tsx` diupdate lagi (sebelumnya sempat diubah ke "belum ada enforcement" saat audit Codex, sekarang diupdate balik jadi jujur: "User akan dipaksa menggantinya sebelum bisa mengakses halaman lain setelah masuk pertama kali")
- [x] **Fix hasil background security review (2026-08-22, setelah implementasi awal)**: desain awal punya 2 server function terpisah — `clearMustChangePassword` (clear flag) dipanggil client SETELAH `supabase.auth.updateUser({password})` (client-side). Ini **authentication bypass**: siapa pun yang tahu temp password bisa panggil `clearMustChangePassword` langsung (mis. lewat devtools/fetch) tanpa pernah ganti password beneran, karena tidak ada bukti server-side bahwa password sudah berubah sebelum flag di-clear. Fix: digabung jadi satu server fn `changePasswordAndClearFlag` (`src/lib/roles.functions.ts`) yang set password (`supabaseAdmin.auth.admin.updateUserById`) DAN clear flag dalam satu handler yang sama — flag hanya bisa clear sebagai efek samping ganti password beneran, tidak bisa dipanggil terpisah (fungsi lama `clearMustChangePassword` sudah dihapus total, tidak ada referensi tersisa). Efek samping yang diketemukan saat re-test: ganti password lewat admin API menginvalidasi sesi browser yang sedang aktif (access token lama jadi stale) — `change-password.tsx` diupdate untuk `supabase.auth.signOut()` lalu redirect ke `/auth` dengan toast "silakan masuk lagi", bukan berpura-pura lanjut ke `/dashboard` dengan sesi yang sudah tidak valid. Re-verifikasi end-to-end di browser: redirect enforcement tetap jalan, ganti password berhasil, sesi lama ter-invalidate (lempar ke `/auth`), login ulang dengan password baru berhasil masuk `/dashboard` dan flag benar-benar clear (reload tidak loop). Root cause murni desain (bukan typo/oversight kecil) — dicatat di sini karena pelajarannya: server fn yang mengubah state keamanan (auth flag) tidak boleh bisa dipanggil independen dari aksi yang seharusnya men-triggernya.
- [x] **Checkpoint A**: `bunx tsc --noEmit`, `bun run lint`, `bun run test` (5/5), `bun run build`, `supabase db lint --local --level warning --fail-on none` (0 error), `supabase test db` (**256/256 PASS**, tidak ada test baru diperlukan — ini murni App/Auth flow, bukan trigger DB) — semua PASS, termasuk setelah fix security review. Manual browser test PASS dua kali (sebelum & sesudah fix, lihat A.5 dan baris di atas).

### B. Pagination/filter list transaksional (prioritas: performa, delivery+QC dulu) — SELESAI 2026-08-23
- [x] B.1 `/delivery` list: filter default ke status aktif (bukan seluruh histori) + `.range()`/"muat lebih banyak"; `/delivery/schedule` (Gantt) tetap full-fetch tapi default filter rentang tanggal (mis. 90 hari terakhir) — **diimplementasikan dengan teknik lebih sederhana**: default filter status "aktif" server-side + `.limit(200)` hard-cap (bukan `.range()`/infinite-scroll — keputusan owner: dianggap cukup untuk volume data saat ini, lihat detail lengkap di follow-up baris ~99-106 di atas)
- [x] B.2 QC (`/qc`): dipecah jadi `useQcActiveQueue()` (bounded via status) + `useQcHistory()` (rentang tanggal default 90 hari + `.limit(300)`, bukan `.range()` — sama seperti B.1)
- [x] B.3 `production_batches` list (`use-batches.ts`): dievaluasi — tidak difilter, tapi diputuskan **tidak perlu diubah** karena volume batch ~1:1 dengan SO item (growth rate jauh lebih rendah dari QC inspections/deliveries), tidak ada urgensi
- [x] B.4 Verifikasi tidak ada regresi: manual browser test `/delivery`, `/delivery/schedule`, `/qc` (kedua tab), `/production` — 0 console error; `supabase test db` 256/256 PASS; bug Realtime channel-name collision (QC active+history mount bersamaan pakai nama channel sama) ditemukan & diperbaiki saat verifikasi ini
- [x] **Checkpoint B**: `bunx tsc --noEmit`, `bun run lint`, `bun run build` PASS; manual test list+Gantt+riwayat tidak regresi — semua PASS

### C. Update dependency toolchain dev (prioritas: rendah, jadwal rutin) — SELESAI 2026-08-23
- [x] C.1 Dikerjakan sebagai sesi maintenance terpisah (bukan reaktif), sesuai jadwal yang diminta owner di sesi ini.
- [x] C.2 `bun update --latest` di-scope hanya ke package eslint/vite/tanstack-start (bukan `bun update --latest` project-wide — radix-ui dkk di luar cakupan "toolchain dev", butuh regresi visual terpisah kalau mau diupdate). Versi baru: `eslint` 9.32→10.9, `vite` 8.0.16→8.2.2, `@vitejs/plugin-react` 5.2→6.1, `typescript-eslint` 8.56→8.67, `@tanstack/react-start` 1.168.26→1.168.48, `@tanstack/router-plugin` 1.168.18→1.168.34, `@tanstack/react-router` 1.170.16→1.170.31, `@tanstack/react-query` 5.101.1→5.101.4.
  - **Ditemukan saat regression**: `eslint-plugin-react-hooks` 5→7 (ikut ter-update) membawa rule baru `set-state-in-effect` yang menghasilkan 10 error baru di kode existing (operators.tsx, engineering job detail) yang tidak disentuh sesi ini. Diputuskan **pin balik** `eslint-plugin-react-hooks` ke `^5.2.0` — memperbaiki 10 error itu bersamaan adalah scope creep untuk maintenance rutin; kalau mau diadopsi, jadikan task terpisah yang sengaja menaikkan rule ini dan memperbaiki temuannya.
  - Full regression setelah update: `tsc`, `lint` (0 error, 37 warning pra-existing "fast refresh" tak berubah), `test` (5/5), `build`, `supabase test db` (256/256) — semua PASS. Manual browser smoke test (login, `/qc`, `/delivery/schedule`) — 0 console error.
- [x] C.3 `bun audit` setelah update toolchain: 16→8 kerentanan (postcss/nanoid/esbuild dari chain `vite` beres lewat bump versi). Sisa 8 (brace-expansion, js-yaml, @babel/core — semua transitive, deep di chain eslint/typescript-eslint/tanstack-start) ternyata punya patch non-major yang tersedia (bukan perlu major bump berisiko) — ditambahkan ke `overrides` di `package.json` (pola sama seperti `dompurify` yang sudah ada): `js-yaml@^4.3.1`, `@babel/core@^7.29.7`, `brace-expansion@^5.0.9`. Hasil akhir: **`bun audit` 0 kerentanan**. Regression diulang lagi setelah override — semua tetap PASS.
  - **Perlu diketahui owner (bukan blocker, sekadar surfaced)**: dev server sempat menampilkan 2 warning baru dari versi `@tanstack/react-start` yang baru — keduanya **sudah diperbaiki**, lihat Section D dan E di bawah.
- [x] **Checkpoint C**: tidak ada breaking change; `tsc`/`lint`/`test`/`build`/`supabase test db` PASS; `bun audit` 0 kerentanan (turun dari 16).

### D. CSRF middleware untuk server functions — SELESAI 2026-08-23
- [x] D.1 Tambah `createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === "serverFn" })` di `src/start.ts`, didaftarkan di `requestMiddleware` (bareng `errorMiddleware` yang sudah ada). Filter ke `serverFn` saja supaya request non-serverFn (page load/SSR) tidak ikut kena cek — sesuai contoh yang disarankan warning-nya sendiri. Middleware ini memvalidasi `Sec-Fetch-Site`/`Origin`/`Referer` terhadap same-origin (default `secFetchSite: "same-origin"`), tanpa perlu token CSRF terpisah — cocok untuk arsitektur ini (server function = same-origin RPC, bukan API publik lintas domain).
- [x] D.2 Verifikasi: `bunx tsc --noEmit`, `bun run lint`, `bun run build` PASS. Dev server: warning CSRF hilang (dikonfirmasi dari log, hanya sisa warning `inputValidator` deprecated yang tak terkait).
- [x] D.3 Manual browser test — server fn read (dashboard stats, list user admin) tetap 200 OK; server fn **write** (`assignRole` via toggle checkbox role di `/admin`) tetap 200 OK dan berhasil tersimpan (diverifikasi lewat REST API langsung ke `user_roles`) — membuktikan middleware tidak memblokir request same-origin yang sah. `supabase test db` 256/256 PASS setelahnya (tidak ada perubahan schema).
- [x] **Checkpoint D**: CSRF warning hilang; tidak ada regresi fungsional pada server function read/write; semua verifikasi wajib PASS.

### E. Migrasi `createServerFn().inputValidator()` → `.validator()` — SELESAI 2026-08-23
- [x] E.1 Rename 1:1 (bukan perubahan behavior — `inputValidator` cuma alias `@deprecated` dari `validator`, signature `ValidatorFn` identik) di 4 file yang memakainya: `src/lib/roles.functions.ts`, `src/lib/assignments.functions.ts`, `src/lib/engineering-users.functions.ts`, `src/lib/admin-users.functions.ts` (3 lokasi: `createUserManual`, `assignRole`, `unassignRole`).
- [x] E.2 Verifikasi: `bunx tsc --noEmit`, `bun run lint` (0 error setelah `eslint --fix` merapikan format), `bun run build`, `supabase test db` 256/256 — semua PASS.
- [x] E.3 Manual browser test: dev server tidak lagi menampilkan warning deprecation; server fn write (`assignRole`/`unassignRole` via toggle role di `/admin`, dua kali toggle) tetap 200 OK dan tersimpan benar (diverifikasi lewat REST API ke `user_roles` — kembali ke state semula, tidak ada role nyangkut).
- [x] **Checkpoint E**: warning deprecation hilang; tidak ada regresi; semua verifikasi wajib PASS.

---

## Follow-up — Full smoke test Codex (2 ronde) + fixes (2026-08-30)

Konteks: owner minta full smoke test end-to-end semua modul/flow via Codex (bukan review kode). Dijalankan 2 ronde di local Supabase stack. Prompt & report: `tasks/codex-full-smoke-test-{prompt,report}.md` (ronde 1), `tasks/codex-full-smoke-retest-{prompt,report}.md` (ronde 2), artefak browser: `tasks/codex-full-smoke-{screenshots,retest-artifacts}/`.

### Ronde 1 (2026-08-30, verdict FAIL — coverage belum lengkap + 1 bug)
- [x] Quality gate PASS: `supabase test db` 256/256, `tsc`, `lint`, `build`.
- [x] PASS: Auth/RBAC guard, Sales Order CRUD + trigger `confirmed`→job+material+notifikasi, Customer CRUD, Admin/audit log, Notifikasi mark-as-read, Dashboard (3 view angka cocok cross-check query manual).
- [x] Temuan:
  - **BUG-1 (major)** — `/dashboard`: request statistik yang menggantung tidak pernah settle, kartu "Sales Order per Status" stuck `"Memuat…"` >15 dtk tanpa error notice.
  - **BUG-2 (minor)** — forced password-change first login meninggalkan `403` di `auth/v1/logout?scope=global` + console error merah.
  - **BUG-3 (minor)** — client chunk `index-*.js` ~519 kB, warning chunk >500 kB, belum ada code-splitting.
  - PASS_PARTIAL (hanya route render + pgTAP, UI flow tidak dituntaskan manual): Engineering, Material, Production Planning/Operator, Production Kanban, QC, Delivery.

### BUG-1 fix — dashboard error state (commit `2d86698`, 2026-08-30)
- [x] Root cause: query view dashboard tidak punya timeout; request menggantung tidak reject → React Query tetap `isLoading` selamanya → error UI yang sudah ada tidak pernah kepicu.
- [x] `src/features/dashboard/hooks/use-dashboard-stats.ts`: helper `withTimeout()` — gabung `AbortSignal` React Query + timeout 10 dtk, diteruskan ke `.abortSignal()` supabase pada 3 query (`v_dashboard_so_status`, `v_dashboard_material_waiting`, `v_dashboard_production_running`); `retry: 1` supaya kegagalan cepat sampai ke error UI.
- [x] `src/routes/_authenticated/dashboard.tsx`: tombol **"Coba lagi"** di alert error dashboard (refetch 3 query, disabled saat `isFetching`).
- [x] Verifikasi: `tsc`/`lint`/`test` (44/44)/`build` PASS.

### Ronde 2 retest (2026-08-30, verdict FAIL tapi naik dari ronde 1)
- [x] **BUG-1 CLOSED** (terverifikasi browser): request `v_dashboard_so_status` diblok → error state muncul dalam **22,17 dtk** (bukan spinner selamanya) + alert merah + tombol "Coba lagi"; unblock + retry → data pulih tanpa reload. Bukti: `tasks/codex-full-smoke-retest-artifacts/bug1-dashboard-*.png` + `bug1-dashboard-result.json`.
- [x] Naik jadi PASS penuh: Engineering (gate + progress lock 100 + history), Material (waiting→ready), Operator CRUD, QC core (validasi qty, flow reject, **Trigger Rework hanya di status reject via RPC `trigger_rework`**), Delivery detail transition (draft→prepared→shipped→delivered, SO auto-completed).
- [x] Cross-cutting PASS: dark mode 5 halaman (no white flash), mobile 375px (no overflow), empty-state SO/Production/QC/Delivery, a11y dialog Create User/QC Inspection/Delivery Create (first focus + Esc close).
- [x] Temuan baru / masih terbuka:
  - **BUG-4** — Codex label "major LEAK", **dinilai ulang minor**: viewer buka `/sales-orders/new` tidak redirect, tapi form body dirender pesan "tidak punya akses" + RLS backstop. Bukan security leak, cuma harusnya redirect.
  - **BUG-5 (major, valid)** — list `/sales-orders`, `/material`, `/qc` tidak menampilkan error notice saat request gagal (jadi "0 data" senyap, console `net::ERR_FAILED`). Pola `withTimeout` dashboard belum diterapkan ke list lain.
  - **BUG-6/7/8** — drag-and-drop Production, create batch UI, create delivery UI "tidak terbukti" — **dinilai limitasi automation Codex, bukan bug app** (`dragAttempt: "not_attempted"`; realtime 2-tab justru PASS `realtimeMs: 1`; delivery detail transition PASS). Perlu retest manual singkat.

### Fixes BUG-5 + BUG-4 + BUG-2 + BUG-3 (commit `07d0572`, 2026-08-30)
- [x] **BUG-5**: helper `withTimeout` dashboard dipromosikan jadi `src/lib/query-timeout.ts` (`withQueryTimeout`, timeout 10 dtk). Diterapkan + `retry: 1` ke `useSalesOrders` (+ sub-query customers), `useMaterialStatuses`, `useQcActiveQueue`, `useQcHistory`. Route `/material` & `/qc` (queue + history) sekarang render `<ErrorNotice>` (komponen shared existing, sudah ada retry + a11y live region) saat `isError` — sebelumnya tidak ada error UI sama sekali. `/sales-orders` inline `<Alert>` diganti `<ErrorNotice>` + retry.
- [x] **BUG-4**: `beforeLoad` guard di `src/routes/_authenticated/sales-orders.new.tsx` + `sales-orders.$id.edit.tsx` — non-admin/sales redirect ke `/sales-orders` (pola sama `admin.tsx` `ensureQueryData(myRolesQueryOptions)`). Blok "tidak punya akses" in-component yang redundan dihapus.
- [x] **BUG-2**: `src/routes/change-password.tsx` — `signOut({ scope: "local" })`. Session sudah mati setelah password diganti server-side (admin API), jadi logout global cuma memanggil endpoint dengan token mati → 403.
- [x] **BUG-3**: `vite.config.ts` — `build.rollupOptions.output.manualChunks` via passthrough `vite` option: pisah vendor berat (react, tanstack, radix, dnd-kit, supabase, react-hook-form/zod). Main chunk **519 kB → 245 kB**, warning ">500 kB" hilang. jspdf/html2canvas sudah lazy dari sebelumnya (tidak diubah).
- [x] Verifikasi: `bunx tsc --noEmit`, `bun run lint` (0 error, 37 warning pra-existing), `bun run test` (44/44), `bun run build` (no >500 kB warning) — semua PASS. Dev server boot + `/auth` + `/sales-orders/new` (redirect ke auth saat unauth) — 0 console/server error. Error-state di halaman ter-autentikasi belum diverifikasi browser (butuh login) — pakai mekanisme + komponen persis sama dengan BUG-1 yang sudah terbukti.
- [ ] **Belum dikerjakan / butuh keputusan owner** (dari kesimpulan retest ronde 2):
  - Retest manual BUG-6/7/8 (drag-drop Production, create batch UI, create delivery UI) — kemungkinan besar limitasi automation, tapi perlu mata manusia.
  - Apakah `<ErrorNotice>` pola sama perlu diterapkan ke SEMUA list board lain (engineering, production, delivery, operators) — konsistensi.
  - BUG-3 lanjutan: `production_batches` list masih unbounded (sudah dievaluasi di Follow-up B, diputuskan OK); code-split jspdf/gantt kalau cold-load terasa berat.

### Ronde 3 retest (2026-08-30, verdict FAIL — report `tasks/codex-full-smoke-retest3-report.md`, commit `e560bf8`)
- Naik lagi dari ronde 2: BUG-1/3/4/5/7 CLOSED. Masih open: BUG-2 (logout 403 belum benar-benar hilang), BUG-8 (role delivery tak bisa tambah item), BUG-6 (DnD belum terbukti).

### Fixes BUG-2 + BUG-8 (commit `1f720c4`, 2026-08-30)
- [x] **BUG-8** (major): eligibility query di `src/features/delivery/hooks/use-deliveries.ts` (`useEligibleQcInspections`) inner-join `qc_inspections → production_batch_steps → production_batches → engineering_jobs → sales_order_items`. Role `delivery` punya SELECT di semua tabel itu **kecuali `engineering_jobs`** → query balik 0 row, draft delivery tak pernah bisa dapat item, transisi `draft → prepared` ditolak. Fix: migration `supabase/migrations/20260830000001_m8_eng_jobs_select_delivery.sql` tambah `delivery` ke policy `eng_jobs_select_scoped`. Test RLS-matrix `supabase/tests/engineering.test.sql` di-flip: "delivery denied" → "delivery can SELECT".
- [x] **BUG-2** (major, ronde 2 fix ternyata belum tuntas): `signOut({ scope: "local" })` **tetap** POST `/auth/v1/logout?scope=local` dengan token yang sudah di-revoke server-side saat ganti password → 403 di console (auth-js menelan error-nya, tapi browser tetap log resource 403). Fix: `src/routes/change-password.tsx` — hapus persisted session langsung dari `localStorage` (key `sb-*-auth-token`), lalu `window.location.assign("/auth")` (hard reload, client re-init tanpa session). Import `useNavigate` yang jadi orphan dibersihkan.
- [x] Verifikasi: `bunx tsc --noEmit`, `bun run lint` (0 error, 37 warning pra-existing), `supabase db reset` (M8 applied), `supabase test db` (256/256 PASS), `bun run build` (client chunk terbesar < 500 kB) — semua PASS.
- [ ] **Masih open setelah ronde 3**:
  - BUG-6 (DnD Production) — pointer-drag automation tak memindahkan kartu; fallback button + gate QC + operator dialog semua terbukti jalan. Kemungkinan artefak automation; perlu retest manual atau keputusan owner apakah DnD wajib untuk demo.
  - BUG-9R3 (ResizeObserver loop noise) — quirk dev-overlay benign, minor.
  - RBAC sidebar matrix masih longgar vs tabel prompt untuk beberapa role — butuh keputusan owner apakah tabel = strict source-of-truth.
