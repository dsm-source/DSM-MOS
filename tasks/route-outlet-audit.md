# Route Outlet Anti-Pattern — Browser Verification + Fix + Sibling Audit

Tanggal: 2026-08-20
Scope: `/sales-orders/new` verify, `/sales-orders/$id/edit` fix, scan `delivery`/`engineering` siblings, unblock M6.8 seeding.

## 1. `/sales-orders/new` — Browser Verify (PASS)

Login lokal `admin@dsm.com` (password test di-reset via Supabase Auth Admin API lokal, hanya untuk stack lokal — tidak menyentuh remote).

Diverifikasi nyata di browser:
- Klik "SO Baru" dari `/sales-orders` → form `SalesOrderForm` tampil.
- Hard reload penuh (`navigate force:true`) ke `/sales-orders/new` → form tetap tampil (bukan list).
- Submit SO baru (customer `CUST-TEST`, item "Bracket M6.8 Test") → sukses, toast "SO SO-2026-000044 dibuat", redirect ke `/sales-orders/$id` detail.

Kesimpulan: fix sebelumnya (`sales-orders.tsx` → layout + `<Outlet/>`, list dipindah ke `sales-orders.index.tsx`) terbukti benar via browser, bukan cuma asumsi route tree.

## 2. `/sales-orders/$id/edit` — Bug Ditemukan & Difix

### Root cause
`src/routes/_authenticated/sales-orders.$id.tsx` adalah leaf route (`/_authenticated/sales-orders/$id`) DAN sekaligus parent route untuk child `sales-orders.$id.edit.tsx` (dikonfirmasi di `routeTree.gen.ts`: `AuthenticatedSalesOrdersIdEditRoute.getParentRoute() === AuthenticatedSalesOrdersIdRoute`). Komponennya (`SalesOrderDetailPage`) tidak render `<Outlet />` — pola identik dengan bug `/sales-orders/new`.

### Bukti bug (browser, sebelum fix)
Navigasi ke `/sales-orders/{id}/edit`:
- Tab title benar: "Edit SO — DSM MOS" (sesuai `head.meta` file edit).
- DOM yang dirender: halaman detail (`SalesOrderDetailPage`) — tombol Edit/Hapus, section "Ubah status", "Penanggung Jawab" — BUKAN form edit.

### Fix
- `git mv sales-orders.$id.tsx → sales-orders.$id.index.tsx`.
- TanStack Router Vite plugin (dev server) otomatis meregenerasi `routeTree.gen.ts` dan otomatis mengubah string route di file (`/_authenticated/sales-orders/$id` → `/_authenticated/sales-orders/$id/`) — tidak ada perubahan logic/JSX lain di file tsb.
- Hasil struktur baru: `sales-orders.$id.index` dan `sales-orders.$id.edit` sama-sama jadi children langsung dari `sales-orders` (layout `<Outlet/>` yang sudah ada dari fix sebelumnya) — tidak perlu file layout `$id` terpisah.

### Bukti fix (browser, sesudah)
- `/sales-orders/{id}/edit` → title "Edit SO — DSM MOS", DOM: form `SalesOrderForm` terisi data existing ("Edit sales order", customer/tanggal/item prefilled).
- `/sales-orders/{id}` (detail) → tidak regresi, tetap render `SalesOrderDetailPage` seperti biasa.

### File yang berubah
- `src/routes/_authenticated/sales-orders.$id.tsx` → **renamed** `src/routes/_authenticated/sales-orders.$id.index.tsx` (hanya 1 baris berubah: route path string, auto oleh plugin).
- `src/routeTree.gen.ts` (auto-regenerated).

## 3. Scan Sibling Routes `delivery` & `engineering`

Static check (`routeTree.gen.ts` parent-child wiring) + browser verify langsung (title vs DOM) untuk memastikan bukan asumsi.

| Route | Parent tanpa `<Outlet/>`? | Browser verify | Status |
|---|---|---|---|
| `/delivery/schedule` | Ya — `delivery.tsx` component `DeliveryPage` tidak ada `<Outlet/>`, tapi jadi parent utk `delivery.$id` & `delivery.schedule` | Dicoba: title="Jadwal Pengiriman — DSM MOS", DOM tetap render list "Rencana Pengiriman" | **Bug confirmed** |
| `/delivery/$id` | Sama parent (`delivery.tsx`) | Tidak ada data delivery di local stack untuk browser-test langsung | **Bug by construction** (parent identik, belum bisa browser-test karena tidak ada row) |
| `/engineering/workload` | Ya — `engineering.tsx` component `EngineeringBoardPage` tidak ada `<Outlet/>` | Dicoba: title="Engineering Workload — DSM MOS", DOM tetap render Kanban board "Engineering Job" | **Bug confirmed** |
| `/engineering/$id` | Sama parent (`engineering.tsx`) | Dicoba dengan job id nyata: title="Detail Engineering Job — DSM MOS", DOM tetap render Kanban board | **Bug confirmed** |

Semua 4 route di atas persis pola yang sama dengan bug `/sales-orders/new` dan `/sales-orders/$id/edit` sebelum difix: file route induk (`delivery.tsx`, `engineering.tsx`) berperan dobel sebagai leaf route DAN parent layout untuk child route, tapi komponennya tidak render `<Outlet/>`.

**Tidak difix di sesi ini** — sesuai instruksi scope, prioritas fix tetap di Sales Order. Rekomendasi fix (untuk sesi berikutnya, scope terpisah): pola sama seperti sales-orders — pindahkan `DeliveryPage`/`EngineeringBoardPage` ke `delivery.index.tsx`/`engineering.index.tsx`, ubah `delivery.tsx`/`engineering.tsx` jadi layout `<Outlet/>`.

## 4. Seeding M6.8 — Unblocked

SO baru (`SO-2026-000044`) dibuat via browser (hasil verifikasi §1) tapi tidak didorong lebih lanjut (masih draft, tanpa job engineering — SO belum di-confirm).

SO existing `SO-2026-000043` (status confirmed, sudah py engineering job `ENG-2026-000046` sejak sebelum sesi ini) didorong sampai QC lewat kombinasi:
- Update status via SQL langsung ke local Postgres (`supabase db query`, DB trigger/RLS tetap aktif dan menegakkan validasi — bukan bypass, hanya mem-skip UI karena route `/engineering/$id` sedang broken/out-of-scope untuk difix sesi ini).
- Urutan: `engineering_jobs` draft→in_progress→review→approved (trigger `engineering_jobs_validate_transition` menegakkan gate & progress lock 100) → `material_statuses` → `material_ready` → insert 1 `operators` row (`Operator Test QC`) → insert `production_batches` (trigger auto-generate `batch_number` + 5 `production_batch_steps` sesuai routing default) → step 1 (`laser_cutting`) `waiting→running→completed` (trigger `production_batch_steps_validate_transition` menegakkan gate: engineering approved + material ready untuk step pertama) → trigger `production_batch_steps_auto_enqueue_qc` otomatis insert `qc_inspections` row status `waiting`.

### Bukti browser `/qc`
- Antrian QC menampilkan 1 item nyata: `ENG-2026-000046-B1 · Menunggu · Tahap 1 - Laser Cutting · SO SO-2026-000043 · Test Customer QC · Bracket Test QC · Qty batch: 10 pcs`.
- Dialog inspeksi dibuka (`Buka`) → form lengkap tampil (Total Diinspeksi, Jumlah OK, Jumlah Tolak, Catatan cacat, Riwayat inspeksi Siklus 1). Ditutup tanpa submit — eksekusi checklist M6.8 (offline/online toggle) sengaja tidak dijalankan di sesi ini, itu scope manual test terpisah (`tasks/m6-offline-manual-test.md`).

Kesimpulan: jalur seeding sales order → QC tidak lagi blocked. M6.8 checklist siap dieksekusi manual kapan saja.

## Verifikasi Final

```bash
PATH="/Users/macbook/.bun/bin:$PATH" bunx tsc --noEmit   # PASS
PATH="/Users/macbook/.bun/bin:$PATH" bun run lint          # PASS
PATH="/Users/macbook/.bun/bin:$PATH" bun run build          # PASS (warning pre-existing gantt-task-react, unrelated)
```

## Blocker Tersisa

1. `/delivery/schedule`, `/delivery/$id`, `/engineering/workload`, `/engineering/$id` masih broken (anti-pattern sama, out-of-scope sesi ini) — akan menghambat operator/PIC yang perlu buka detail engineering job atau jadwal delivery lewat UI langsung.
2. Local test user `admin@dsm.com` password sudah di-reset ke nilai test (`TestPass123!`) via Supabase Auth Admin API lokal — hanya berlaku di stack lokal ini, tidak disimpan di repo/commit. Beri tahu owner kalau butuh password lain untuk sesi berikutnya.
3. M6.8 checklist belum benar-benar dieksekusi (toggle offline/online manual) — data sudah siap, tinggal jalankan `tasks/m6-offline-manual-test.md`.
4. Data seed (`Operator Test QC`, `production_batches` `ENG-2026-000046-B1`, SO `SO-2026-000044` draft) adalah data test lokal, bukan data produksi — aman dihapus/reset kapan saja via `supabase db reset`.

## Files Touched
- `src/routes/_authenticated/sales-orders.$id.tsx` → renamed `src/routes/_authenticated/sales-orders.$id.index.tsx`
- `src/routeTree.gen.ts` (auto-regenerated)
- `tasks/todo.md`
- `tasks/route-outlet-audit.md` (baru)

---

## 5. M6.8 — Eksekusi Manual Checklist (2026-08-20, lanjutan sesi)

Dijalankan penuh di browser nyata terhadap item `ENG-2026-000046-B1` di `/qc` yang sudah diseed di §4.

### Metode simulasi offline/online
Browser tool yang dipakai tidak punya kontrol DevTools Network throttling langsung, jadi offline disimulasikan dengan cara yang setara secara fungsional dengan yang dicek app: override getter `navigator.onLine` via `Object.defineProperty` + dispatch `window.dispatchEvent(new Event('offline'|'online'))`. Ini valid karena app hanya mengecek `navigator.onLine` (fungsi `isOffline()` di `offline-queue.ts`) dan listen event `online` (di `use-offline-qc-queue.ts`) — persis yang disimulasikan.

### Hasil per langkah checklist

| # | Langkah | Hasil |
|---|---|---|
| 1 | Buka `/qc`, tab Antrian ada 1 item `waiting` | ✅ |
| 2 | Klik "Buka" pada kartu | ✅ dialog terbuka |
| 3 | Simulasi offline | ✅ `navigator.onLine=false` |
| 4 | Isi Total 10 / OK 8 / Tolak 2, klik "Simpan" | ✅ toast "Tersimpan lokal, menunggu sinkronisasi", tidak crash |
| 5 | Klik "Mulai Inspeksi" (transisi `waiting→inspection`) offline | ✅ toast queued lagi; dialog tetap terbuka (sesuai spec: hanya `pass`/`reject` yang menutup dialog) |
| 5b | Tutup dialog, cek indikator | ✅ banner "2 data tersimpan lokal, menunggu sinkronisasi"; `localStorage['dsm-mos:qc-offline-queue']` berisi 2 item (`update-inspection` draft + transisi) |
| 6 | Simulasi online | ✅ `navigator.onLine=true` + dispatch `online` |
| 7 | Verifikasi auto-sync | ✅ toast "2 data lokal berhasil disinkronkan" otomatis (listener `online`), banner indikator hilang, badge kartu berubah ke "Inspeksi" |
| 8 | Hard reload (`navigate force:true`, setara F5) | ✅ status "Inspeksi" & qty (Total 10, OK 8, Tolak 2) tetap tampil — data di server, bukan cuma optimistic client state |
| 9 (opsional) | Reject → rework offline/online | ✅ klik "Tolak" (online, normal) → status `reject`. Offline → buka inspeksi `reject` → klik "Trigger Rework" → toast queued, dialog tertutup otomatis (sesuai spec RPC). Online → toast "1 data lokal berhasil disinkronkan", badge kartu → "Rework". Verifikasi server (SQL): `qc_inspections.status='rework'` + `rework_triggered_at` terisi; `production_batch_steps` step 1 (`laser_cutting`) ikut pindah ke `rework` (efek RPC `trigger_rework`, PRD §7 rule #3 — bukan direct update). |

### Kesimpulan
Semua 9 langkah checklist (termasuk opsional) **PASS**. Deteksi offline, queueing localStorage, indikator pending, auto-sync on `online` event, tombol manual "Coba sinkronkan" (tidak perlu dipakai karena auto-sync sudah trigger duluan), dan persistensi lintas reload — semua berperilaku sesuai `tasks/m6-offline-manual-test.md` §Catatan Perilaku.

Checkpoint M6 sekarang hanya tersisa `get_advisors` (butuh MCP Supabase OAuth aktif — di luar kendali sesi lokal ini).

---

## 6. `get_advisors` — Dijalankan (2026-08-20, MCP Supabase aktif)

Dijalankan lewat MCP `supabase.get_advisors` terhadap project remote yang terhubung (dikonfirmasi via `get_project_url` → `https://jtzwawtfymljfqfrplib.supabase.co`, sesuai project target di `docs/PRD.md`/`tasks/todo.md`).

| Type | Hasil |
|---|---|
| `security` | 1 `WARN` — `auth_leaked_password_protection`: "Leaked Password Protection Disabled". Deskripsi: Supabase Auth belum mengecek password baru terhadap HaveIBeenPwned. Remediation: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection |
| `performance` | 0 temuan — bersih |

### Analisis
- Bukan gap RLS, index, atau schema — semua migration M0–M6 tetap bersih di layer performance dan tidak memicu lint apa pun.
- Temuan satu-satunya adalah toggle Auth level project (dashboard Supabase → Authentication → Policies → "Leaked password protection"), bukan sesuatu yang bisa difix lewat migration/kode.
- Mengaktifkan toggle ini adalah perubahan account/security setting — di luar wewenang eksekusi otomatis, butuh aksi manual owner di dashboard Supabase (atau approval eksplisit sebelum diaktifkan lewat API kalau ada tool-nya).

### Keputusan Owner
Owner memilih: **accepted risk, non-blocking** — Checkpoint M6 ditutup dengan catatan temuan ini didokumentasikan, bukan di-fix di sesi ini. Rekomendasi: owner mengaktifkan "Leaked Password Protection" langsung di Supabase Dashboard kapan pun nyaman (perubahan 1 klik, tidak butuh migration/deploy).

### Checkpoint M6 — Status Akhir
Semua kriteria PRD/SPEC.md §Checkpoint M6 terpenuhi:
- Pass/reject/rework cycle penuh — terverifikasi (§5, termasuk browser + SQL server-side).
- Offline submit — terverifikasi (§5).
- `get_advisors` — dijalankan, 0 temuan blocking (1 WARN accepted risk).

**Checkpoint M6: ✅ DITUTUP.**

---

## 7. Fix Lanjutan — `delivery` & `engineering` Sibling Routes (2026-08-20)

Owner minta bug di §3 difix. Pola fix identik dengan `sales-orders`/`sales-orders/$id`:

### Fix
- `git mv delivery.tsx → delivery.index.tsx` — TanStack Router Vite plugin auto-fix route path string (`/_authenticated/delivery` → `/_authenticated/delivery/`) dan auto-regenerate `routeTree.gen.ts`. Tidak ada baris lain yang berubah.
- `git mv engineering.tsx → engineering.index.tsx` — sama persis.
- File baru `delivery.tsx` dan `engineering.tsx` dibuat sebagai layout minimal:
  ```tsx
  import { createFileRoute, Outlet } from "@tanstack/react-router";
  export const Route = createFileRoute("/_authenticated/delivery")({ component: Outlet });
  ```
  (dan padanannya untuk `engineering`).
- Hasil `routeTree.gen.ts`: `DeliveryIndexRoute`, `DeliveryScheduleRoute`, `DeliveryIdRoute` semua children dari `DeliveryRoute` (layout `<Outlet/>`); sama untuk `EngineeringIndexRoute`, `EngineeringWorkloadRoute`, `EngineeringIdRoute` di bawah `EngineeringRoute`.

### Bukti fix (browser, hard reload tiap route)
| Route | Sebelum | Sesudah |
|---|---|---|
| `/delivery` | OK (list) | OK, tidak regresi |
| `/delivery/schedule` | render list (bug) | render "Jadwal Pengiriman" Gantt filter — benar |
| `/delivery/$id` | belum bisa ditest (tidak ada data) | dibuat 1 row test (`DO-TEST-ROUTE-CHECK`) via SQL langsung, browser-test render "Detail Pengiriman" form lengkap (jadwal, driver, item pengiriman) — benar, lalu row dihapus lagi setelah verifikasi |
| `/engineering` | OK (board) | OK, tidak regresi, job test muncul "Approved 100%" |
| `/engineering/workload` | render board (bug) | render tabel "Engineering Workload" per engineer — benar |
| `/engineering/$id` | render board (bug) | render "Detail Engineering Job" lengkap dengan riwayat status — benar |

### File yang berubah (fix lanjutan ini)
- `src/routes/_authenticated/delivery.tsx` → renamed `src/routes/_authenticated/delivery.index.tsx` (1 baris route path, auto)
- `src/routes/_authenticated/engineering.tsx` → renamed `src/routes/_authenticated/engineering.index.tsx` (1 baris route path, auto)
- `src/routes/_authenticated/delivery.tsx` — **baru**, layout `<Outlet/>`
- `src/routes/_authenticated/engineering.tsx` — **baru**, layout `<Outlet/>`
- `src/routeTree.gen.ts` (auto-regenerated)
- `tasks/todo.md`

### Verifikasi
```bash
PATH="/Users/macbook/.bun/bin:$PATH" bunx tsc --noEmit   # PASS
PATH="/Users/macbook/.bun/bin:$PATH" bun run lint          # PASS
PATH="/Users/macbook/.bun/bin:$PATH" bun run build          # PASS (warning pre-existing gantt-task-react, unrelated)
```

Semua anti-pattern parent-route-tanpa-`<Outlet/>` yang ditemukan di sesi ini (`sales-orders/$id`, `delivery`, `engineering`) sekarang sudah difix dan diverifikasi browser secara nyata. Tidak ada module lain yang punya pola child-route serupa yang belum dicek (`production-planning`, `material`, dll — tidak punya child route sama sekali, jadi tidak berisiko).
