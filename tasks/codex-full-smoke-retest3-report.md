# Codex Full Smoke Retest DSM MOS - Ronde 3

Tanggal: 2026-08-30 13:56-14:25 WIB  
Target: local Supabase stack only. Remote `jtzwawtfymljfqfrplib` tidak dimutasi.  
HEAD diuji: `bd3e6a2` (`07d0572` ada di commit kedua, `2d86698` di commit ketiga).

## 1. Verdict

**FAIL**

Dibanding ronde 2, hasil membaik: BUG-1, BUG-3, BUG-4, BUG-5, BUG-7, dan jalur QC/rework utama sekarang terbukti membaik/tertutup. Namun ronde 3 masih belum layak PASS karena:

- **BUG-2 masih partial/open**: first-login password change sukses sampai login ulang, tetapi tetap ada `auth/v1/logout?scope=local` HTTP 403 dan console error merah.
- **BUG-8 masih open/major**: role delivery bisa membuat draft delivery, tetapi tidak bisa melihat QC pass item yang eligible karena query eligibility membutuhkan join ke `engineering_jobs`, sementara RLS `engineering_jobs` tidak memberi SELECT untuk role `delivery`. Akibatnya delivery item tidak bisa ditambah dan transisi draft -> prepared ditolak.
- **BUG-6 DnD belum terbukti**: pointer drag attempt tidak memindahkan kartu. Fallback button flow berhasil membuktikan gate QC dan operator dialog, tetapi bukan drag/drop itu sendiri.
- **RBAC/sidebar matrix masih mismatch** terhadap tabel prompt untuk beberapa role.
- **Console noise minor**: dev server menangkap beberapa `ResizeObserver loop completed with undelivered notifications` saat flow UI/Gantt berjalan.

## 2. Ringkasan Setup

- `git log --oneline -3`: `bd3e6a2`, `07d0572`, `2d86698` terkonfirmasi.
- `supabase db reset`: PASS, migration M0-M8 teraplikasi.
- Seed: `supabase/seed-demo/20260823_demo_200_dataset.sql` via local container `psql`.
- Fixture tambahan: dibuat via SQL lokal dengan prefix `RETEST3-*`, termasuk 10 local auth users, 6 SO, 4 production batches, QC pass/reject/rework candidates, dan operator test. Semua fixture sudah dibersihkan di akhir.
- Dev server: `bun run dev --host 127.0.0.1 --port 8080`; port 8080 terpakai, Vite fallback ke `http://127.0.0.1:8081/`.
- `supabase status`: local API/DB/Auth/Studio healthy enough for test; CLI melaporkan imgproxy dan pooler stopped.

Quality gates:

| Gate | Hasil |
|---|---|
| `supabase test db` sebelum browser | PASS, Files=10, Tests=256 |
| `bunx tsc --noEmit` | PASS |
| `bun run lint` | PASS exit 0, 37 warning `react-refresh/only-export-components` |
| `bun run build` | PASS exit 0 |
| `supabase test db` setelah cleanup | PASS, Files=10, Tests=256 |

Build chunk evidence:

- Client chunk terbesar: `.output/public/assets/jspdf.es.min-Cy2KiBcY.js` 399.19 kB, gzip 129.64 kB.
- Tidak ada warning client chunk >500 kB.
- Masih ada warning Nitro/server: `inlineDynamicImports option is ignored...` dan `manualChunks option is ignored...`.
- Server chunk terbesar: `.output/server/_libs/@tanstack/react-router+[...].mjs` 647.28 kB, gzip 136.43 kB. Ini bukan client chunk target BUG-3.

## 3. Status BUG-1..8

| ID | Ronde 2 | Ronde 3 | Bukti |
|---|---|---|---|
| BUG-1 dashboard stalled stat | CLOSED | CLOSED | Blocking `v_dashboard_so_status` memunculkan error + `Coba lagi` dalam 21.50s, unblock+retry recover. Screenshot: `tasks/codex-full-smoke-retest3-artifacts/bug1-dashboard-blocked.png`. |
| BUG-2 change-password logout 403 | OPEN | PARTIAL/OPEN | User dibuat via `/admin`; first login -> `/change-password`; ganti password -> `/auth`; login ulang -> `/dashboard`. Tidak ada `scope=global`, tetapi ada `auth/v1/logout?scope=local` 403 + console error. |
| BUG-3 client chunk >500k | OPEN | CLOSED | Client chunk terbesar 399.19 kB gzip 129.64 kB, tanpa warning client >500 kB. |
| BUG-4 viewer SO create/edit guard | OPEN | CLOSED | Viewer direct `/sales-orders/new` dan `/sales-orders/{id}/edit` redirect ke `/sales-orders?page=1&status=all&q=`. Sales/admin tetap bisa buka `/sales-orders/new`. |
| BUG-5 list error state | OPEN | CLOSED dengan catatan | `/sales-orders`, `/material`, `/qc` queue/history menampilkan `Gagal memuat...` + `Coba lagi` sekitar 15.7-15.9s dan recover setelah unblock. Console memuat error network yang sengaja dipicu oleh route abort. |
| BUG-6 production DnD | GAP | PARTIAL/OPEN | Mouse drag dari handle/card ke kolom Assembly tidak memindahkan kartu. Fallback tombol membuktikan Complete, QC gate, dan operator dialog wajib operator, tetapi DnD belum proven. |
| BUG-7 create batch UI | GAP | CLOSED | UI `/production-planning` berhasil pilih `ENG-2026-000161 · RETEST3 Planning Item`, routing subset Laser Cutting + Assembly, DB membuat tepat 2 step. |
| BUG-8 create delivery UI | GAP | PARTIAL/OPEN | UI `/delivery` berhasil membuat `DLV-2026-000054` draft dari `RETEST3-DELIVERY-READY`, tetapi detail tidak menampilkan QC pass item; transisi prepared gagal karena delivery belum punya item. |

## 4. Detail Retest Utama

### BUG-2 - Change Password

Repro:

1. Login admin local.
2. `/admin` -> `Buat User Baru`, role viewer.
3. Login user temp.
4. Redirect ke `/change-password`.
5. Submit password baru.
6. Login ulang dengan password baru.

Aktual:

- Redirect first login benar: `/change-password`.
- Setelah submit password baru, user diarahkan ke `/auth`.
- Login ulang berhasil ke `/dashboard`.
- Browser event masih mencatat HTTP 403 pada `http://127.0.0.1:54321/auth/v1/logout?scope=local`.
- Console error merah: `Failed to load resource: the server responded with a status of 403 (Forbidden)`.

Harapan:

- Tidak ada `logout?scope=global`.
- Tidak ada logout 403.
- Tidak ada console error merah.

Severity: **major** karena flow user selesai, tetapi kriteria retest eksplisit gagal dan console tetap merah.

### BUG-4 - Viewer Guard

Aktual:

- Viewer direct `/sales-orders/new` -> `/sales-orders?page=1&status=all&q=`.
- Viewer direct `/sales-orders/53000000-0000-0000-0000-000000000001/edit` -> `/sales-orders?page=1&status=all&q=`.
- Sales dan admin tetap dapat membuka `/sales-orders/new`.

Status: **CLOSED**.

### BUG-5 - Error State

Metode: Playwright route abort terhadap REST utama lalu reload halaman, klik retry saat masih blocked, lalu unblock + retry.

| Route | Request diblok | Error seen | Waktu | Recovery |
|---|---|---:|---:|---|
| `/sales-orders` | `/rest/v1/sales_orders` | Ya | 15.95s | Ya |
| `/material` | `/rest/v1/material_statuses` | Ya | 15.95s | Ya |
| `/qc` Antrian | `/rest/v1/qc_inspections` | Ya | 15.93s | Ya |
| `/qc` Riwayat | `/rest/v1/qc_inspections` | Ya | 15.75s | Ya |

Catatan: selama request sengaja diblok, console memang mencatat `net::ERR_FAILED`; itu expected dari metode test. Screenshot:

- `tasks/codex-full-smoke-retest3-artifacts/bug5-sales-orders-blocked.png`
- `tasks/codex-full-smoke-retest3-artifacts/bug5-material-blocked.png`
- `tasks/codex-full-smoke-retest3-artifacts/bug5-qc-queue-blocked.png`
- `tasks/codex-full-smoke-retest3-artifacts/bug5-qc-history-blocked.png`

Status: **CLOSED**.

### BUG-6 - Production DnD / Operator Dialog / Rework

Attempt DnD:

- Page `/production`, role `production`.
- Fixture: `RETEST3-PROD-DRAG-BATCH`, routing Laser Cutting -> Assembly.
- Attempt 1: mouse center source card/handle to Assembly column. Result: kartu tetap di Laser Cutting; DB tetap step 1 `running`.
- Screenshot: `tasks/codex-full-smoke-retest3-artifacts/bug6-production-dnd.png`.

Fallback evidence:

- Klik `Complete` pada Laser Cutting berhasil; DB: step 1 `completed`.
- Attempt start Assembly sebelum QC pass ditolak oleh DB/API 400 dengan pesan: `Tidak bisa mulai: menunggu QC pass tahapan sebelumnya (Laser Cutting)`.
- QC pass untuk Laser Cutting berhasil lewat UI.
- Setelah QC pass, start Assembly membuka operator dialog.
- Submit disabled sebelum operator dipilih: `true`.
- Submit enabled setelah pilih `RETEST3 Operator B`: `false`.
- DB final sebelum cleanup: `laser_cutting:completed:RETEST3-OP-A`, `assembly:running:RETEST3-OP-B`.

Status: **PARTIAL/OPEN**. Functional button/gate/operator path valid, tetapi drag/drop requirement belum terbukti.

### BUG-7 - Create Batch UI

Repro:

1. Login `production_planning`.
2. `/production-planning`.
3. Combobox pilih `ENG-2026-000161 · RETEST3 Planning Item`.
4. Isi qty 4, tanggal 2026-08-31 -> 2026-09-02, estimasi kirim 2026-09-05.
5. Routing subset: Laser Cutting + Assembly.
6. Simpan.

Aktual:

- UI menutup dialog dan Gantt menampilkan batch baru.
- DB: `ENG-2026-000161-B1`, notes `RETEST3-UI-CREATE-BATCH`, routing `[laser_cutting, assembly]`, step tepat 2: `laser_cutting:waiting`, `assembly:waiting`.

Status: **CLOSED**. Screenshot: `tasks/codex-full-smoke-retest3-artifacts/bug7-planning-create-final.png`.

### BUG-8 - Create Delivery UI

Repro:

1. Fixture SO `RETEST3-DELIVERY-READY` memiliki QC pass terakhir, status SO diset `quality_control`.
2. Login role `delivery`.
3. `/delivery` -> `Rencana Baru`.
4. Pilih SO `RETEST3-DELIVERY-READY · RETEST3 Customer`, isi jadwal/driver/vehicle/notes.
5. Submit.

Aktual:

- Delivery draft berhasil dibuat: `DLV-2026-000054`, status `draft`.
- Detail `/delivery/fae7fdee-7882-4d10-bc7a-369f93468d87` terbuka.
- Dropdown `Pilih hasil QC (Lulus)` kosong dan menampilkan `Tidak ada hasil QC lulus yang tersedia.`
- DB membuktikan QC pass eligible ada: `423092d6-3cc6-46f2-94d8-2603b94ceedb`, `qty_ok=7`, final step sequence 1, belum dipakai delivery item.
- Query sebagai role delivery terhadap join QC -> production step -> production batch -> engineering job -> SO mengembalikan 0 row.
- Root cause evidence dari policies: `engineering_jobs` SELECT policy tidak menyertakan role `delivery`, padahal eligibility query memakai inner join ke `engineering_jobs`.
- Klik `→ Disiapkan` gagal HTTP 400 dan UI menampilkan `Pengiriman belum memiliki item.`

Harapan:

- Role delivery dapat melihat QC pass item yang eligible untuk SO yang dipilih.
- Delivery item bisa ditambah.
- Status draft -> prepared -> shipped -> delivered bisa berjalan setelah item valid.

Severity: **major**. Screenshot:

- `tasks/codex-full-smoke-retest3-artifacts/bug8-delivery-create-final.png`
- `tasks/codex-full-smoke-retest3-artifacts/delivery-transition-no-item.png`

## 5. Quick Regression

| Area | Hasil |
|---|---|
| Dashboard count | PASS untuk SO dan production. `v_dashboard_so_status` = manual: completed 20, confirmed 146, draft 40. `v_dashboard_production_running` = manual running step 1. Material view setelah re-query = 22, manual exact `waiting_material` = 22. |
| Engineering | PASS. Draft guard menolak transisi tanpa PIC/target; setelah assign PIC + target, Draft -> In Progress -> Review -> Approved; progress final 100; history terisi. |
| Material | PASS. `RETEST3-MATERIAL-FLOW` berhasil waiting -> material_ready lewat UI; history/update toast muncul. |
| QC validation | PASS. Dialog menolak `qty_ok + qty_reject > qty_total`; pesan invalid terlihat. |
| QC reject/rework | PASS dengan catatan UX. Reject berhasil; tombol `Trigger Rework` muncul setelah reopen/refetch dialog pada status reject; klik mengubah QC dan production step ke `rework`. |
| Production QC gate | PASS. Assembly tidak bisa mulai sebelum QC pass step sebelumnya; pesan spesifik dari DB terbukti. |
| Production realtime 2 tab | SKIP ronde 3. Fokus waktu dipakai untuk DnD/operator/gate; perlu retest manual tambahan jika DnD fix dikejar. |
| Delivery list default | PASS ringan. `/delivery` default tombol filter `Aktif (belum selesai)` dan list aktif tampil; create detail gagal lanjut karena BUG-8. |
| Mobile/dark smoke | PASS ringan. `/sales-orders` pada viewport 375px menampilkan sidebar toggle dan layout mobile/list; toggle theme tidak menghasilkan console error. Screenshot: `tasks/codex-full-smoke-retest3-artifacts/cross-mobile-sales-orders.png`. |
| Console/network | PASS untuk flow yang tidak sengaja diblok, kecuali BUG-2 logout 403, BUG-6 expected 400 gate, BUG-8 400 karena no item, dan beberapa `ResizeObserver loop completed with undelivered notifications` dari log Vite/dev runtime. |
| Admin audit log | PASS via DB. Setelah test berjalan, `audit_logs_recent` > 5000 entri; admin page terbuka saat create user. |
| Cleanup | PASS. Post-cleanup users=0, sales_orders=0, batches=0, deliveries=0 untuk prefix RETEST3/temp; pgTAP final 256/256 PASS. |

## 6. RBAC Matrix

Matrix ini adalah **sidebar visibility**, dibandingkan tabel akses di prompt. `OK` = sesuai prompt, `LEAK` = terlihat padahal prompt tidak mengizinkan, `MISS` = tidak terlihat padahal prompt mengizinkan.

| Role | Dashboard | SO | Customers | Eng | Workload | Material | Planning | Operator | Production | QC | Delivery | Schedule | Admin |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| admin | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| sales | OK | OK | OK | OK | OK | OK | OK | OK | **LEAK** | OK | OK | OK | OK |
| engineering | OK | **LEAK** | OK | OK | OK | OK | OK | OK | **LEAK** | OK | OK | OK | OK |
| material | OK | **LEAK** | OK | OK | OK | OK | OK | OK | **LEAK** | OK | OK | OK | OK |
| production_planning | OK | **LEAK** | OK | OK | OK | OK | OK | OK | **LEAK** | OK | OK | OK | OK |
| production | OK | **LEAK** | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| qc | OK | **LEAK** | OK | OK | OK | OK | OK | OK | **LEAK** | OK | **LEAK** | OK | OK |
| delivery | OK | **LEAK** | OK | OK | OK | OK | OK | OK | **LEAK** | **LEAK** | OK | OK | OK |
| viewer | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |

Observed raw visibility:

- Many non-sales roles see `Sales Order`.
- Many non-production roles see `Produksi`.
- `qc` sees `Pengiriman`; `delivery` sees `QC`.
- Direct guard spot checks: viewer `/sales-orders/new` and `/$id/edit` closed; qc `/production-planning` redirects to dashboard.

Severity: **minor/major depending owner intent**. If prompt table is strict source-of-truth, sidebar still needs tightening beyond BUG-4.

## 7. New / Still-Open Bugs

### BUG-2R3 - Local logout still returns 403 after forced password change

Severity: **major**  
Route: `/change-password`

Steps:

1. Admin creates new user via `/admin`.
2. User logs in with temp password.
3. User submits new password on `/change-password`.

Actual:

- Flow completes and login ulang works.
- Browser records `auth/v1/logout?scope=local` HTTP 403 and console error merah.

Expected:

- No logout 403 and no console error during successful password change.

Screenshot: `tasks/codex-full-smoke-retest3-artifacts/bug2-admin-page.png`

### BUG-6R3 - Drag/drop production card not proven / did not move card

Severity: **major** for DnD requirement, **minor** for core status fallback because buttons work.
Route: `/production`

Steps:

1. Login role production.
2. Open `/production`.
3. Drag `RETEST3-PROD-DRAG-BATCH` from Laser Cutting to Assembly using mouse coordinates from source to target column.

Actual:

- Card remains in source column; no DB transition from drag attempt.
- Button fallback and gate/operator path can complete the same business state after QC pass.

Expected:

- Drag/drop should complete current step or move to next gated action consistently, with operator/QC gates respected.

Screenshot: `tasks/codex-full-smoke-retest3-artifacts/bug6-production-dnd.png`

### BUG-8R3 - Delivery role cannot add eligible QC pass item

Severity: **major**  
Route: `/delivery/$id`

Steps:

1. Create delivery draft from SO that has QC pass final step.
2. Open delivery detail as role delivery.
3. Open `Pilih hasil QC (Lulus)`.

Actual:

- Dropdown empty: `Tidak ada hasil QC lulus yang tersedia.`
- Role delivery query over eligibility join returns 0 rows.
- Policy evidence: `engineering_jobs` SELECT policy excludes `delivery`, while delivery eligibility query inner-joins through `engineering_jobs`.
- Prepared transition fails: `Pengiriman belum memiliki item.`

Expected:

- Delivery role can see eligible QC pass rows for the selected SO, add delivery item, then progress delivery status.

Screenshot: `tasks/codex-full-smoke-retest3-artifacts/delivery-transition-no-item.png`

### BUG-9R3 - ResizeObserver runtime noise on complex UI

Severity: **minor**  
Route: observed during Gantt/complex browser test window, likely `/production-planning` or nearby UI with resizable layout.

Steps:

1. Run browser smoke through production planning / delivery / production flows.
2. Observe Vite dev server console.

Actual:

- Dev server reports repeated unhandled client errors: `ResizeObserver loop completed with undelivered notifications.`

Expected:

- No unhandled browser/runtime noise during smoke flow.

Screenshot: not captured as page screenshot; evidence from dev server output when stopping `bun run dev`.

## 8. Saran Perbaikan

### UX / Flow

- Dampak tinggi, effort sedang: setelah QC reject, refetch/open state dialog otomatis agar `Trigger Rework` muncul tanpa harus close/reopen.
- Dampak sedang, effort rendah: Delivery detail sebaiknya memberi error eksplisit “tidak bisa memuat kandidat QC karena hak akses” bila query eligibility kosong akibat RLS, bukan hanya “Tidak ada hasil QC lulus”.
- Dampak sedang, effort rendah: Production card saat previous QC belum pass bisa menampilkan blocker inline pada step berikutnya, karena API sudah punya pesan spesifik.

### Konsistensi Visual

- Dampak sedang, effort sedang: selaraskan sidebar visibility dengan tabel akses owner; saat menu intentionally broad read-only, dokumentasikan sebagai keputusan produk.
- Dampak rendah, effort rendah: status/action text campur Indonesia-Inggris (`Complete`, `Start`, `Draft`, `Confirmed`) masih terasa tidak konsisten untuk operator lantai produksi.

### Performa

- Dampak sedang, effort rendah: client chunk sudah aman, tetapi warning Nitro/server `manualChunks ignored` perlu dibersihkan agar tidak menutupi warning build yang lebih penting.
- Dampak sedang, effort sedang: `/production` masih memuat banyak kartu dalam satu board; pertimbangkan filter default aktif yang lebih ketat atau virtualisasi per kolom saat dataset >200.

### Aksesibilitas

- Dampak sedang, effort rendah: DnD perlu fallback keyboard yang jelas atau action buttons yang selalu setara secara fungsional, karena drag sulit diuji dan bisa sulit untuk pengguna keyboard.
- Dampak rendah, effort rendah: beberapa role/button name menghasilkan strict-mode ambiguity karena card memakai `role=button` dan berisi tombol nested; ini bisa membingungkan screen reader dan automation.

### Tech Debt / Kode

- Dampak tinggi, effort rendah/sedang: tambahkan `delivery` ke SELECT policy `engineering_jobs` atau ubah eligibility query/RPC agar role delivery tidak perlu join ke tabel yang tidak bisa dibaca.
- Dampak sedang, effort sedang: tambah Playwright smoke terotomasi untuk forced password change, delivery item eligibility, dan production DnD/gate. Ini akan menangkap regresi seperti BUG-2/8 sebelum UAT manual.
- Dampak rendah, effort rendah: kurangi 37 warning fast-refresh dengan memindahkan non-component exports dari route files jika ingin lint benar-benar bersih.

## 9. Kesimpulan

[Pasti] Aplikasi **belum layak dianggap stabil untuk demo end-to-end penuh** karena delivery flow berhenti setelah draft dan password-change masih menghasilkan 403 console error.  
[Kemungkinan Besar] Aplikasi **cukup layak untuk demo terbatas** pada dashboard, sales list/guard, engineering, material, production button fallback, QC validation/rework, dan production planning create batch.

Keputusan owner yang perlu:

1. Apakah tabel RBAC prompt adalah source-of-truth strict untuk sidebar, atau beberapa menu read-only memang sengaja dibuka ke role lain?
2. Apakah fix berikutnya fokus ke delivery RLS/eligibility dulu, atau password-change logout 403 dulu?
3. Apakah DnD wajib untuk demo, atau tombol action boleh menjadi fallback resmi sampai DnD punya test automation yang stabil?
