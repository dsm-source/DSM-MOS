# PRD — DSM Manufacturing Operating System

| | |
|---|---|
| Status | Draft v3 — direfine lewat sesi interview mendalam (operasional + teknis), siap implementasi |
| Pembaca utama | Claude Code (agen implementasi), ditinjau oleh product owner |
| Dokumen pendamping | `CLAUDE.md` (aturan permanen, baca lebih dulu), `SPEC.md` (spec teknis turunan PRD ini) |
| Supabase project | Belum terhubung ke MCP session ini (permission denied). Project ref: `jtzwawtfymljfqfrplib` — https://supabase.com/dashboard/project/jtzwawtfymljfqfrplib/settings/general. **Belum ada migration yang di-deploy ke project ini** — semua migration di `supabase/migrations/` masih lokal, belum pernah dijalankan ke database manapun. |

---

## 1. Ringkasan & Masalah

Perusahaan manufaktur sheet metal saat ini tidak punya sistem terpusat untuk melacak pesanan dari masuk sampai terkirim. DSM MOS mendigitalkan lima tahap operasional inti — Sales Order, Engineering, Production, Quality Control, Delivery — supaya setiap divisi tahu status pekerjaan secara real-time, dan supaya aturan bisnis (mis. "produksi tidak boleh mulai tanpa material siap") ditegakkan oleh sistem, bukan cuma diingat orang.

**Ini bukan ERP.** Tidak ada Purchasing, Inventory/Warehouse, Finance/Accounting, HR, Payroll, atau CRM di sini. Sistem ini juga tidak membuat dokumen surat jalan resmi — itu tetap di sistem finance perusahaan yang terpisah.

## 2. Tujuan

- Setiap divisi (Sales, Engineering, Material, Production Planning, Production, QC, Delivery) punya tampilan kerja sendiri, cepat dipakai, ≤3 klik untuk aksi harian.
- Aturan bisnis lintas-divisi (gate material, gate QC, urutan proses produksi) ditegakkan di database, tidak bisa dilewati dari UI.
- Setiap perubahan status tercatat otomatis (audit trail) tanpa campur tangan manual.
- Production Planning dan Delivery masing-masing punya tampilan jadwal (Gantt) untuk kebutuhan yang berbeda: satu untuk estimasi kapasitas produksi, satu untuk logistik pengiriman harian.
- User yang aksesnya dari lapangan (QC) tetap bisa kerja meski koneksi WiFi pabrik putus-putus.

## 3. Non-Goals

Modul yang **tidak** dibangun dalam scope ini, meski secara teori "berkaitan": CRM, Purchasing, Inventory, Warehouse Management, Finance, Accounting, HR, Payroll, cetak/generate dokumen surat jalan resmi, integrasi otomatis ke sistem finance eksternal, kalkulasi cycle-time otomatis dari data historis (estimasi durasi produksi diisi manual).

Juga eksplisit di luar scope (dikonfirmasi lewat sesi refinement):
- App terpisah / login untuk operator mesin produksi atau driver truk — mereka tidak pernah mengakses sistem langsung.
- Upload foto di modul QC (dihapus untuk hemat biaya storage Supabase).
- Upload gambar teknik (drawing) di modul Engineering.
- Self-signup akun user — semua akun dibuat manual oleh admin.

Kalau ada permintaan fitur yang masuk ke salah satu kategori ini, implementasi harus berhenti dan konfirmasi ke product owner dulu — jangan diam-diam dikerjakan.

## 4. Peran Pengguna

| Peran | Divisi/Fungsi | Tanggung jawab utama | Device & pola kerja |
|---|---|---|---|
| `admin` | — | Akses penuh semua modul, kelola user & peran | Kantor, laptop/PC |
| `sales` | Sales | Buat & kelola Sales Order dan Customer | Kantor, laptop/PC |
| `engineering` | Engineering | Kerjakan & approve Engineering Job (desain teknik) | Kantor, laptop/PC |
| `material` | Material Control | Update status kesiapan bahan per job | Kantor, laptop/PC |
| `production_planning` | PPIC | Buat Production Batch, tentukan routing tahapan, susun jadwal (Gantt), kelola master data `operators` | Kantor, laptop/PC |
| `production` | Shop Floor Admin | Eksekusi harian tahapan produksi (Kanban) untuk **semua** tahapan/mesin, catat nama operator mesin per step | **Satu admin per shift**, laptop/PC — bukan operator mesin sendiri |
| `qc` | Quality Control | Inspeksi per tahapan produksi, catat pass/reject, trigger rework | **Keliling shop floor**, HP/tablet, **butuh mode offline** |
| `delivery` | Delivery/Logistik | Jadwalkan pengiriman, catat status berdasar laporan driver (telepon/WA) | Kantor, laptop/PC |
| `viewer` | — | Baca-saja, tanpa akses tulis di modul manapun | — |

**Catatan penting:**
- Engineering vs Material adalah dua divisi terpisah meski sama-sama "menyiapkan job sebelum produksi" — jangan pernah digabung jadi satu peran atau satu tabel kepemilikan.
- Production Planning vs Production: yang pertama menjadwalkan & tentukan routing, yang kedua mengeksekusi.
- **Role `production` tetap SATU** (bukan role per-stasiun/mesin). Operator mesin (tukang laser, bending, welding, dst) **tidak login ke sistem** — nama mereka dicatat sebagai master data `operators` (lihat §6.2), diisi manual oleh admin production di form step, murni untuk keperluan jejak/akuntabilitas (bukan otorisasi).
- Akun user (semua role di atas) **dibuat manual oleh admin** — tidak ada alur self-signup/registrasi publik.

## 5. Arsitektur & Stack

Frontend React + TypeScript strict + Vite + React Router + TanStack Query + Tailwind + shadcn/ui. Backend sepenuhnya Supabase (Postgres + Auth + RLS + Edge Functions + Realtime + Storage) — tidak ada server API terpisah. Migration lewat `supabase/migrations/`, tipe TypeScript di-generate dari database, tidak ditulis manual.

Dua library UI eksternal yang dipakai secara sengaja (jangan bangun custom dari nol): `gantt-task-react` untuk kedua Gantt chart (Production Planning & Delivery Schedule).

**Kebutuhan khusus modul QC (offline submit-only):** QC bekerja mobile (HP/tablet) di area shop floor yang punya blank spot WiFi. Form inspeksi (qty OK/reject, catatan — **tanpa foto**) harus bisa **diisi dan disimpan lokal di device** saat offline, lalu **otomatis sync ke Supabase begitu koneksi kembali**. Ini bukan full offline-first app (tidak perlu caching data untuk browsing saat offline) — cukup queue submit sederhana (local storage/IndexedDB + retry saat online). Modul lain (Sales, Engineering, Material, Production, Delivery) diasumsikan selalu online (kerja dari kantor).

## 6. Model Data

### 6.1 Enum

```
app_role                admin, sales, engineering, material, production_planning, production, qc, delivery, viewer
notification_type       so_status_changed
sales_order_status      draft, confirmed, engineering, production, quality_control, delivery, completed, cancelled
engineering_status      draft, in_progress, review, approved
material_status         waiting_material, partial_material, material_ready
production_process      laser_cutting, bending, welding_grinding, powder_coating, assembly   -- urutan tetap FIXED
production_step_status  waiting, running, paused, completed, skipped, rework
qc_status                waiting, inspection, pass, reject, rework
delivery_status          draft, prepared, shipped, delivered
```

Catatan: `production_step_status` punya state `rework` untuk menampung siklus perbaikan setelah QC reject (lihat §7 rule #3). Urutan 5 tahapan produksi (`production_process`) tetap fixed secara definisi, tapi **mana yang dipakai per batch bersifat fleksibel** — ditentukan production_planning saat membuat batch (lihat `production_batches.routing` di §6.2), bukan lewat reorder urutan.

### 6.2 Tabel Inti

**user_roles** — `user_id → auth.users`, `role app_role`. Unique(user_id, role). Sumber kebenaran otorisasi, bukan `raw_user_meta_data`.

**operators** — **BARU.** Master data nama operator mesin shop floor, **tanpa akun login** (bukan FK ke `auth.users`). Kolom: `id`, `name`, `employee_number` (opsional), `is_active boolean default true`, `created_at`, `created_by`. Dikelola oleh `production_planning`/`admin`. Dipakai untuk mengisi `production_batch_steps.operator_id` — murni pencatatan, bukan otorisasi akses.

**customers** — nama, kode unik, contact person, telepon, alamat.

**sales_orders** — `so_number` unik auto-generate, `customer_id`, `order_date`, `due_date`, `status sales_order_status`, `notes`, `created_by`.

**sales_order_items** — `sales_order_id` (cascade), `item_name`, `drawing_number`, `quantity numeric(18,4) check > 0`, `unit`, `material_spec`. Satu SO bisa banyak item = banyak tipe produk.

**sales_order_assignments** — **BARU (formal).** PIC per role untuk satu SO — dipakai untuk routing notifikasi (lihat `notifications` di bawah), bukan pembatasan akses (RLS SO tetap "semua peran boleh baca"). Kolom: `sales_order_id`, `role app_role`, `user_id → auth.users`, `created_by`. Unique(sales_order_id, role). Insert/update/delete oleh `sales`/`admin`.

**sales_order_status_history** — **BARU (formal).** Riwayat transisi status SO, ditulis otomatis oleh trigger saat `sales_orders.status` berubah (terpisah dari `audit_logs` — lihat catatan "Dua Sistem Audit" di bawah). Kolom: `sales_order_id`, `from_status`, `to_status`, `changed_by`, `changed_at`. Read-only untuk semua peran (insert hanya lewat trigger).

**notifications** — **BARU (formal).** Notifikasi in-app per user. Trigger otomatis mengisi tabel ini saat `sales_orders.status` berubah: menentukan role mana yang relevan dengan status baru (mis. `confirmed` → notify `engineering`+`material`+`production_planning`), lalu kirim ke user yang di-assign (`sales_order_assignments`) untuk role tsb + semua `admin` + pembuat SO — kecuali si pengubah status sendiri. Kolom: `user_id`, `type notification_type`, `title`, `body`, `link_path`, `metadata jsonb`, `read_at` (nullable), `created_at`. User hanya bisa SELECT/UPDATE (mark as read) baris miliknya sendiri. Terdaftar di Supabase Realtime.

**engineering_jobs** — satu baris otomatis per `sales_order_item` saat SO `confirmed`. Kolom: `job_number` unik auto-generate, `sales_order_item_id`, `status engineering_status`, `assigned_to → auth.users`, `progress_percent smallint 0-100 default 0`, `target_completion_date date`, `notes`, `approved_by`, `approved_at`. **Tidak ada kolom `drawing_url`** — engineering tidak menyimpan file gambar teknik di sistem ini.
Aturan: tidak boleh masuk `in_progress` tanpa `assigned_to` + `target_completion_date` terisi. `progress_percent` otomatis 100 saat `approved`.

**engineering_job_history** — **BARU (formal).** Riwayat perubahan per-field pada `engineering_jobs` (status, assigned_to, progress_percent, target_completion_date, notes, approved_by), ditulis otomatis oleh trigger. Lebih detail dari `audit_logs` (yang cuma catat perubahan status). Kolom: `engineering_job_id`, `field_changed`, `from_value`, `to_value`, `changed_by`, `changed_at`. Read-only, semua peran bisa baca.

**material_statuses** — satu baris 1:1 per `engineering_job`, dibuat otomatis bersamaan dengan job (trigger yang sama). Kolom: `engineering_job_id` unique, `status material_status`, `updated_by`, `notes`.

**material_status_history** — **BARU (formal).** Riwayat transisi status material, ditulis otomatis oleh trigger. Kolom: `material_status_id`, `engineering_job_id`, `from_status`, `to_status`, `notes`, `changed_by`, `changed_at`. Read-only untuk peran terkait (admin, engineering, sales, material, production_planning, production, qc).

**production_batches** — dibuat manual oleh `production_planning`/`admin`, mewakili satu pemecahan produksi untuk satu `engineering_job` (satu tipe produk bisa punya banyak batch). Kolom: `batch_number` unik format `{job_number}-B{urutan}`, `engineering_job_id`, `quantity numeric(18,4) check > 0`, `planned_start_date`, `planned_completion_date`, `estimated_delivery_date`, `routing jsonb` (mana tahapan yang aktif per-batch, mis. `{"laser_cutting": true, "bending": true, "welding_grinding": false, "powder_coating": true, "assembly": true}` — dipilih production_planning saat buat batch, tidak ada master data product-type global), `notes`, `created_by`. Check: `planned_completion_date >= planned_start_date`, `estimated_delivery_date >= planned_completion_date`.

**production_batch_steps** — dibuat otomatis saat batch dibuat, satu baris per `production_process` yang `routing[process] = true`. Kolom: `production_batch_id`, `process`, `sequence_order`, `status production_step_status`, `operator_id → operators.id` (nullable — diisi admin production saat step mulai dikerjakan), `started_at`, `paused_at`, `completed_at`, `qty_completed`, `notes`. Status bisa reversi `completed → rework` lewat RPC formal "Trigger Rework" yang cuma bisa dipanggil role `qc`/`admin` (lihat §7 rule #3). Unique(batch_id, process), unique(batch_id, sequence_order).

**qc_inspections** — relasi ke `production_batch_step_id` (per-tahapan, bukan per-batch). Kolom: `production_batch_step_id`, `status qc_status`, `inspector_id`, `qty_total`, `qty_ok`, `qty_reject` (check `qty_ok + qty_reject <= qty_total`), `defect_notes`, `inspected_at`. **Tidak ada kolom foto** (dihapus untuk hemat storage). Satu step bisa punya banyak baris `qc_inspections` kalau ada siklus rework (baris baru per cycle, bukan ditimpa) — jadi timeline riwayat inspeksi otomatis dari urutan baris ini.

**deliveries** — `do_number` (kode referensi internal, BUKAN nomor dokumen resmi), `sales_order_id`, `status delivery_status`, `planned_ship_date`, `planned_delivery_date`, `prepared_at`, `shipped_at`, `delivered_at`, `driver_name`, `vehicle_number`, `received_by`, `notes`. Check `planned_delivery_date >= planned_ship_date`. Diisi oleh admin delivery dari kantor berdasarkan laporan driver (telepon/WA) — tidak ada app terpisah untuk driver.

**delivery_items** — `delivery_id` (cascade), `qc_inspection_id`, `quantity`.

**audit_logs** — log forensik generik, admin-only. `table_name`, `record_id`, `action`, `old_status`, `new_status`, `changed_by`, `changed_at`, `metadata jsonb`. Diisi trigger di semua tabel transaksi, tidak ada jalur insert manual.

**Catatan "Dua Sistem Audit" (keputusan desain, bukan duplikasi tidak sengaja):**
`audit_logs` dan tabel `*_history` (`sales_order_status_history`, `engineering_job_history`, `material_status_history`) **sengaja dipertahankan bersamaan** karena tujuannya beda:
- `audit_logs` — log forensik/compliance, admin-only, generik (semua tabel transaksi, cuma kolom status), immutable, dipakai untuk investigasi/keamanan.
- Tabel `*_history` — timeline yang ditampilkan di UI untuk user biasa (mis. tab "Riwayat" di detail Engineering Job), lebih granular (per-field untuk engineering, bukan cuma status), dan sudah dibaca oleh peran-peran relevan (bukan admin-only).
Jangan konsolidasikan jadi satu — kalau perlu tambah riwayat serupa di tabel baru nanti, ikuti pola yang sama (dua sistem, dua tujuan).

### 6.3 View

**v_engineering_workload** — agregat per `assigned_to`: jumlah job per status, rata-rata `progress_percent`, jumlah job overdue (`target_completion_date < current_date AND status <> 'approved'`). Akses SELECT untuk **semua peran** (transparansi lintas-divisi).

**v_dashboard_so_status** — jumlah sales_orders per status (exclude yang `deleted_at` terisi kalau soft-delete dipakai). Dipakai M8 Dashboard.

**v_dashboard_material_waiting** — jumlah `material_statuses` dengan status `waiting_material`. Dipakai M8 Dashboard.

**v_dashboard_production_running** — jumlah `production_batch_steps` dengan status `running`. Dipakai M8 Dashboard.

Semua view dashboard pakai `security_invoker=true` supaya tetap tunduk RLS tabel sumber, bukan bypass.

## 7. Business Rules (Ditegakkan di Database)

1. Tahapan proses pertama yang aktif pada suatu batch (`routing[process]=true`, bukan `skipped`) tidak boleh `running` kecuali `engineering_jobs.status = 'approved'` DAN `material_statuses.status = 'material_ready'`. Tahapan berikutnya (yang aktif) tidak boleh `running` sebelum tahapan sebelumnya (yang aktif) `completed`. Pesan error harus menyebut alasan spesifik (menunggu approval / menunggu material / menunggu tahapan sebelumnya).
2. QC dilakukan **per tahapan** (`production_batch_steps`), bukan per-batch. `qc_inspections` hanya boleh dibuat untuk step yang `completed`. Tahapan berikutnya tidak boleh `running` sebelum step sebelumnya punya `qc_inspections` dengan hasil `pass`.
3. **Rework flow:** saat hasil QC `reject`, role `qc`/`admin` memanggil RPC formal "Trigger Rework" → set step terkait jadi status `rework`, izinkan step tersebut (atau step sebelumnya, sesuai kasus) `running` kembali untuk perbaikan. Rework **tidak boleh** dilakukan lewat update langsung ke `production_batch_steps.status` — harus lewat RPC ini supaya tercatat jelas sebagai siklus rework, bukan progres normal. Riwayat setiap cycle disimpan sebagai baris baru di `qc_inspections`.
4. Delivery tidak boleh dibuat/berisi item bila step final batch terkait belum punya `qc_inspection` dengan status `pass`.
5. Delivery tidak boleh keluar dari `draft` tanpa `planned_ship_date` dan `planned_delivery_date` terisi.
6. Saat delivery `delivered` dan semua item SO terkirim → SO otomatis jadi `completed`.
7. Engineering Job dibuat otomatis (trigger) untuk setiap `sales_order_item` saat SO `confirmed`; baris `material_statuses` dibuat bersamaan oleh trigger yang sama.
8. Engineering Job tidak boleh `in_progress` tanpa `assigned_to` + `target_completion_date`. `progress_percent` dipaksa 100 saat `approved`.
9. Production Batch hanya dibuat oleh `production_planning`/`admin` — ini momen "release ke produksi". Routing (mana tahapan yang aktif) dipilih production_planning saat itu juga, disimpan di `production_batches.routing`.
10. `production_batch_steps.operator_id` (referensi ke `operators`, bukan `auth.users`) diisi manual oleh admin production — tidak divalidasi terhadap identitas login (operator tidak login).
11. Saat `sales_orders.status` berubah: baris baru otomatis masuk `sales_order_status_history`, dan notifikasi otomatis dikirim ke role relevan + admin + pembuat SO (kecuali si pengubah) lewat `notifications`.
12. Semua perubahan status tercatat di `audit_logs` via trigger (log forensik generik), **terpisah** dari tabel `*_history` per-domain (lihat catatan §6.2) — tidak ada jalur insert manual ke keduanya.
13. Nomor dokumen (SO/job/batch/DO) dari Postgres sequence + function, tidak dari client — mencegah race condition.

## 8. RLS Matrix

| Tabel/Modul | SELECT | INSERT/UPDATE/DELETE |
|---|---|---|
| sales_orders, sales_order_items, customers | semua peran | sales, admin |
| sales_order_assignments | semua peran | sales, admin |
| sales_order_status_history | semua peran | tidak ada (hanya trigger) |
| notifications | user lihat baris sendiri | tidak ada insert (trigger); user update (mark read) baris sendiri |
| engineering_jobs | semua peran | engineering, admin |
| engineering_job_history | semua peran | tidak ada (hanya trigger) |
| v_engineering_workload | semua peran | — (view) |
| operators | semua peran | production_planning, admin |
| material_statuses | semua peran | material, admin |
| material_status_history | admin, engineering, sales, material, production_planning, production, qc | tidak ada (hanya trigger) |
| production_batches | semua peran | production_planning, admin |
| production_batch_steps | semua peran | production, admin (rework hanya lewat RPC khusus, role qc/admin) |
| qc_inspections | semua peran | qc, admin |
| deliveries, delivery_items | semua peran | delivery, admin |
| audit_logs | admin | tidak ada (hanya via trigger security definer) |
| user_roles | user lihat baris sendiri; admin lihat semua | admin saja |
| v_dashboard_* | semua peran | — (view) |

## 9. Spesifikasi per Modul

### M1 — Sales Order
UI: list ber-pagination dengan filter status & pencarian (nomor SO, nama customer), badge status warna+teks. Detail SO dengan tabel item + assignment PIC per role (untuk routing notifikasi). Form create/edit dengan item dinamis. Master data customer (CRUD). Bell icon notifikasi di header (baca `notifications` milik user, realtime).
DoD: trigger validasi transisi status berfungsi; SO `confirmed` memicu pembuatan Engineering Job + Material Status otomatis; perubahan status SO memicu baris `sales_order_status_history` + `notifications` ke role relevan (verifikasi via test).

### M2 — Engineering
UI: papan Engineering Job per status. Kartu menampilkan `assigned_to`, progress bar %, target penyelesaian (overdue = merah + label "Terlambat X hari"). Detail job: ubah status, assign, update progress, set target, approve — **tanpa upload drawing**. Tab "Riwayat" di detail job menampilkan `engineering_job_history` sebagai timeline. Halaman "Engineering Workload" (accessible semua peran): per engineer — jumlah job aktif, breakdown status, rata-rata progress, daftar overdue.
DoD: tidak bisa masuk `in_progress` tanpa assigned_to+target; `progress_percent` terkunci 100 saat approved; `v_engineering_workload` accessible semua peran; setiap perubahan field job tercatat di `engineering_job_history` (verifikasi test).

### M3 — Material Status
UI: papan status terpisah dari Engineering (tabel & akses tulis sendiri). Detail: ubah status, catatan kedatangan/kekurangan bahan, tab riwayat dari `material_status_history`.
DoD: baris material_statuses selalu 1:1 dengan engineering_job, dibuat otomatis, tidak bisa dibuat manual duplikat; perubahan status tercatat di `material_status_history`.

### M4 — Production Planning
UI: form buat batch baru: quantity, tiga tanggal rencana, **routing selection** (checkbox per tahapan — laser cutting, bending, welding, powder coating, assembly — pilih mana yang dipakai batch ini). Hanya untuk job yang sudah approved+material ready. Halaman master data **Operators** (CRUD nama operator mesin, tanpa akun login). Gantt chart (`gantt-task-react`), baris = batch, bar = planned_start→planned_completion, milestone terpisah di estimated_delivery_date, toggle Weekly/Monthly, badge status tahapan aktif saat ini di tiap bar, merah+label untuk yang overdue. Batch belum dijadwalkan tampil di daftar terpisah, bukan di chart. Klik bar → edit jadwal (replanning) — tombol, bukan drag pada Gantt.
DoD: hanya production_planning/admin bisa insert/update production_batches & operators; routing tersimpan di `routing jsonb` dan menentukan baris `production_batch_steps` mana yang dibuat; Gantt terisolasi total dari data deliveries.

### M5 — Production Execution
UI: **satu Kanban "Per-Batch"** (bukan dua tampilan) — kolom sesuai tahapan aktif batch (mengikuti `routing`, jadi bisa 3-5 kolom tergantung batch), kartu = batch, tahapan skip ditandai jelas. Dioperasikan oleh **satu admin production** per shift lewat laptop/PC — drag-and-drop antar kolom untuk ubah status (mouse-based, bukan touchscreen sarung tangan, jadi drag-drop aman dipakai di sini). Saat kartu dipindah ke kolom tahapan, admin mengisi/pilih `operator_id` dari master data `operators` (nama tukang yang benar-benar mengerjakan). Realtime.
DoD: trigger gate (aturan #1 di §7) tidak bisa dilewati lewat manipulasi API langsung — verifikasi dengan mencoba update langsung via SQL/RPC yang melanggar urutan dan pastikan ditolak. RLS: role `production` bisa update semua step (tidak dibedakan per mesin, karena satu admin yang input).

### M6 — Quality Control
UI: **mobile-responsive** (form dioptimasi untuk HP/tablet, tombol besar, mudah dipakai sambil berdiri/jalan). Antrian inspeksi per step yang sudah `completed`. Form: qty total, qty OK/reject, catatan defect — **tanpa upload foto**. Hasil `pass` → step berikutnya boleh jalan. Hasil `reject` → tombol "Trigger Rework" muncul (panggil RPC khusus, hanya role qc/admin) → step balik ke `rework`/`running`. Riwayat inspeksi (termasuk siklus rework) ditampilkan sebagai timeline dari baris-baris `qc_inspections` per step. **Mode offline:** form yang diisi saat tanpa koneksi disimpan lokal di device (local storage/IndexedDB), otomatis submit begitu koneksi kembali; indikator visual jelas ("Tersimpan lokal, menunggu sinkronisasi").
DoD: `qc_inspections` tidak bisa dibuat untuk step yang belum `completed`; hanya role qc/admin bisa insert & trigger rework; form QC berfungsi normal saat browser offline (submit ke local queue) dan sync otomatis saat online kembali (verifikasi manual dengan matikan network lalu nyalakan lagi).

### M7 — Delivery
UI: list rencana pengiriman + form catat rencana (bukan cetak dokumen) — diisi admin delivery dari kantor berdasarkan laporan driver. Saat form dibuka untuk SO tertentu, `planned_delivery_date` di-prefill dari `MAX(estimated_delivery_date)` seluruh `production_batches` milik SO itu (tetap editable); `planned_ship_date` full manual, tanpa prefill (lihat §11 poin 10). Gantt chart jadwal pengiriman (`gantt-task-react`), toggle Weekly/Monthly, warna per status, merah+label untuk yang lewat rencana.
DoD: tidak ada tombol cetak/export PDF di modul ini; do_number diperlakukan sebagai kode internal saja; delivery tidak bisa keluar draft tanpa dua tanggal rencana terisi (aturan #5); prefill `planned_delivery_date` hanya terjadi sekali saat create, tidak auto-sync ulang kalau `estimated_delivery_date` batch berubah setelahnya.

### M8 — Audit Log & Dashboard
UI: dashboard ringkas (jumlah SO per status, job menunggu material, batch berjalan) dari `v_dashboard_*` views, bukan agregasi client. Halaman admin kelola peran user (buat akun manual, assign role — tidak ada self-signup). Halaman admin lihat `audit_logs` (forensik, admin-only).
DoD: `audit_logs` tidak punya policy INSERT untuk role manapun (hanya lewat trigger security definer); `get_advisors` bersih dari temuan security/performance kritikal; admin bisa buat user baru + assign role dari UI (tidak perlu akses Supabase Dashboard langsung).

## 10. Non-Functional Requirements

- **Testing**: unit test logika bisnis; pgTAP untuk setiap tabel baru (satu test per peran, akses diizinkan DAN ditolak); test dijalankan terhadap Supabase lokal, bukan produksi.
- **Error handling**: error Postgres dipetakan ke pesan manusia (`23505`→nomor dokumen dipakai, `23503`→data terkait tidak ditemukan); hasil kosong akibat RLS ditangani eksplisit, dibedakan dari "data memang tidak ada".
- **Performa**: index di semua FK, kolom predikat RLS, kolom status yang difilter; pagination wajib di semua tabel transaksi; agregasi dashboard lewat view, bukan client.
- **Offline (khusus QC)**: form inspeksi harus tetap bisa disubmit saat browser/device offline, disimpan di local queue, auto-sync saat online. Scope terbatas submit-only — tidak perlu caching data untuk browsing offline.
- **Device/responsive**: modul QC wajib mobile-responsive (dipakai di HP/tablet sambil berdiri). Modul lain (Sales, Engineering, Material, Production Planning, Production, Delivery, Admin) dioptimasi untuk desktop/laptop, tidak wajib mobile-first.
- **Dokumentasi per fitur**: setiap fitur baru mencantumkan business rule, dampak DB, dampak RLS, dampak UI, acceptance criteria — sebelum kode ditulis.

## 11. Asumsi & Keputusan — Status Final Setelah Sesi Refinement

Semua poin di bawah sudah dikonfirmasi eksplisit oleh product owner lewat sesi interview mendalam. Catatan: beberapa keputusan di draft sebelumnya (v2) **dibalik lagi** setelah root-cause operasional digali lebih dalam (lihat kolom "Riwayat" untuk yang berubah dua kali).

| # | Keputusan | Status | Riwayat |
|---|---|---|---|
| 1 | Sistem single-tenant (tidak ada `org_id`) | **✓ Final** | Tidak berubah sejak v2. |
| 2 | Routing tahapan produksi fleksibel per-batch (bukan master data global, bukan fixed-skip-only) | **✓ Final** | Tidak berubah sejak v2. |
| 3 | Role Production: **SATU role `production`**, dioperasikan admin, operator dicatat di master data `operators` tanpa login | **✓ Final** | **Dibalik dari v2** — sempat diputuskan "5 role per-stasiun" sebelum diketahui bahwa operator mesin sebenarnya tidak pegang device sendiri, cuma satu admin yang input dari laptop/PC. |
| 4 | QC per-tahapan (bukan per-batch) | **✓ Final** | Tidak berubah sejak v2. |
| 5 | QC rework via tombol "Trigger Rework" formal (RPC khusus) | **✓ Final** | Tidak berubah sejak v2. |
| 6 | Engineering Workload dashboard terbuka semua peran | **✓ Final** | Tidak berubah sejak v2. |
| 7 | Kanban Production: **satu tampilan Per-Batch saja** (bukan dua: Per-Batch + Per-Stasiun), drag-and-drop | **✓ Final** | **Disederhanakan dari v2** — Kanban "Per-Stasiun" dihapus karena didesain untuk operator mesin yang ternyata tidak login. Drag-and-drop tetap dipakai, tapi alasannya beda: bukan meski gloves-challenge, tapi karena inputnya mouse (admin, laptop). |
| 8 | Estimasi durasi produksi manual, tanpa master cycle-time | **✓ Final** | Tidak berubah sejak v2. |
| 9 | Delivery manual, tanpa integrasi finance, tanpa app driver | **✓ Final** | Tidak berubah sejak v2. |
| 10 | `deliveries.planned_delivery_date` di-**prefill** dari `MAX(estimated_delivery_date)` seluruh `production_batches` milik SO tersebut saat delivery record dibuat, tapi tetap editable oleh admin delivery. One-time prefill saat create, TIDAK auto-sync berkelanjutan kalau `estimated_delivery_date` batch berubah setelahnya. `planned_ship_date` tetap full manual, tanpa prefill. | **✓ Final** | **Dibalik dari v2** — sebelumnya "tidak auto-fill sama sekali". Setelah digali: tidak ada insiden spesifik, driver selalu ikut plan, yang sering berubah justru plan-nya sendiri (replanning) — jadi prefill aman karena cuma nilai awal yang tetap bisa diedit, bukan keputusan terkunci. |
| 11 | **BARU** — QC mobile + offline submit-only, tanpa foto | **✓ Final** | Ditemukan lewat interview: QC keliling shop floor, ada blank spot WiFi, dan foto dihapus untuk hemat storage. |
| 12 | **BARU** — Engineering tidak simpan drawing (`drawing_url` dihapus) | **✓ Final** | Ditemukan lewat interview. |
| 13 | **BARU** — User account dibuat manual oleh admin, tidak ada self-signup | **✓ Final** | Ditemukan lewat interview. |
| 14 | **BARU** — Master data `operators` dikelola oleh Production Planning | **✓ Final** | Ditemukan lewat interview. |
| 15 | **BARU** — Dua sistem audit (`audit_logs` + tabel `*_history`) dipertahankan sengaja, bukan duplikasi tak sengaja | **✓ Final** | Ditemukan lewat audit langsung ke migration lokal (lihat §6.2). |
| 16 | **BARU** — `sales_order_assignments` + `notifications` adalah fitur resmi (routing notifikasi in-app berbasis PIC per role) | **✓ Final** | Ditemukan lewat audit langsung ke migration lokal. |

**Catatan proses:** poin #3 dan #7 adalah contoh kenapa interview operasional penting — keputusan awal (role per-stasiun, drag-drop karena "meski challenging") terdengar masuk akal di atas kertas, tapi salah begitu ditelusuri siapa yang benar-benar pegang device di lapangan. Kalau ada modul lain yang perilakunya diasumsikan dari device/pengguna yang "masuk akal secara teori", pola ini harus diulang: tanya langsung siapa yang pegang device dan bagaimana caranya, jangan asumsi dari nama role.

## 12. Urutan Implementasi

M0 (Foundation: auth manual oleh admin, roles, layout) → M1 (Sales Order + Notifikasi) → M2 (Engineering) → M3 (Material) → M4 (Production Planning + master data Operators) → M5 (Production Execution) → M6 (QC + offline support) → M7 (Delivery) → M8 (Audit & Dashboard).

Setiap milestone: migration → generate types → `get_advisors` → pgTAP RLS test → UI → commit. Jangan mulai milestone berikutnya sebelum DoD milestone saat ini terpenuhi.

**Catatan implementasi:** Supabase project untuk DSM MOS (`jtzwawtfymljfqfrplib`) belum terhubung ke tooling — sebelum M0 dimulai, pastikan koneksi MCP/CLI Supabase mengarah ke project yang benar (bukan project lain yang mungkin masih tersambung dari sesi kerja sebelumnya). Migration lokal yang sudah ada di `supabase/migrations/` perlu ditinjau ulang terhadap PRD versi ini (banyak yang perlu direvisi: hapus `drawing_url`, hapus `photo_urls`, ubah relasi `qc_inspections` ke per-step, tambah tabel `operators`, dst) sebelum di-deploy — jangan langsung `db push` migration lama tanpa audit.
