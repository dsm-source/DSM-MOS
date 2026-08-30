# DSM MOS Full Smoke Retest Report - Round 2

Tanggal: 2026-08-30  
Scope: local Supabase stack only. Remote project `jtzwawtfymljfqfrplib` tidak disentuh.  
Report baseline: `tasks/codex-full-smoke-test-report.md`  
Artifact: `tasks/codex-full-smoke-retest-artifacts/`

## 1. Verdict

**FAIL, tetapi naik dibanding run 1.**

Alasan: BUG-1 dashboard spinner sudah tertutup di browser, dan beberapa area yang sebelumnya PASS_PARTIAL naik menjadi PASS penuh (Engineering, Material, Operator CRUD, QC core, Delivery detail transition). Namun sertifikasi full E2E masih belum layak karena masih ada gap/failure pada drag-and-drop Production, create batch Production Planning via UI, create Delivery via UI/RLS path, viewer route guard `/sales-orders/new`, dan generic error-state beberapa list.

## 2. Ringkasan Setup

- Commit diuji: `2d86698 fix(dashboard): surface error state on stalled stat queries`.
- Reset: `supabase db reset --local` berhasil.
- Seed demo: `supabase/seed-demo/20260823_demo_200_dataset.sql` via local container `psql`.
- Fixture tambahan: local-only `RETEST-` rows untuk 6 SO, 4 production batch, 1 operator baseline, 1 customer, 9 role/login users termasuk 1 `engineering` PIC, 1 QC rejectable, 1 delivery-ready QC pass, dan 1 delivery draft untuk detail transition.
- Data setelah seed + fixture: 206 SO, 166 engineering jobs, 164 material rows, 144 production batches, 707 production steps, 503 QC inspections, 50 baseline deliveries sebelum delivery transition fixture.
- `supabase status`: core API/DB usable; CLI melaporkan imgproxy/pooler stopped, tidak memblokir app smoke.
- `supabase test db`: PASS, 10 files, 256 tests.
- `bunx tsc --noEmit`: PASS.
- `bun run lint`: PASS exit 0, 37 warning `react-refresh/only-export-components`.
- `bun run build`: PASS exit 0, tetapi BUG-3 masih ada: client chunk `index-BKt29aup.js` 519.30 kB dan warning chunk > 500 kB.
- Cleanup akhir: semua `RETEST-` sales orders, production batches, operators, customers, dan local auth users = 0. Final `supabase test db`: PASS, 256/256.

## 3. Regression BUG-1

**PASS.**

- Dashboard normal cocok dengan query manual:
  - `v_dashboard_so_status`: draft 40, confirmed 146, completed 20.
  - `v_dashboard_material_waiting`: 22.
  - `v_dashboard_production_running`: 1.
- Saat `/rest/v1/v_dashboard_so_status*` digantung, dashboard berubah dari loading ke error state dalam **22.17 detik**.
- Error state menampilkan alert `Gagal memuat ringkasan dashboard`, kartu SO memakai `-`, dan chart menampilkan `Gagal memuat distribusi Sales Order`.
- Tombol `Coba lagi` terlihat; saat request masih diblokir halaman tetap error, setelah unblock dan klik retry data pulih tanpa reload.
- Screenshot:
  - `tasks/codex-full-smoke-retest-artifacts/bug1-dashboard-loading-blocked.png`
  - `tasks/codex-full-smoke-retest-artifacts/bug1-dashboard-error-blocked.png`
  - `tasks/codex-full-smoke-retest-artifacts/bug1-dashboard-recovered.png`

Catatan kecil: automation tidak berhasil menangkap state disabled tombol retry saat fetching (`disabledDuring=false`), tetapi kriteria utama "tidak stuck Memuat" dan recovery tanpa reload sudah terbukti.

## 4. Status BUG-2 & BUG-3

- **BUG-2 masih ada (minor):** user baru dibuat via `/admin`, first login redirect ke `/change-password`, flag `must_change_password` berubah false, lalu redirect ke `/auth`. Namun request `auth/v1/logout?scope=global` tetap 403 dan console merah tetap muncul. Bukti: `tasks/codex-full-smoke-retest-artifacts/bug2-result.json`.
- **BUG-3 masih ada (minor):** build masih warning chunk > 500 kB; chunk terbesar client `index-BKt29aup.js` 519.30 kB.

## 5. Matriks Area

| Area | Status | Bukti singkat |
|---|---|---|
| A. BUG-1 dashboard | PASS | Error state muncul 22.17 detik, retry pulih setelah unblock. Naik dari FAIL run 1. |
| B. BUG-2 forced password | FAIL_OPEN | Masih 403 logout global + console error setelah password change. |
| B. BUG-3 bundle size | FAIL_OPEN | Build PASS tapi warning chunk >500 kB masih ada. |
| Engineering | PASS | UI/DB: Draft -> In Progress -> Review -> Approved; progress clamp 150 -> 100; history terisi. Gate illegal `draft -> approved` ditolak DB dengan pesan transisi tidak diperbolehkan. Naik dari PASS_PARTIAL. |
| Material | PASS | UI: `waiting_material -> material_ready`; DB: 1 row per job; history `waiting_material -> material_ready`. Naik dari PASS_PARTIAL. |
| Operators | PASS | UI create + edit operator: `RETEST Operator UI Edited`, DB tersimpan. Naik dari PASS_PARTIAL. |
| Production Planning | FAIL/PARTIAL | Dropdown approved/material-ready terbukti berisi fixture; routing-aware DB fixture menghasilkan subset `laser_cutting,assembly`, bukan 5 step. UI create batch timeout pada tombol `Buat Batch`, jadi flow create via UI belum tertutup. |
| Production Execution | FAIL/PARTIAL | StepOperatorDialog PASS: `Mulai` disabled sebelum operator, enabled setelah pilih operator, DB `operator_id` tersimpan. Complete fallback membuat step completed dan auto-enqueue QC. Rework start ulang PASS. Drag-and-drop tidak terbukti: drag handle tidak ditemukan/dieksekusi pada automation. |
| QC | PASS | Queue aktif dan history 90 hari/limit 300 terbaca; date range refetch dicoba. Validasi `OK + Tolak > Total` ditolak; `waiting -> inspection -> reject`; `Trigger Rework` muncul di dialog reject dan menghasilkan QC/step `rework` via coupled audit updates. Naik dari PASS_PARTIAL. |
| Delivery | FAIL/PARTIAL | Detail transition PASS: draft -> prepared -> shipped -> delivered via UI, SO auto-completed. Create delivery dari ready-QC via UI tidak tertutup karena selector/filter timeout; direct insert as role `delivery` juga ditolak RLS. |
| Dashboard | PASS | Normal counts cocok query manual; BUG-1 regression PASS. |
| Admin & Audit | PASS/PARTIAL | `/admin` render list user, create user via UI berhasil, BUG-2 user role viewer tersimpan; audit log 100 terbaru tampil. Assign/unassign role full re-login tidak diulang tuntas. |
| Notification | PASS/PARTIAL | Bell badge tampil dan previous run membuktikan mark-read; round 2 tidak menjalankan full realtime notification cycle ulang. |
| Cross-cutting | FAIL/PARTIAL | Dark mode 5 halaman dan mobile 375px tanpa overflow; empty-state SO/Production/QC/Delivery PASS. Generic error-state Sales/Material/QC lemah: request abort menghasilkan kosong tanpa error notice jelas. |

## 6. RBAC Matrix

Legend: `T` terlihat/diizinkan, `-` tidak terlihat/ditolak, `LEAK` route guard bocor.

| Role | Dashboard | Sales Order | Pelanggan | Eng Job | Workload | Bahan | Planning | Operator | Produksi | QC | Pengiriman | Jadwal | Admin |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| admin | T | T | T | T | T | T | T | T | T | T | T | T | T |
| sales | T | T | T | T | T | - | - | - | - | - | - | - | - |
| qc | T | - | - | T | T | - | - | - | - | T | - | - | - |
| production | T | - | - | T | T | - | - | - | T | - | - | - | - |
| production_planning | T | - | - | T | T | - | T | T | - | - | - | - | - |
| material | T | - | - | T | T | T | - | - | - | - | - | - | - |
| delivery | T | - | - | T | T | - | - | - | - | - | T | T | - |
| viewer | T | T | - | T | T | T | - | - | T | T | T | T | - |

Guard checks:
- `sales -> /admin`: redirected to `/dashboard`.
- `qc -> /production-planning`: redirected to `/dashboard`.
- `viewer -> /sales-orders/new`: **LEAK**, route opened instead of redirect/deny.

Catatan: raw string capture sidebar mengandung heading grup seperti "Penjualan" dan "Produksi", sehingga matrix di atas dinormalisasi terhadap expected route/menu behavior dan guard checks.

## 7. Bug List Baru / Masih Terbuka

### BUG-1 - Closed

- Severity: major, now closed.
- Modul: Dashboard `/dashboard`.
- Aktual round 2: stalled SO status request times out to visible error in 22.17s and recovers after unblock/retry.
- Screenshot: `bug1-dashboard-error-blocked.png`, `bug1-dashboard-recovered.png`.

### BUG-2 - Still Open

- Severity: minor.
- Modul: Auth `/change-password`.
- Repro: create user via `/admin`, login pertama, submit password baru.
- Aktual: flow berhasil, tetapi `auth/v1/logout?scope=global` 403 dan console error merah.
- Harapan: logout local/session cleanup tidak menghasilkan 403/console error.
- Screenshot: `bug2-after-change-password-2.png`.

### BUG-3 - Still Open

- Severity: minor.
- Modul: Build/performance.
- Repro: `bun run build`.
- Aktual: warning chunk >500 kB; client `index-BKt29aup.js` 519.30 kB.
- Harapan: chunk utama di bawah threshold atau code-splitting intentional.

### BUG-4 - Viewer Route Guard Leak

- Severity: major.
- Modul: Sales Order `/sales-orders/new`.
- Repro: login `viewer`, buka langsung `/sales-orders/new`.
- Aktual: URL tetap `/sales-orders/new`.
- Harapan: viewer ditolak/redirect atau form benar-benar read-only inaccessible.
- Bukti: `rbac-results.json`, `guards.viewer_new_so`.

### BUG-5 - Generic List Error State Missing

- Severity: major.
- Modul: `/sales-orders`, `/material`, `/qc`.
- Repro: block/abort REST request table utama lalu buka halaman.
- Aktual: UI menjadi kosong/0 data tanpa error notice jelas; console menampilkan `net::ERR_FAILED`.
- Harapan: error notice jelas + retry, bukan silent empty state.
- Bukti: `errorstate-result.json`, `errorstate-sales-orders.png`, `errorstate-material.png`, `errorstate-qc.png`.

### BUG-6 - Production Drag-and-Drop Not Proved / Unstable

- Severity: major for certification.
- Modul: `/production`.
- Repro: buka fixture running batch `RETEST-PROD-DRAG`, coba cari/drag handle ke next column.
- Aktual: automation tidak menemukan handle pada state retest; fallback `Complete` berhasil, tapi DnD wajib tidak terbukti.
- Harapan: drag handle accessible/stable and drag-to-next-step flow can be verified.
- Bukti: `production-ui-result.json`, `production-complete-result.json`.

### BUG-7 - Production Planning Create Batch UI Not Closed

- Severity: major for certification.
- Modul: `/production-planning`.
- Repro: pilih approved/material-ready engineering job lalu klik `Buat Batch`.
- Aktual: dropdown options ada, tetapi automation timeout pada click `Buat Batch`; no UI-created batch.
- Harapan: dialog/form create batch terbuka dan dapat memilih subset routing.
- Bukti: `planning-ui-result.json`, `production-planning-routing-ui-2.png`.

### BUG-8 - Delivery Create Path Not Closed

- Severity: major for certification.
- Modul: `/delivery`.
- Repro: use ready-QC SO fixture, create delivery.
- Aktual: UI create dialog/filter automation tidak selesai; direct local RLS insert as role `delivery` ditolak pada table `deliveries`.
- Harapan: role delivery/admin dapat membuat draft delivery dari ready-QC SO lewat UI/server path.
- Bukti: delivery create attempt logs; detail transition fixture seeded by postgres and UI transition then passed.

## 8. Saran Perbaikan

### UX / Flow

- Dampak tinggi, effort sedang: beri filter/search khusus pada board Engineering dan Material agar fixture/record target cepat ditemukan saat data banyak.
- Dampak tinggi, effort sedang: expose production drag handle dengan accessible label/test id yang stabil, dan tampilkan affordance DnD yang jelas.
- Dampak sedang, effort rendah: Delivery create dialog perlu empty/loading/error state yang lebih eksplisit untuk candidate SO.

### Konsistensi Visual

- Dampak sedang, effort rendah: status pill sudah cukup konsisten dari unified system, tetapi board Material masih memakai dot/status card styling berbeda dari `StatusPill`; pertimbangkan komponen status yang sama.

### Performa

- Dampak sedang, effort sedang: lanjutkan BUG-3 code-splitting; `jspdf`, `html2canvas`, dan router/main chunk terlihat kandidat lazy-load.

### Aksesibilitas

- Dampak tinggi, effort rendah-sedang: tambahkan label/test id untuk icon-only/role button interaktif (DnD handle, select triggers, batch cards) supaya keyboard/screen-reader dan automation lebih stabil.
- Dampak sedang, effort rendah: pastikan semua dialog punya first focus ke field utama dan Esc close tetap konsisten. Create User/QC/Delivery PASS dasar.

### Tech Debt / Kode

- Dampak tinggi, effort sedang: standardisasi error boundary/query error UI untuk semua list board, mengikuti pola dashboard `withTimeout` + alert + retry.
- Dampak sedang, effort rendah: dokumentasikan fixture smoke kecil atau buat script local-only agar retest E2E tidak bergantung pada manual SQL ad hoc.

Carry-over run 1 yang belum ditindaklanjuti: BUG-2, BUG-3, DnD/realtime full proof, offline queue full sync, dan broad generic error-state.

## 9. Kesimpulan

Aplikasi **lebih siap untuk demo terbatas** dibanding run 1 karena BUG-1 tertutup dan core Engineering/Material/QC/Delivery detail jauh lebih terbukti.

Namun aplikasi **belum layak disertifikasi stabil untuk UAT/produksi penuh**. Follow-up owner yang perlu keputusan:

1. Apakah BUG-4 viewer guard leak harus diblokir sebelum demo.
2. Apakah create batch planning dan create delivery wajib dibuktikan lewat UI sebelum sign-off.
3. Apakah DnD Production adalah requirement demo, atau tombol `Complete` boleh menjadi fallback sementara.
4. Apakah BUG-2 console 403 dianggap tolerable di demo internal.
5. Apakah generic error-state selain dashboard masuk scope fix berikutnya.

## 10. Cleanup

- Cleanup SQL menghapus:
  - `sales_orders.notes LIKE 'RETEST-%'`: 0 tersisa.
  - `production_batches.notes LIKE 'RETEST-%'`: 0 tersisa.
  - `operators.employee_number LIKE 'RETEST-%'`: 0 tersisa.
  - `customers.code LIKE 'RETEST-%'`: 0 tersisa.
  - local auth `test@dsm.com` dan `retest-%@dsm.local`: 0 tersisa.
- Final `supabase test db`: PASS, 10 files, 256 tests.
