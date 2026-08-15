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
- [ ] M3.1 Verifikasi migration & RLS
- [ ] M3.2 UI papan status Material
- [ ] M3.3 Detail + tab riwayat
- [ ] M3.4 pgTAP: 1:1 job, no duplikat, history tercatat
- [ ] **Checkpoint M3**: full flow waiting→ready, riwayat tercatat; `get_advisors` bersih

## M4 — Production Planning
- [x] M4.1 Migration: tambah `production_batches.routing jsonb` (file: `20260816000006_production_routing_operator_fk.sql`)
- [x] M4.2 Migration: `operator_id` FK → `operators`; revisi trigger steps ikuti routing (juga menghapus auto-set `operator_id := auth.uid()` di trigger validasi transisi, karena tidak valid lagi terhadap FK baru — operator kini harus dipilih eksplisit, sesuai M5.4)
- [ ] M4.3 UI master data Operators CRUD
- [ ] M4.4 UI form buat batch + routing checkbox
- [ ] M4.5 Gantt Production (tombol, bukan drag)
- [ ] M4.6 pgTAP: RLS insert batch/operators; routing→steps benar; Gantt isolated dari deliveries
- [ ] **Checkpoint M4**: batch dengan routing custom → steps yang dibuat sesuai; `get_advisors` bersih

## M5 — Production Execution
- [ ] M5.1 Migration: tambah `rework` ke `production_step_status`
- [ ] M5.2 Migration: trigger gate (§7 rule #1) dengan pesan error spesifik
- [ ] M5.3 UI satu Kanban Per-Batch, drag-and-drop
- [ ] M5.4 Form pilih `operator_id` saat pindah kartu
- [ ] M5.5 Realtime Kanban
- [ ] M5.6 pgTAP + manual: percobaan lewati gate via SQL/RPC ditolak
- [ ] **Checkpoint M5**: batch jalan step-by-step sesuai gate; bypass gate ditolak; `get_advisors` bersih

## M6 — Quality Control
- [ ] M6.1 Migration: `qc_inspections` relasi ke step, hapus foto, tambah `rework_triggered_at`
- [ ] M6.2 Migration: RPC `trigger_rework` (security definer, role qc/admin)
- [ ] M6.3 UI mobile-responsive antrian + form (tanpa foto)
- [ ] M6.4 Tombol "Trigger Rework"
- [ ] M6.5 Timeline riwayat multi-cycle
- [ ] M6.6 Offline queue (localStorage) + indikator + auto-sync
- [ ] M6.7 pgTAP: gate completed-only, RLS insert/RPC
- [ ] M6.8 Manual test offline→online sync
- [ ] **Checkpoint M6**: pass/reject/rework cycle penuh; offline submit terverifikasi; `get_advisors` bersih

## M7 — Delivery
- [ ] M7.1 Verifikasi migration deliveries/delivery_items
- [ ] M7.2 UI list + form rencana
- [ ] M7.3 Gantt Delivery
- [ ] M7.4 pgTAP: no cetak/export; gate draft; gate qc pass
- [ ] **Checkpoint M7**: batch→delivery→delivered→SO completed; `get_advisors` bersih

## M8 — Audit Log & Dashboard
- [ ] M8.1 Verifikasi audit_logs + dashboard views
- [ ] M8.2 UI dashboard dari views
- [ ] M8.3 Halaman admin lihat audit_logs
- [ ] M8.4 pgTAP: no INSERT policy audit_logs
- [ ] **Checkpoint M8 (FINAL)**: semua DoD SPEC.md terverifikasi; `get_advisors` bersih total; RLS Matrix §8 lengkap

---

**Open question yang masih menggantung** (jangan diimplementasikan tanpa tanya dulu): PRD §11 poin #10 — auto-fill `estimated_delivery_date` → `planned_delivery_date`.
