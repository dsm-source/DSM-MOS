# Implementation Plan: DSM Manufacturing Operating System

## Overview

Implementasi 9 milestone (M0–M8) sesuai `docs/PRD.md` v3 dan `docs/SPEC.md`. Repo bukan greenfield: scaffold frontend (`src/features/*`) dan 24 migration lokal sudah ada, tapi **belum pernah di-deploy** ke Supabase manapun. Audit langsung terhadap file migration (bukan tebakan) menemukan gap konkret berikut yang harus diperbaiki sebelum/selama milestone terkait — ini bukan build-dari-nol, tapi **audit-revise-deploy**.

## Temuan Audit Migration Lokal (fakta — sudah baca isi LENGKAP ke-24 file, bukan cuma nama tabel)

### A. Sudah benar, tidak perlu disentuh
- `app_role` enum: satu `production`, sudah sesuai PRD v3 (kekhawatiran sebelumnya soal "5 role per-stasiun" tidak terbukti — memang belum pernah dibuat begitu).
- `sales_orders`/`sales_order_items`/`customers`: RLS SELECT sudah benar mencakup **semua 9 role termasuk `viewer`**. Trigger nomor SO, validasi transisi status, auto-create engineering_jobs+material_statuses — semua sudah sesuai PRD.
- `user_roles`, `has_role()`, `claim_first_admin()`: bootstrap admin pertama sudah rapi (user pertama yang autentikasi bisa klaim admin kalau `user_roles` masih kosong, lalu admin itu yang provision user berikutnya manual — ini konsisten dengan "no self-signup untuk role assignment", tapi berarti Supabase Auth signup/sign-in sendiri tetap harus aktif untuk bikin baris `auth.users`. Klarifikasi ini didokumentasikan sebagai catatan, bukan gap.)
- `sales_order_assignments`, `sales_order_status_history`, `notifications`, `engineering_job_history`, `material_status_history`, `audit_logs`, 3 dashboard view — matang dan sesuai PRD v3 §6.2/§6.3.
- Gate produksi (`production_batch_steps_validate_transition`) — logikanya SUDAH SANGAT DEKAT dengan PRD §7 rule #1 (cek approved+material_ready untuk step aktif pertama, cek step sebelumnya completed, pesan error spesifik per nama tahapan). Tinggal disesuaikan untuk `rework` dan routing fleksibel (lihat bawah).
- `deliveries`/`delivery_items`: gate QC-pass, gate draft→prepared butuh 2 tanggal, auto-complete SO saat semua item terkirim — semua sudah sesuai PRD §7.

### B. Gap fitur (sudah diketahui dari sesi refinement sebelumnya)

| Item | Kondisi sekarang | Perlu jadi | Milestone |
|---|---|---|---|
| `production_step_status` enum | `waiting, running, paused, completed, skipped` | Tambah `rework` | M5/M6 |
| `production_batches` | Tidak ada kolom routing | Tambah `routing jsonb` | M4 |
| `production_batch_steps.operator_id` | `REFERENCES auth.users(id)` | Ubah ke `REFERENCES operators(id)` — tabel `operators` **belum ada, harus dibuat baru** | M4/M5 |
| `qc_inspections` | `production_batch_id` (per-batch), kolom `photo_urls text[]` | Ubah relasi ke `production_batch_step_id` (per-step), hapus kolom foto, tambah `rework_triggered_at` | M6 |
| `engineering_jobs.drawing_url` | Ada | Hapus kolom | M2 |

### C. Gap fungsi/trigger tersembunyi — BARU ditemukan lewat audit isi lengkap (bukan cuma nama kolom)

Ini bagian paling penting dari audit — perubahan skema di atas (B) punya **konsekuensi berantai ke trigger/function lain** yang harus direvisi bersamaan, bukan migration berdiri sendiri:

1. **`production_batches_create_steps()`** (trigger AFTER INSERT di `production_batches`) — hardcode INSERT 5 baris step (laser→bending→welding→powder→assembly) tanpa syarat. Harus direvisi baca `NEW.routing` dan cuma insert baris yang `routing[process] = true`. **(M4.2)**
2. **`production_batch_steps_validate_transition()`** — logic prasyarat "step sebelumnya" pakai `sequence_order < NEW.sequence_order AND status <> 'skipped'`, ini sudah otomatis kompatibel dengan routing fleksibel (karena step yang di-skip routing-nya tidak akan pernah dibuat sama sekali, bukan cuma ditandai `skipped`) — **tapi belum ada transisi apapun ke/dari status `rework`**, perlu ditambah. Juga baris `NEW.operator_id := auth.uid()` (auto-set operator ke user yang login) **harus dihapus** — kontradiksi dengan keputusan operator dipilih manual dari tabel `operators`, bukan auto dari akun admin yang login. **(M5.1/M5.2)**
3. **`production_batch_steps_auto_enqueue_qc()`** — trigger ini auto-insert SATU baris `qc_inspections` ke `production_batch_id` begitu **SEMUA** step batch `completed`. Ini implementasi lama model "QC per-batch". Harus diganti total jadi: auto-insert satu baris `qc_inspections` per **step individual** begitu step itu sendiri `completed` (bukan tunggu semua step). **(M6.1/M6.2 — bukan cuma ubah kolom, trigger-nya perlu ditulis ulang)**
4. **`qc_inspections_validate_insert()`** (BEFORE INSERT) — cek "semua step batch completed/skipped" sebelum izinkan insert QC. Harus diganti jadi cek "step **ini** (yang direferensikan `production_batch_step_id`) statusnya `completed`". **(M6.1)**
5. **`delivery_items_validate()`** — JOIN path saat ini: `qc_inspections → production_batches → engineering_jobs → sales_order_items → sales_orders` (lewat `qc_inspections.production_batch_id`). Begitu `qc_inspections` pindah relasi ke `production_batch_step_id`, join path harus nambah satu hop: `qc_inspections → production_batch_steps → production_batches → engineering_jobs → sales_order_items → sales_orders`. **(M6.1 — sekaligus sentuh kode M7, urutkan M6 sebelum test ulang M7)**
6. **`get_engineering_workload()`** — **INI BUG NYATA terhadap keputusan yang sudah dikonfirmasi**: PRD §6.3 sebut `v_engineering_workload` sebagai VIEW, tapi implementasi aktualnya adalah **function** `get_engineering_workload()` yang secara eksplisit `RAISE EXCEPTION 'Forbidden'` kalau pemanggil bukan role `engineering`/`admin`. Ini kontradiksi langsung dengan keputusan final "workload dashboard terbuka semua peran". Harus direvisi: hapus role-check di dalam function (atau ubah jadi VIEW asli dengan RLS SELECT semua peran, sesuai PRD). **(M2.2)**
7. **RLS SELECT untuk `viewer` role hilang di 9 tabel** — migrasi `20260723061827` (tanggal 23 Juli) mengganti kebijakan SELECT permisif (`USING (true)`) di banyak tabel dengan whitelist role eksplisit lewat `has_any_role(...)`, tapi **daftar role di whitelist itu tidak menyertakan `viewer`** di: `deliveries`, `delivery_items`, `engineering_jobs`, `engineering_job_history`, `material_statuses`, `production_batches`, `production_batch_steps`, `qc_inspections`, `sales_order_status_history`. PRD §4 eksplisit: *"`viewer` — Baca-saja, tanpa akses tulis di modul manapun"* — role ini seharusnya bisa baca semua tabel transaksi. Ini **regresi RLS yang harus diperbaiki**, kemungkinan besar tidak disengaja (whitelist manual yang lupa satu role). **(M0 atau tersebar per-milestone saat migration tabel terkait disentuh — perlu keputusan: perbaiki sekaligus di satu migration "fix" di M0, atau per-modul. Rekomendasi: satu migration terpusat di M0 supaya tidak kelewat.)**
8. **`sales_order_assignments` SELECT dibatasi terlalu ketat** — policy `soa_select_scoped` cuma izinkan `user_id = auth.uid() OR has_any_role(admin, sales)`. Artinya role lain (engineering, material, dst) **tidak bisa lihat siapa PIC mereka sendiri untuk SO tertentu** kecuali mereka sendiri yang di-assign. Perlu diputuskan: apakah ini disengaja (assignment memang privat) atau perlu dibuka mengikuti pola tabel lain (semua peran terkait boleh lihat). **Tandai sebagai open question ke product owner, jangan ubah sepihak.**
9. **Storage buckets `engineering-drawings` dan `qc-photos`** — ada RLS policy untuk keduanya di 3 migration terpisah, tapi **tidak ada statement `INSERT INTO storage.buckets` di migration manapun** — bucket-nya kemungkinan dibuat manual lewat Supabase Dashboard (melanggar aturan CLAUDE.md "jangan ubah skema lewat Dashboard", meski utk storage bucket agak abu-abu) atau belum pernah dibuat sama sekali. Karena kedua fitur (drawing upload, QC photo) **dihapus total** dari PRD v3, seluruh RLS policy untuk 2 bucket ini harus **dihapus**, dan perlu dicek manual di Supabase Dashboard apakah bucket-nya perlu dihapus juga. **(M2.1 untuk drawings, M6.1 untuk qc-photos)**

### D. Cross-check ke frontend (`src/features/`) — biar estimasi task M5/M6 akurat

- `src/features/production/components/station-step-card.tsx` — **konfirmasi ada komponen "Per-Stasiun"** yang sudah dibangun di frontend. Sesuai keputusan final (satu Kanban Per-Batch saja), komponen ini kemungkinan perlu **dihapus**, bukan direvisi. Perlu dibaca detail saat mulai M5 untuk pastikan tidak ada logic lain yang bergantung padanya.
- `src/features/production/components/planning-gantt.tsx`, `create-batch-dialog.tsx`, `edit-batch-plan-dialog.tsx` — sudah ada untuk M4, kemungkinan besar tinggal ditambah field routing checkbox, bukan dibangun ulang.
- `src/features/qc/components/inspection-dialog.tsx`, `inspection-timeline.tsx`, `hooks/use-inspections.ts` — dibangun untuk model qc per-batch (query `production_batch_id`). Perlu direvisi total query-nya ke `production_batch_step_id` saat M6, dan hapus semua bagian upload foto.
- `src/features/production/hooks/use-actor-emails.ts` — kemungkinan pembungkus `get_actor_emails()`/`get_engineer_emails()` RPC (untuk resolve nama user dari `auth.users`, karena tidak bisa query `auth.users` langsung dari client). Pola ini perlu direplikasi untuk `operators` (tapi `operators` bukan `auth.users`, jadi query langsung ke tabel `operators` cukup, tidak perlu RPC serupa).
- `src/features/engineering/hooks/use-workload.ts` — kemungkinan besar memanggil RPC `get_engineering_workload()` yang punya bug akses (poin C.6) — perlu dicek saat M2 apakah pemanggilan dari sisi frontend juga perlu berubah setelah RPC direvisi.

## Architecture Decisions

- **Audit-first per milestone**: sebelum menulis migration baru di modul manapun, jalankan `list_tables`/baca migration lokal relevan dulu untuk tabel modul itu — jangan asumsikan skema saat ini benar hanya karena filenya ada.
- **Satu migration baru per perubahan konsep**, bukan satu migration raksasa per milestone — memudahkan rollback dan review per keputusan (ikuti pola yang sudah dipakai di 24 migration lokal, satu konsep per file).
- **RPC wajib untuk rework** (PRD §7 rule #3) — bukan update langsung ke `production_batch_steps.status`, supaya siklus rework tidak bisa dilewati manipulasi API langsung (linked ke DoD M5/M6).
- **QC offline queue dibangun sesederhana mungkin** dulu (localStorage + retry-on-reconnect), evaluasi kebutuhan IndexedDB/service worker hanya kalau localStorage terbukti tidak cukup saat testing nyata di M6 — jangan over-engineer di awal.
- **Blocker non-negosiasi sebelum M0 mulai coding**: koneksi Supabase MCP harus sukses autentikasi ke project `jtzwawtfymljfqfrplib` (config sudah ditambahkan ke `.mcp.json`, user perlu jalankan `claude /mcp` sendiri di terminal). Tanpa ini, `apply_migration`/`get_advisors`/`list_tables` semua tidak bisa dipakai.

## Task List

### Phase 0 — Blocker & Audit (sebelum M0)

- [x] Task 0.1: Verifikasi koneksi Supabase MCP ke project `jtzwawtfymljfqfrplib` berhasil — **selesai**, terkonfirmasi `list_tables`/`list_migrations` ke project benar, database kosong (belum ada tabel/migration ter-deploy)
- [x] Task 0.2: Audit lengkap 24 migration lokal vs PRD v3 (baca isi penuh, bukan cuma nama) — **selesai**, hasil di §A–D atas. 9 poin gap fungsi/trigger baru ditemukan (C.1–C.9), 1 cross-check frontend (D)

### Checkpoint 0 — LOLOS
- [x] MCP Supabase bisa `list_tables` ke project yang benar (bukan `dsmsalescrm`)
- [x] Audit menyeluruh selesai, semua gap terdokumentasi di §A–D

### Phase M0 — Foundation

- [ ] Task M0.1: Deploy migration yang **sudah benar tanpa revisi** dulu (§A) — cek urutan dependency antar file sebelum apply
- [ ] Task M0.2: Migration "fix-viewer-rls" — kembalikan akses SELECT role `viewer` di 9 tabel yang keliru di-exclude (temuan C.7): `deliveries`, `delivery_items`, `engineering_jobs`, `engineering_job_history`, `material_statuses`, `production_batches`, `production_batch_steps`, `qc_inspections`, `sales_order_status_history`
- [ ] Task M0.3: Buat migration baru: tabel `operators` (id, name, employee_number nullable, is_active, created_at, created_by) + RLS (SELECT semua peran, INSERT/UPDATE/DELETE production_planning+admin)
- [ ] Task M0.4: Halaman admin "Kelola User" — buat akun manual (email+password sementara) + assign role, tanpa self-signup (PRD §M8, dipindah lebih awal karena M0 butuh test user per role). Catatan: `claim_first_admin()` sudah ada untuk bootstrap admin pertama — user pertama tetap perlu sign-up/sign-in Supabase Auth biasa dulu sebelum klaim admin.
- [ ] Task M0.5: Verifikasi layout/routing shell (`src/routes/_authenticated/`) sudah punya guard per role — kalau belum, bangun

### Checkpoint M0
- [ ] `get_advisors` bersih untuk semua tabel yang di-deploy
- [ ] Admin bisa login, buat user baru dengan role tertentu, user itu bisa login dan lihat menu sesuai role-nya
- [ ] Role `viewer` terverifikasi bisa SELECT semua tabel transaksi (pgTAP)
- [ ] pgTAP dasar: `has_role`/`has_any_role` teruji

### Phase M1 — Sales Order + Notifikasi

- [ ] Task M1.1: Verifikasi migration `sales_orders`, `sales_order_items`, `customers`, `sales_order_assignments`, `sales_order_status_history`, `notifications` ter-deploy dan RLS sesuai §8
- [ ] Task M1.2: UI list SO (pagination, filter status, search) — cek `src/features/sales-orders/` apa yang sudah ada, lanjutkan bukan re-build
- [ ] Task M1.3: UI detail SO + form assignment PIC per role (`sales_order_assignments`)
- [ ] Task M1.4: UI form create/edit SO dengan item dinamis
- [ ] Task M1.5: Master data customer (CRUD) — cek `src/features/customers/`
- [ ] Task M1.6: Bell icon notifikasi di header, baca `notifications` realtime, mark-as-read
- [ ] Task M1.7: pgTAP test: SO `confirmed` → Engineering Job + Material Status otomatis; status change → history + notification row muncul untuk role yang benar

### Checkpoint M1
- [ ] Full flow: buat SO → confirm → verifikasi Engineering Job + Material Status otomatis dibuat, notifikasi masuk ke role engineering/material/production_planning
- [ ] `get_advisors` bersih

### Phase M2 — Engineering

- [ ] Task M2.1: Migration: hapus kolom `engineering_jobs.drawing_url`; hapus 4 RLS policy storage bucket `engineering-drawings` (temuan C.9); cek manual di Supabase Dashboard apakah bucket perlu dihapus juga
- [ ] Task M2.2: **Fix bug C.6** — `get_engineering_workload()` RPC saat ini `RAISE EXCEPTION 'Forbidden'` untuk role selain engineering/admin. Hapus role-check ini (akses semua peran, sesuai keputusan final). Sesuaikan juga pemanggilan di `src/features/engineering/hooks/use-workload.ts`
- [ ] Task M2.3: UI papan Engineering Job per status (kartu: assigned_to, progress bar, target — overdue merah) — cek `src/features/engineering/` existing
- [ ] Task M2.4: UI detail job: ubah status, assign, update progress, set target, approve — **tanpa** upload drawing
- [ ] Task M2.5: Tab "Riwayat" di detail job dari `engineering_job_history`
- [ ] Task M2.6: Halaman "Engineering Workload" (accessible semua peran)
- [ ] Task M2.7: pgTAP: tidak bisa `in_progress` tanpa assigned_to+target; progress terkunci 100 saat approved; `v_engineering_workload` SELECT semua peran

### Checkpoint M2
- [ ] Full flow: assign job → in_progress → update progress → approve, riwayat field-change muncul di tab
- [ ] `get_advisors` bersih

### Phase M3 — Material Status

- [ ] Task M3.1: Verifikasi `material_statuses`, `material_status_history` ter-deploy sesuai §8
- [ ] Task M3.2: UI papan status Material (terpisah dari Engineering) — cek `src/features/material/`
- [ ] Task M3.3: Detail: ubah status, catatan, tab riwayat dari `material_status_history`
- [ ] Task M3.4: pgTAP: 1:1 dengan engineering_job, tidak bisa duplikat manual, history tercatat

### Checkpoint M3
- [ ] Full flow: engineering job baru → material_status otomatis dibuat `waiting_material` → update ke `material_ready` → riwayat tercatat
- [ ] `get_advisors` bersih

### Phase M4 — Production Planning

- [ ] Task M4.1: Migration: tambah kolom `production_batches.routing jsonb`
- [ ] Task M4.2: Migration: revisi FK `production_batch_steps.operator_id` → `operators(id)` (bukan `auth.users`); **rewrite `production_batches_create_steps()`** (temuan C.1) supaya baca `NEW.routing` dan cuma insert baris step yang `routing[process] = true`, bukan hardcode 5 baris
- [ ] Task M4.3: UI master data Operators (CRUD, production_planning+admin) — halaman baru
- [ ] Task M4.4: UI form buat batch: quantity, 3 tanggal, checkbox routing per tahapan
- [ ] Task M4.5: Gantt chart (`gantt-task-react`): baris=batch, bar=planned_start→completion, milestone estimated_delivery, toggle Weekly/Monthly, badge tahapan aktif, overdue merah, klik bar→edit (tombol, bukan drag)
- [ ] Task M4.6: pgTAP: hanya production_planning/admin insert/update batches & operators; routing menentukan baris steps yang dibuat; Gantt tidak query data deliveries

### Checkpoint M4
- [ ] Full flow: job approved+material ready → buat batch dengan routing custom (skip 1-2 tahapan) → verifikasi cuma baris step yang relevan dibuat
- [ ] `get_advisors` bersih

### Phase M5 — Production Execution

- [ ] Task M5.1: Migration: tambah `rework` ke enum `production_step_status`
- [ ] Task M5.2: Revisi `production_batch_steps_validate_transition()` (bukan bikin baru — trigger ini sudah 90% benar, lihat §A): tambah transisi ke/dari `rework`; **hapus baris `NEW.operator_id := auth.uid()`** (temuan C.2 — operator harus dipilih manual dari `operators`, bukan auto dari akun admin yang login)
- [ ] Task M5.3: UI **satu Kanban Per-Batch** (bukan dua tampilan) — kolom mengikuti `routing` batch (3-5 kolom dinamis), drag-and-drop (admin, mouse). **Hapus `src/features/production/components/station-step-card.tsx`** (temuan D — komponen "Per-Stasiun" sudah terlanjur dibangun, tidak dipakai lagi di keputusan final)
- [ ] Task M5.4: Saat kartu dipindah, form isi `operator_id` dari dropdown master `operators`
- [ ] Task M5.5: Realtime subscription untuk Kanban
- [ ] Task M5.6: pgTAP + manual test: coba update step via SQL/RPC langsung melanggar urutan gate → harus ditolak dengan pesan error yang sesuai aturan

### Checkpoint M5
- [ ] Full flow: batch running dari step 1 sampai step terakhir sesuai gate; percobaan skip gate lewat SQL ditolak
- [ ] `get_advisors` bersih

### Phase M6 — Quality Control

- [ ] Task M6.1: Migration: ubah `qc_inspections.production_batch_id` → `production_batch_step_id`; hapus kolom foto (`photo_urls`); tambah `rework_triggered_at`; hapus 4 RLS policy storage bucket `qc-photos` (temuan C.9). **Rewrite `production_batch_steps_auto_enqueue_qc()`** (temuan C.3) dari "tunggu SEMUA step batch completed" jadi "step INI completed → auto-insert satu qc_inspections". **Rewrite `qc_inspections_validate_insert()`** (temuan C.4) dari cek semua-step-batch jadi cek step-ini-completed. **Revisi join path `delivery_items_validate()`** (temuan C.5, di migration deliveries) supaya lewat `production_batch_steps` — tambah satu hop join
- [ ] Task M6.2: Migration: RPC "trigger_rework" (security definer, hanya role qc/admin) — set step jadi `rework`, insert baris `qc_inspections` baru untuk cycle berikutnya
- [ ] Task M6.3: UI mobile-responsive: antrian inspeksi per step `completed`, form qty OK/reject + catatan (tanpa foto). Revisi total `src/features/qc/hooks/use-inspections.ts` dan `components/inspection-dialog.tsx`/`inspection-timeline.tsx` (masih query per-batch, temuan D)
- [ ] Task M6.4: UI tombol "Trigger Rework" saat hasil reject, panggil RPC
- [ ] Task M6.5: Timeline riwayat inspeksi (multi-cycle) di detail step
- [ ] Task M6.6: Offline queue: form tersimpan lokal (localStorage) saat submit tanpa koneksi, indikator visual "Tersimpan lokal, menunggu sinkronisasi", auto-retry saat online kembali
- [ ] Task M6.7: pgTAP: qc_inspections tidak bisa dibuat untuk step belum completed; hanya qc/admin insert & panggil RPC rework
- [ ] Task M6.8: Manual test offline: matikan network di dev tools saat submit, verifikasi tersimpan lokal, nyalakan network, verifikasi auto-sync

### Checkpoint M6
- [ ] Full flow: step completed → QC pass → step berikutnya jalan; step completed → QC reject → trigger rework → step balik jalan → QC lagi → pass, riwayat 2 cycle muncul
- [ ] Offline submit-then-sync terverifikasi manual
- [ ] `get_advisors` bersih

### Phase M7 — Delivery

- [ ] Task M7.1: Verifikasi migration `deliveries`, `delivery_items` sesuai §6.2/§8 (sudah terlihat benar dari audit)
- [ ] Task M7.2: UI list rencana pengiriman + form catat rencana
- [ ] Task M7.3: Gantt chart delivery (`gantt-task-react`), toggle Weekly/Monthly, warna status, overdue merah
- [ ] Task M7.4: pgTAP: tidak ada tombol cetak/export; delivery tidak bisa keluar draft tanpa 2 tanggal; delivery item butuh qc_inspection pass di step final

### Checkpoint M7
- [ ] Full flow: batch selesai QC pass di step final → buat delivery → keluar draft → shipped → delivered → SO otomatis completed
- [ ] `get_advisors` bersih

### Phase M8 — Audit Log & Dashboard

- [ ] Task M8.1: Verifikasi `audit_logs` + 3 dashboard view ter-deploy sesuai §6.2/§6.3
- [ ] Task M8.2: UI dashboard ringkas dari `v_dashboard_*` views
- [ ] Task M8.3: Halaman admin lihat `audit_logs` (admin-only)
- [ ] Task M8.4: pgTAP: audit_logs tidak ada policy INSERT untuk role manapun

### Checkpoint M8 (Final)
- [ ] Seluruh 8 modul DoD di `docs/SPEC.md` §Success Criteria terverifikasi
- [ ] `get_advisors` bersih total, tidak ada temuan security/performance kritikal
- [ ] RLS Matrix PRD §8 tertegakkan penuh (pgTAP lengkap per tabel, per peran)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| MCP Supabase belum terautentikasi ke project yang benar | Tinggi — blokir semua kerja M0+ | Task 0.1 wajib selesai duluan, verifikasi eksplisit sebelum migration pertama |
| Migration lokal yang sudah ada mungkin punya trigger/RLS lain yang belum ke-audit (baru baca subset file) | Sedang | Task 0.2 — audit menyeluruh sebelum mulai coding, bukan cuma tabel yang sudah diketahui |
| Perubahan skema `qc_inspections` (batch→step) bisa mempengaruhi kode frontend `src/features/qc/` yang sudah ada, berpotensi banyak rewrite | Sedang | Baca kode existing dulu di awal M6 sebelum migration, supaya tahu blast radius perubahan |
| Offline queue QC (M6.6) berisiko over-engineered kalau langsung pakai service worker/PWA penuh | Rendah-Sedang | Mulai dari localStorage sederhana dulu (Architecture Decisions), eskalasi hanya kalau perlu |
| Routing fleksibel per-batch (M4) mengubah cara `production_batch_steps` dibuat — trigger existing kemungkinan hardcode 5 baris | Sedang | Task M4.2 eksplisit revisi trigger, bukan asumsi tinggal tambah kolom |

## Open Questions

- PRD §11 poin #10 (auto-fill `estimated_delivery_date` → `deliveries.planned_delivery_date`) — belum final, jangan diimplementasikan sampai dikonfirmasi. Kalau M4/M7 menyentuh ini, tanya dulu.
- **BARU (temuan audit C.8)**: `sales_order_assignments` SELECT dibatasi ke `user_id = auth.uid() OR admin/sales` — role lain tidak bisa lihat siapa PIC mereka sendiri di SO tertentu. Apakah ini disengaja (assignment privat) atau perlu dibuka seperti tabel lain? Perlu jawaban product owner sebelum M1 menyentuh fitur assignment.
- **BARU (temuan audit C.9)**: storage bucket `engineering-drawings` dan `qc-photos` tidak ditemukan statement pembuatannya di migration manapun — kemungkinan dibuat manual lewat Supabase Dashboard. Karena project belum pernah di-deploy (database masih kosong, dikonfirmasi via `list_tables`), kemungkinan besar bucket ini juga belum ada di project Supabase yang baru — tapi perlu dicek manual sebelum M2/M6 untuk memastikan tidak ada bucket nyasar yang perlu dibersihkan.
