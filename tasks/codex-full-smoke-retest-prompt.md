# Prompt Codex — Retest Full Smoke DSM MOS (round 2)

Gunakan prompt ini untuk retest setelah fix BUG-1 dan untuk menutup coverage yang belum terbukti di run pertama.
Task ini **functional smoke retest atas permintaan langsung owner**, **hanya di local Supabase stack**, bukan review kode.

---

## Context (wajib dibaca — jangan asumsikan histori percakapan)

- Project: **DSM MOS** (Manufacturing Order System). Stack: Supabase (Postgres + RLS + triggers + RPC) + TanStack Start/React + Tailwind + shadcn/ui.
- App dev: `bun run dev` → `http://localhost:8080/` (atau `127.0.0.1:8080`). Local stack: `supabase start`.
- Remote project ID (**JANGAN DISENTUH**): `jtzwawtfymljfqfrplib`. Semua kerja murni di local stack.
- Login: kredensial per-role diberikan owner saat run.
- RBAC roles: `admin`, `sales`, `qc`, `production`, `production_planning`, `material`, `delivery`, `viewer`.

### Run pertama (baseline)

- Prompt: `tasks/codex-full-smoke-test-prompt.md`
- Report: `tasks/codex-full-smoke-test-report.md`
- Verdict run 1: **FAIL** untuk sertifikasi E2E (quality gate & mayoritas route PASS, tapi coverage wajib belum lengkap + 1 bug).
- Temuan run 1:
  - **BUG-1 (major)** — `/dashboard`: request statistik yang menggantung tidak pernah settle, kartu "Sales Order per Status" stuck `"Memuat…"` >15 detik tanpa error notice.
  - **BUG-2 (minor)** — forced password-change (first login) meninggalkan `403` di `auth/v1/logout?scope=global` + console error merah.
  - **BUG-3 (minor)** — bundle chunk > 500 kB, belum ada code-splitting.
  - PASS_PARTIAL (hanya render + pgTAP, UI flow tidak dituntaskan manual): Engineering, Material, Production Planning/Operator, Production Kanban, QC, Delivery.
  - **Tidak terbukti sama sekali**: drag & drop production, realtime 2-tab, offline queue sync penuh, dark-mode contrast, keyboard trap/Esc dialog, empty-state per modul.

### Fix yang sudah dilakukan (commit `2d86698` di `main`)

- **BUG-1 fix** di:
  - `src/features/dashboard/hooks/use-dashboard-stats.ts` — helper `withTimeout()` menambahkan abort timeout 10 detik (digabung dengan `AbortSignal` React Query) ke 3 query view dashboard; `retry: 1` supaya kegagalan cepat sampai ke error UI.
  - `src/routes/_authenticated/dashboard.tsx` — tombol **"Coba lagi"** di alert error dashboard (refetch 3 query, disabled saat `isFetching`).
- BUG-2 dan BUG-3 **belum diperbaiki** — cukup dikonfirmasi ulang statusnya, jangan diperbaiki di task ini.

## Goal

1. **Verifikasi BUG-1 benar-benar tertutup** di browser (regression check).
2. **Konfirmasi ulang BUG-2 dan BUG-3** (masih ada / hilang / berubah severity).
3. **Tutup coverage PASS_PARTIAL dan "tidak terbukti"** dari run 1 dengan pembuktian UI nyata.
4. Keluarkan verdict baru + report.

## Persiapan

1. `git log --oneline -3` → pastikan `2d86698` (fix dashboard) ada di working tree. Kalau belum, `git pull` dulu.
2. `supabase db reset` (state migration bersih).
3. Seed: pakai `supabase/seed-demo/20260823_demo_200_dataset.sql` (sama seperti run 1) **plus** siapkan minimal fixture kecil ini kalau seed demo tidak menyediakannya (boleh lewat SQL langsung ke local DB, tandai jelas mis. prefix `RETEST-`):
   - minimal **1 production batch** yang punya step berstatus `pending`/`running` sehingga ada kartu **draggable** di Kanban;
   - minimal **1 QC inspection** yang bisa didorong ke `reject` untuk menguji `trigger_rework`;
   - minimal **1 SO** yang sudah lolos QC dan siap masuk **delivery** untuk menguji transisi status pengiriman;
   - minimal **1 modul dalam kondisi kosong** (mis. filter yang menghasilkan 0 baris) untuk cek empty-state.
   Catat persis apa yang kamu tambahkan.
4. `bun run dev` + `supabase status` sehat.
5. Quality gate (catat hasil, jangan lanjut kalau ada yang FAIL):
   - `supabase test db`
   - `bunx tsc --noEmit`
   - `bun run lint` (37 warning `react-refresh/only-export-components` sudah diketahui = OK)
   - `bun run build`

## Yang harus diuji

### A. Regression — BUG-1 (WAJIB, prioritas utama)

1. Login admin, buka `/dashboard` normal → pastikan 3 kartu statistik + "Sales Order per Status" tampil angka benar (cross-check `v_dashboard_so_status`, `v_dashboard_material_waiting`, `v_dashboard_production_running` via query manual).
2. Di DevTools Network, **block** / throttle-to-offline request `rest/v1/v_dashboard_so_status` (dan idealnya ulangi untuk `v_dashboard_material_waiting`, `v_dashboard_production_running`).
3. Reload `/dashboard`. Amati maksimal 30 detik.
4. **Kriteria lulus BUG-1:**
   - dalam ≤ ~25 detik kartu berhenti menampilkan `"Memuat…"` dan berubah jadi error state (teks `Gagal memuat distribusi Sales Order` / kartu `—` / alert merah `Gagal memuat ringkasan dashboard`);
   - alert merah menampilkan tombol **"Coba lagi"**;
   - klik "Coba lagi" saat request masih diblock → tombol jadi disabled/`"Memuat ulang…"` lalu kembali ke error (tidak nyangkut);
   - unblock request → klik "Coba lagi" → data termuat benar tanpa reload halaman.
5. Catat waktu aktual dari reload sampai error state muncul.
6. Screenshot: state "Memuat…" awal (kalau sempat), state error + tombol, state pulih setelah unblock.

### B. Konfirmasi ulang BUG-2 & BUG-3

7. **BUG-2**: buat user baru via `/admin`, login pertama kali sebagai user itu, jalankan forced password change. Cek Network + Console: apakah `403` pada `auth/v1/logout?scope=global` + console error merah **masih muncul**? Catat status (masih ada / hilang) — jangan perbaiki.
8. **BUG-3**: `bun run build`, catat apakah warning chunk > 500 kB masih ada dan ukuran chunk terbesar. Jangan perbaiki.

### C. Tutup coverage PASS_PARTIAL — jalankan UI flow beneran

Untuk tiap area di bawah, jangan cukup "route render" — jalankan transisi/aksi nyata di browser dan verifikasi hasil di DB atau di UI setelah refetch.

9. **Engineering** (`/engineering`): ambil 1 job `pending`/`assigned` → assign PIC → `in_progress` (buktikan gate menolak lompat status) → naikkan progress → buktikan **lock di 100** → `approved`/selesai. Cek tab riwayat job terisi tiap transisi.
10. **Material** (`/material`): 1 record `waiting_material` → `material_ready`. Cek tab riwayat tercatat. Konfirmasi 1:1 dengan job (tidak ada duplikat).
11. **Production Planning + Operator** (`/production-planning`, `/operators`): CRUD 1 operator (create + edit). Buat 1 production batch baru + pilih routing subset (bukan semua step) → verifikasi `production_batch_steps` yang terbentuk **sesuai routing** yang dipilih (query DB).
12. **Production Kanban** (`/production`):
    - drag & drop 1 kartu step antar kolom status → `StepOperatorDialog` muncul → **wajib pilih `operator_id`** (tombol konfirmasi disabled sebelum operator dipilih) → simpan → verifikasi status + `operator_id` tersimpan di DB.
    - coba transisi ilegal (skip step / mundur tanpa rework) → ditolak dengan pesan spesifik.
    - path `rework`: reject sebuah step → status jadi `rework` → bisa dikerjakan ulang.
    - **realtime 2-tab**: buka `/production` di 2 tab (bisa 2 window/incognito), pindahkan kartu di tab A → tab B ikut update tanpa manual refresh. Catat delay kasar.
13. **QC** (`/qc`):
    - tab Antrian hanya isi status aktif; tab Riwayat default 90 hari + limit 300, ubah rentang tanggal → refetch benar.
    - dialog inspeksi: isi `qty_total`, `qty_ok`, `qty_reject`, `defect_notes`; buktikan validasi `qty_ok + qty_reject > qty_total` ditolak.
    - flow `waiting → Mulai Inspeksi → inspection → Lulus`, lalu 1 item `→ Tolak → reject`.
    - buktikan tombol **Trigger Rework hanya muncul di status `reject`** dan aksinya lewat RPC `trigger_rework` (bukan direct status update — cek `audit_logs` / tidak ada UPDATE status manual).
    - **offline queue** (kalau modul M6 masih aktif di UI): offline → simpan draft → banner amber `"{n} data tersimpan lokal, menunggu sinkronisasi"` + tombol `Coba sinkronkan` muncul → lakukan 1 transisi status offline → online → auto-sync (atau klik `Coba sinkronkan`) → banner hilang saat queue habis → refresh halaman → state final benar di DB. Kalau modul offline sudah tidak ada di UI, catat itu eksplisit.
14. **Delivery** (`/delivery`, `/delivery/$id`, `/delivery/schedule`):
    - `/delivery`: filter default = status **aktif** (bukan semua); toggle "Semua status" → jumlah baris berubah sesuai; limit 200 tidak memotong data yang seharusnya tampil.
    - ambil SO yang lolos QC → muncul sebagai kandidat delivery → jalankan transisi status pengiriman sampai `delivered` (atau sejauh yang UI izinkan) → verifikasi di DB.
    - `/delivery/schedule` Gantt: default rentang 90 hari lalu–180 hari depan; ubah rentang manual → re-fetch benar; navigasi via tombol.

### D. Cross-cutting yang belum lengkap di run 1

15. **Empty states**: untuk tiap list/board utama, buat kondisi 0 baris (filter ekstrem / role tanpa data) → pastikan tampil komponen empty-state, bukan spinner selamanya atau crash. Minimal cek: Sales Order, Engineering, Material, Production, QC, Delivery.
16. **Loading & error state generik**: stop `supabase` sebentar (atau block request) saat membuka 2–3 halaman list → UI tampil error notice yang jelas + (kalau ada) retry, bukan blank.
17. **Dark mode**: toggle theme di ≥ 5 halaman berbeda (dashboard, sales-orders list, production kanban, qc, delivery) → cek tidak ada teks kontras rendah / warna status pill rusak / area putih menyilaukan. Screenshot tiap halaman dark.
18. **Konsistensi status pill**: bandingkan warna + ikon status yang sama di modul berbeda (mis. status SO di list vs dashboard; status step di production vs qc) → konsisten.
19. **Aksesibilitas dialog**: untuk Create User, QC Inspection, Step Operator, Delivery Create — cek focus pindah ke dalam dialog saat buka, `Tab` tidak keluar dari dialog (focus trap), `Esc` menutup, tombol punya label.
20. **Responsif 375px**: cek dashboard, sales-orders list, production kanban, qc di viewport 375px → sidebar collapse, tabel/board scroll, tidak ada overflow horizontal rusak.
21. **Console & network**: sepanjang semua langkah di atas — tidak ada uncaught error / 4xx-5xx tak terduga / request loop.

## Output yang diminta

Simpan report ke `tasks/codex-full-smoke-retest-report.md`, format:

1. **Verdict**: PASS / PASS_WITH_MINOR / FAIL — dan perbandingan eksplisit vs run 1 (naik/tetap/turun).
2. **Ringkasan setup**: commit yang diuji (`git rev-parse HEAD`), cara seed + fixture RETEST yang ditambahkan, hasil 4 quality gate.
3. **Regression BUG-1**: PASS / FAIL + waktu aktual reload→error state, perilaku tombol "Coba lagi", screenshot path. Kalau masih FAIL, jelaskan persis di mana.
4. **Status BUG-2 & BUG-3**: masih ada / hilang / berubah — dengan bukti.
5. **Matriks hasil per area** (A–D di atas): PASS / FAIL / SKIP + bukti singkat (angka, query, observasi). Tandai mana yang **naik dari PASS_PARTIAL run 1 jadi PASS penuh**.
6. **RBAC matrix** (role × menu) — ulangi cepat untuk konfirmasi tidak ada regresi.
7. **Bug list baru / masih terbuka**, per bug: severity (blocking/major/minor), modul + route, langkah reproduksi, aktual vs harapan, screenshot path.
8. **Saran perbaikan** (terpisah dari bug): UX/flow, konsistensi visual, performa, aksesibilitas, tech-debt — masing-masing dampak (tinggi/sedang/rendah) + effort kasar. Tandai mana yang carry-over belum ditindaklanjuti dari run 1.
9. **Kesimpulan**: apakah aplikasi sekarang layak disertifikasi stabil untuk demo dan/atau UAT/produksi, dan follow-up apa yang butuh keputusan owner.
10. **Cleanup**: hapus fixture `RETEST-` yang kamu tambahkan, jalankan `supabase test db` sekali lagi → konfirmasi kembali ke state PASS bersih.

## Rules

- **Hanya local Supabase stack.** Jangan pernah mutasi remote `jtzwawtfymljfqfrplib`.
- **Jangan ubah kode** (`src/`) atau migration lama. Boleh menambah file seed/fixture/report baru saja.
- **Jangan perbaiki bug** apa pun yang ditemukan (termasuk BUG-2/BUG-3) — cukup laporkan. Ini retest, bukan sesi fixing.
- Kalau BUG-1 ternyata **masih FAIL** setelah fix `2d86698` → itu temuan penting, laporkan detail persis (waktu, network trace, apakah `withTimeout`/`retry` kelihatan jalan di Network) — jangan diperbaiki, kembalikan ke owner.
- Kalau login gagal / stack tidak sehat → hentikan, laporkan blocker.
- Kalau 1 modul crash total → catat, lanjut modul lain (kecuali auth, yang memblok semua).
- Jangan tinggalkan fixture `RETEST-` di DB setelah selesai.

---

## Prompt singkat versi sekali tempel

```text
Retest FULL SMOKE DSM MOS round 2 di LOCAL Supabase stack saja (jangan sentuh remote jtzwawtfymljfqfrplib). Jangan ubah kode/migration; jangan perbaiki bug apa pun; boleh tambah file seed/fixture/report saja. Baseline: tasks/codex-full-smoke-test-report.md (verdict FAIL, BUG-1 dashboard spinner indefinite = major, BUG-2 403 logout forced-password minor, BUG-3 bundle >500kB minor, banyak area PASS_PARTIAL: Engineering/Material/ProductionPlanning/ProductionKanban/QC/Delivery, dan drag&drop + realtime 2-tab + offline queue + dark-mode + empty-state belum terbukti). Fix BUG-1 sudah di commit 2d86698 (src/features/dashboard/hooks/use-dashboard-stats.ts withTimeout 10s + retry:1; src/routes/_authenticated/dashboard.tsx tombol "Coba lagi"). Persiapan: git log pastikan 2d86698 ada, `supabase db reset`, seed pakai supabase/seed-demo/20260823_demo_200_dataset.sql + tambah fixture kecil bertanda RETEST- (1 batch dengan step draggable, 1 QC bisa di-reject, 1 SO siap delivery, 1 kondisi kosong untuk empty-state), `bun run dev`, jalankan `supabase test db` + `bunx tsc --noEmit` + `bun run lint` + `bun run build`. Lalu: (A) REGRESSION BUG-1 — buka /dashboard normal (cross-check angka 3 view via query manual), block request rest/v1/v_dashboard_so_status di DevTools, reload, pastikan dalam ~25 detik kartu berhenti "Memuat…" dan jadi error state + alert merah + tombol "Coba lagi" berfungsi (disabled saat fetching, pulih setelah unblock tanpa reload); catat waktu aktual + screenshot. (B) Konfirmasi ulang BUG-2 (forced password change first login -> masih 403 logout global?) dan BUG-3 (build masih warning chunk >500kB?) tanpa memperbaiki. (C) Tutup PASS_PARTIAL dengan UI flow nyata: Engineering assign->in_progress(gate)->progress lock 100->approved + riwayat; Material waiting->ready + riwayat; Operator CRUD + buat batch dengan routing subset -> steps sesuai routing (query DB); Production Kanban drag&drop kartu -> StepOperatorDialog wajib operator -> simpan (verifikasi DB), transisi ilegal ditolak, path rework, realtime 2-tab; QC tab Antrian/Riwayat (90hari+limit300, ubah rentang), validasi qty_ok+qty_reject>qty_total ditolak, flow waiting->inspection->lulus + 1 ->tolak->reject, Trigger Rework hanya di status reject via RPC trigger_rework, offline queue banner amber + Coba sinkronkan (atau catat kalau modul offline sudah tidak ada); Delivery filter default aktif + toggle semua status + limit 200, transisi status pengiriman SO lolos QC sampai delivered (verifikasi DB), Gantt rentang default 90 lalu-180 depan + ubah rentang. (D) Cross-cutting: empty-state tiap list/board (SO, Engineering, Material, Production, QC, Delivery), error state generik saat supabase distop, dark mode di >=5 halaman (screenshot), konsistensi status pill lintas modul, focus trap+Esc di dialog Create User/QC Inspection/Step Operator/Delivery Create, responsif 375px (dashboard/SO/production/qc), console+network bersih. Ulangi cepat RBAC matrix role x menu untuk cek regresi. Outputkan report ke tasks/codex-full-smoke-retest-report.md: verdict + perbandingan vs run 1, ringkasan setup (commit HEAD + fixture), hasil regression BUG-1 (PASS/FAIL + waktu aktual + screenshot), status BUG-2/BUG-3, matriks hasil per area (tandai yang naik dari PASS_PARTIAL jadi PASS penuh), RBAC matrix, bug list baru/masih terbuka per severity, saran perbaikan (dampak+effort, tandai carry-over run 1), kesimpulan kesiapan demo/UAT + follow-up owner, dan konfirmasi cleanup fixture RETEST- + supabase test db balik PASS bersih. Kalau BUG-1 masih FAIL setelah 2d86698, laporkan detail persis (waktu, network trace, apakah timeout/retry kelihatan jalan) dan kembalikan ke owner tanpa memperbaiki. Kalau login gagal atau stack tidak sehat, hentikan dan laporkan blocker.
```
