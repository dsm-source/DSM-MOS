# Codex Full Smoke Test Report - DSM MOS

Tanggal run: 2026-08-30
Target: local Supabase stack + local dev server `http://127.0.0.1:8080`
Remote project `jtzwawtfymljfqfrplib`: tidak disentuh.

## 1. Verdict

**FAIL untuk sertifikasi full smoke end-to-end.**

Alasan: quality gate utama dan banyak route/flow inti PASS, tetapi masih ada coverage wajib yang tidak terbukti penuh di browser (`drag & drop` production, realtime 2-tab, full offline queue sync, dark-mode contrast audit detail), plus 1 bug error-state dashboard. Aplikasi terlihat cukup stabil untuk demo terbatas dengan data lokal, tetapi belum layak diklaim stabil produksi dari run ini.

## 2. Ringkasan Setup

- Reset: `supabase db reset --local` selesai, migration apply berhasil. `supabase/seed.sql` tidak ada.
- Seed data: load seed lokal existing `supabase/seed-demo/20260823_demo_200_dataset.sql` via local container `psql`.
- Akun admin: `test@dsm.com` disiapkan di local Auth memakai kredensial owner, role `admin`, `must_change_password=false`.
- Akun role smoke dibuat lewat UI `/admin`: `smoke-sales@dsm.local`, `smoke-qc@dsm.local`, `smoke-production@dsm.local`, `smoke-production_planning@dsm.local`, `smoke-material@dsm.local`, `smoke-delivery@dsm.local`, `smoke-viewer@dsm.local`.
- Local health: `supabase status` menunjukkan API/DB/Auth/REST tersedia; `imgproxy` dan `pooler` berhenti. Smoke ini tidak membutuhkan keduanya.
- Data setelah seed: `sales_orders=200`, `engineering_jobs=160`, `material_statuses=160`, `production_batches=140`, `production_batch_steps=700`, `qc_inspections=500`, `deliveries=50`, `delivery_items=50`, `audit_logs=4900`, `notifications=3434`.

Quality gate:

| Check | Hasil | Catatan |
|---|---:|---|
| `supabase test db` | PASS | 10 files, 256 tests, all successful |
| `bunx tsc --noEmit` | PASS | exit 0 |
| `bun run lint` | PASS_WITH_WARNINGS | exit 0, 37 warning `react-refresh/only-export-components` |
| `bun run build` | PASS_WITH_WARNINGS | exit 0, warning `vite-tsconfig-paths`, chunk > 500 kB, Nitro `inlineDynamicImports` ignored |

## 3. Matriks Hasil Per Modul

| Area | Status | Bukti singkat |
|---|---|---|
| 1. Auth & RBAC | PASS_WITH_MINOR | Admin login redirect ke `/dashboard`. Role smoke login berhasil untuk semua role. Viewer first-login force change terbukti. Guard sales -> `/admin` dan qc -> `/production-planning` redirect ke `/dashboard`. Minor: forced password-change viewer menghasilkan 403 pada logout global, tetapi login final berhasil. |
| 2. Sales Order | PASS | Browser: create SO baru, tambah item lalu hapus item kedua, save, edit catatan, confirm status. DB setelah confirm: 1 engineering job, 1 material row, 1 history row, 1 notification. Route list/detail/edit/new render tanpa console/network error. |
| 3. Pelanggan | PASS | Browser: create customer `SMOKE-412816`, muncul di list dan dipakai di dropdown SO baru. |
| 4. Engineering | PASS_PARTIAL | Route board/detail/workload render tanpa error. Seed berisi `approved=140`, `in_progress=20`; pgTAP engineering PASS. UI transisi manual per-step tidak diulang penuh di browser pada run ini. |
| 5. Material | PASS_PARTIAL | Route board render tanpa error; seed berisi `waiting_material=20`, `material_ready=140`; pgTAP material PASS. UI waiting -> ready tidak diulang manual di browser pada run ini. |
| 6. Production Planning & Operator | PASS_PARTIAL | Route `/production-planning` dan `/operators` render tanpa error; pgTAP operators/production PASS termasuk routing steps. UI create batch baru dan CRUD operator tidak diulang penuh di browser pada run ini. |
| 7. Production Execution | PASS_PARTIAL | Route render tanpa error. UI negative gate terbukti: Start pada step yang belum QC pass menampilkan pesan spesifik `Tidak bisa mulai: menunggu QC pass tahapan sebelumnya`. Operator dialog wajib pilih operator terbukti: tombol `Mulai` disabled sebelum operator. Actual drag/drop card dan realtime 2-tab tidak terbukti karena board seed awal tidak menyediakan draggable handle saat scan. |
| 8. QC | PASS_PARTIAL | Route render tanpa error. Tab Antrian menunjukkan 90 active items; Riwayat Lulus menunjukkan limit 300. Dialog validation `OK + Tolak > Total` terbukti di UI. pgTAP QC/rework PASS. Offline queue full online/offline sync tidak diuji penuh. |
| 9. Delivery | PASS_PARTIAL | Route `/delivery`, `/delivery/$id`, `/delivery/schedule` render tanpa error. DB: `delivery_total=50`, active `draft/prepared/shipped=30`; pgTAP full delivery flow PASS. UI status transition delivery tidak diulang manual pada run ini. |
| 10. Dashboard | FAIL_MINOR | Dashboard render tanpa error normal. Cross-check: `v_dashboard_so_status=200` cocok manual total 200; `v_dashboard_material_waiting.count=20`; `v_dashboard_production_running.count=0`. Bug: saat request status SO dashboard diabort, chart tetap `Memuat...` >15 detik tanpa error notice. |
| 11. Admin & Audit Log | PASS | `/admin` render tanpa error; user role smoke dibuat via UI; audit log 100 terbaru tampil di route. |
| 12. Notifikasi | PASS_WITH_MINOR | Bell badge tampil `99+`. UI `Tandai semua dibaca` berhasil; DB unread admin setelah aksi = 0, read = 1364. Minor 403 logout global pada forced password-change viewer. |
| 13. Cross-cutting | FAIL_PARTIAL | Route smoke 20 desktop/mobile route snapshots: 0 console error, 0 bad response. Mobile 375px checked untuk dashboard dan sales-orders. Error-state dashboard gagal. Dark-mode visual contrast, full keyboard trap/Esc audit, dan full empty-state per module belum lengkap. |

## 4. RBAC Matrix

Legend: `V` terlihat di sidebar, `-` tidak terlihat, `G` direct guard diuji dan ditolak.

| Role | Dashboard | Sales Order | Pelanggan | Engineering Job | Engineering Workload | Bahan | Production Planning | Operator | Produksi | QC | Pengiriman | Jadwal | Admin |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| admin | V | V | V | V | V | V | V | V | V | V | V | V | V |
| sales | V | V | V | V | V | - | - | - | - | - | - | - | G |
| qc | V | - | - | V | V | - | G | - | - | V | - | - | - |
| production | V | - | - | V | V | - | - | - | V | - | - | - | - |
| production_planning | V | - | - | V | V | - | V | V | - | - | - | - | - |
| material | V | - | - | V | V | V | - | - | - | - | - | - | - |
| delivery | V | - | - | V | V | - | - | - | - | - | V | V | - |
| viewer | V | V | - | V | V | V | - | - | V | V | V | V | - |

Screenshots:

- Admin dashboard: `tasks/codex-full-smoke-screenshots/admin-dashboard.png`
- Role matrix screenshots: `tasks/codex-full-smoke-screenshots/role-final-admin.png` through `role-final-viewer.png`
- Route smoke JSON: `tasks/codex-full-smoke-screenshots/route-smoke-results.json`

## 5. Bug List

### BUG-1 - major - Dashboard `/dashboard`

- Langkah reproduksi: login admin, intercept/abort request `rest/v1/v_dashboard_so_status`, buka `/dashboard`, tunggu 15 detik.
- Aktual: area `Sales Order per Status` tetap menampilkan `Memuat...`; tidak ada notice error yang jelas.
- Harapan: setelah retry/failure, user melihat error notice/action retry, bukan spinner indefinite.
- Screenshot: `tasks/codex-full-smoke-screenshots/dashboard-aborted-request-15s.png`

### BUG-2 - minor - Auth/change-password `/change-password`

- Langkah reproduksi: buat user via `/admin`, login pertama kali sebagai user tersebut, jalankan forced password change.
- Aktual: flow berhasil sampai dashboard, tetapi browser mencatat 403 pada `auth/v1/logout?scope=global` dan console error `Failed to load resource: 403`.
- Harapan: forced password-change tidak meninggalkan error merah/403 tak terduga, atau scope logout disesuaikan dengan kemampuan session lokal.
- Screenshot: `tasks/codex-full-smoke-screenshots/role-final-viewer.png`

### BUG-3 - minor - Build/performa bundle

- Langkah reproduksi: `bun run build`.
- Aktual: build PASS tetapi Vite memberi warning beberapa chunk > 500 kB, termasuk client `index-DTxbBOA3.js` sekitar 519 kB dan SSR router bundle besar.
- Harapan: code-splitting/dynamic import untuk modul berat seperti PDF/Gantt bila ini mulai berdampak ke cold load.
- Screenshot: n/a.

## 6. Saran Perbaikan

### UX / Flow

- Dampak tinggi, effort sedang: setiap query utama dashboard/list perlu error state eksplisit dan retry CTA. Bug dashboard menunjukkan user bisa terjebak di spinner.
- Dampak sedang, effort rendah: pada Production board, tombol `Start` yang akan ditolak gate bisa diberi disabled tooltip lebih awal saat `computeStartBlocker()` aktif, supaya user tidak perlu mencoba lalu gagal.
- Dampak sedang, effort sedang: sediakan satu dataset smoke kecil khusus E2E yang punya minimal satu card draggable/running, satu QC reject, satu delivery-ready SO, dan satu empty-state fixture.

### Konsistensi Visual

- Dampak sedang, effort rendah: audit status pill lintas modul dengan screenshot matrix; komponen status sudah tersentral sebagian, tetapi run ini belum membuktikan seluruh warna/ikon konsisten.

### Performa

- Dampak sedang, effort sedang: split bundle untuk PDF export, Gantt, dan modul admin/QC jika route awal terasa berat. Build warning chunk besar belum blocking, tapi sinyal awal.
- Dampak rendah, effort rendah: hapus `vite-tsconfig-paths` dan pakai `resolve.tsconfigPaths` native Vite bila kompatibel.

### Aksesibilitas

- Dampak sedang, effort rendah: tambahkan automated accessibility smoke untuk dialog penting: Create User, QC Inspection, Step Operator, Delivery Create. Run ini hanya membuktikan tombol/labels utama dan disabled state operator.
- Dampak sedang, effort rendah: pastikan toast error kritikal juga punya equivalent visible region yang tidak hanya ephemeral.

### Tech Debt / Kode

- Dampak rendah, effort sedang: warning Fast Refresh di route files bisa dikurangi dengan memisahkan exports non-component, supaya dev feedback lebih bersih.
- Dampak sedang, effort sedang: buat Playwright suite resmi untuk flows smoke ini. Saat ini pembuktian browser masih adhoc dan rawan selector drift.

## 7. Kesimpulan

DSM MOS **layak untuk demo terbatas/local demo** dengan catatan presenter memakai data seed yang sama dan menghindari klaim realtime/drag-drop/offline sync bila belum diuji ulang penuh. Untuk produksi/UAT formal, belum layak disertifikasi dari run ini karena coverage E2E wajib belum lengkap dan ada error-state dashboard yang nyata.

Follow-up keputusan owner:

1. Apakah mau dibuat seed smoke kecil khusus E2E agar drag/drop, offline queue, delivery transition, dan empty states bisa diuji konsisten?
2. Apakah bug dashboard spinner indefinite diprioritaskan sebelum demo?
3. Apakah warning bundle size cukup dicatat, atau mulai dipecah sekarang?
