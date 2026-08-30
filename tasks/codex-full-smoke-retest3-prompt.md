# Prompt Codex — Retest Full Smoke DSM MOS (ronde 3)

Retest setelah fix BUG-2/3/4/5 (commit `07d0572`). Fokus: verifikasi 4 bug itu benar-benar tertutup di browser, + tuntaskan 3 flow yang ronde 2 gagal dibuktikan (drag-drop, create batch, create delivery) dengan verdict jujur apakah itu bug app atau limitasi automation.

Task ini **functional smoke retest atas permintaan langsung owner**, **hanya di local Supabase stack**, bukan review kode.

---

## Context (wajib dibaca — jangan asumsikan histori percakapan)

- Project: **DSM MOS** (Manufacturing Order System). Stack: Supabase (Postgres + RLS + triggers + RPC) + TanStack Start/React + Tailwind + shadcn/ui.
- App dev: `bun run dev` → `http://localhost:8080/` (atau `127.0.0.1:8080`). Local stack: `supabase start`.
- Remote project ID (**JANGAN DISENTUH**): `jtzwawtfymljfqfrplib`. Semua kerja murni di local stack.
- Login: kredensial per-role diberikan owner saat run. Minimal butuh: 1 `admin`, 1 `viewer`, 1 `sales`.
- RBAC roles: `admin`, `sales`, `qc`, `production`, `production_planning`, `material`, `delivery`, `viewer`.

### Riwayat retest

| Ronde | Prompt | Report | Verdict |
|---|---|---|---|
| 1 | `tasks/codex-full-smoke-test-prompt.md` | `tasks/codex-full-smoke-test-report.md` | FAIL (coverage + BUG-1) |
| 2 | `tasks/codex-full-smoke-retest-prompt.md` | `tasks/codex-full-smoke-retest-report.md` | FAIL tapi naik (BUG-1 closed) |
| 3 | **file ini** | `tasks/codex-full-smoke-retest3-report.md` | — |

### Status bug masuk ronde 3

| Bug | Sev | Status masuk ronde 3 | Fix commit |
|---|---|---|---|
| BUG-1 | major | **CLOSED** ronde 2 (dashboard error state, 22.17s) — regression-check ringan saja | `2d86698` |
| BUG-2 | minor | fix terpasang, **belum diverifikasi** — 403 `auth/v1/logout?scope=global` di forced password-change | `07d0572` |
| BUG-3 | minor | fix terpasang, **belum diverifikasi** — bundle chunk >500 kB | `07d0572` |
| BUG-4 | minor (Codex sebut major) | fix terpasang, **belum diverifikasi** — viewer buka `/sales-orders/new` tidak redirect | `07d0572` |
| BUG-5 | major | fix terpasang, **belum diverifikasi** — list `/sales-orders`, `/material`, `/qc` "0 data" senyap saat request gagal | `07d0572` |
| BUG-6 | — | drag-and-drop Production tidak terbukti (automation `dragAttempt: "not_attempted"`) — **butuh pembuktian jujur** | — |
| BUG-7 | — | create batch via UI timeout di automation — **butuh pembuktian jujur** | — |
| BUG-8 | — | create delivery via UI tidak selesai di automation (detail transition PASS) — **butuh pembuktian jujur** | — |

### Isi fix `07d0572` (biar tahu apa yang harus kelihatan bekerja)

- `src/lib/query-timeout.ts` (baru) — `withQueryTimeout(signal, timeoutMs=10_000)`: gabung `AbortSignal` React Query + timeout lokal; request menggantung jadi reject, bukan `isLoading` selamanya.
- `use-dashboard-stats.ts`, `use-sales-orders.ts` (`useSalesOrders` + sub-query customers), `use-material-statuses.ts` (`useMaterialStatuses`), `use-inspections.ts` (`useQcActiveQueue` + `useQcHistory`) — semua pakai `.abortSignal(withQueryTimeout(signal))` + `retry: 1`.
- `/material` route + `/qc` route (tab Antrian & Riwayat) + `/sales-orders` list — render `<ErrorNotice>` (komponen shared, punya tombol "Coba lagi" + a11y live region) saat `isError`.
- `sales-orders.new.tsx` + `sales-orders.$id.edit.tsx` — `beforeLoad` guard: role selain `admin`/`sales` → `throw redirect({ to: "/sales-orders" })`.
- `change-password.tsx` — `supabase.auth.signOut({ scope: "local" })` (bukan default global).
- `vite.config.ts` — `manualChunks` pisah vendor (react/tanstack/radix/dnd-kit/supabase/forms). Main chunk target < 500 kB.

## Goal

1. Verifikasi **BUG-2, BUG-3, BUG-4, BUG-5** benar-benar tertutup di browser (regression check penuh).
2. Regression-check ringan **BUG-1** (jangan diulang detail — sudah PASS ronde 2).
3. Buktikan atau bantah **BUG-6, BUG-7, BUG-8** dengan usaha manual sungguh-sungguh (drag pointer beneran, tunggu dialog, dst) — dan nyatakan eksplisit: bug app / limitasi automation / butuh perbaikan.
4. Cek tidak ada **regresi** dari `07d0572` di area yang sudah PASS ronde 2 (Engineering, Material flow, QC core, Delivery detail transition, RBAC matrix).
5. Verdict baru + report.

## Persiapan

1. `git log --oneline -3` → pastikan `07d0572` (fix BUG-2/3/4/5) + `bd3e6a2` ada di working tree. Kalau belum, `git pull`.
2. `supabase db reset` (state migration bersih).
3. Seed: `supabase/seed-demo/20260823_demo_200_dataset.sql` via `psql` ke local stack.
4. Fixture `RETEST-` (SQL langsung, tandai jelas, cleanup di akhir) — siapkan minimal:
   - 1 production batch dengan step berstatus `running`/`pending` di kolom pertama Kanban (untuk drag-drop);
   - 1 QC inspection yang bisa didorong ke `reject`;
   - 1 SO lolos QC (ada `qc_inspections.status='pass'`) yang belum punya delivery (untuk create delivery via UI);
   - 1 engineering job berstatus `approved` + material `ready` (untuk create batch via UI).
5. `bun run dev` + `supabase status` sehat.
6. Quality gate (catat hasil, stop kalau ada FAIL):
   - `supabase test db`
   - `bunx tsc --noEmit`
   - `bun run lint` (37 warning `react-refresh/only-export-components` = sudah diketahui, OK)
   - `bun run build` — **catat ukuran chunk client terbesar** dan apakah warning `Some chunks are larger than 500 kB` muncul.

## Yang harus diuji

### A. BUG-3 — bundle size (paling cepat, lakukan duluan)

1. Dari output `bun run build`: apakah warning `Some chunks are larger than 500 kB` **masih muncul**?
2. Cari chunk client terbesar di `.output/public/assets/*.js` (bukan chunk yang jelas lazy seperti `jspdf`, `html2canvas`). Catat nama + ukuran (kB + gzip).
3. **Lulus** kalau: warning hilang DAN tidak ada chunk non-lazy > 500 kB. Baseline ronde 2: `index-*.js` 519.30 kB.

### B. BUG-2 — forced password-change logout 403

4. Buat user baru via `/admin` (role `viewer` cukup).
5. Login pertama kali sebagai user itu → auto-redirect ke `/change-password`.
6. Buka DevTools Network + Console **sebelum** submit.
7. Isi password baru (≥8 char) + konfirmasi → submit.
8. **Lulus** kalau: **tidak ada** request `auth/v1/logout?scope=global`, **tidak ada** `403`, **tidak ada** console error merah. Boleh ada `logout?scope=local` yang 200/204.
9. Lanjut: login dengan password baru → masuk `/dashboard` → reload → tidak loop balik ke `/change-password` (flag benar-benar clear).
10. Screenshot Network tab + Console.

### C. BUG-4 — viewer route guard `/sales-orders/new` + `/$id/edit`

11. Login `viewer`. Buka langsung URL `/sales-orders/new`.
12. **Lulus** kalau: URL berubah jadi `/sales-orders` (redirect), bukan tetap di `/sales-orders/new`.
13. Ulangi untuk `/sales-orders/<id-SO-yang-ada>/edit` → harus redirect ke `/sales-orders`.
14. Kontrol positif: login `sales` (atau `admin`) → `/sales-orders/new` → form **tetap terbuka** (guard tidak over-block).
15. Catat URL akhir tiap kasus + screenshot.

### D. BUG-5 — list error state (`/sales-orders`, `/material`, `/qc`)

Untuk tiap halaman: login role yang punya akses, buka halaman **normal** dulu (pastikan data tampil), lalu:

16. Di DevTools Network, **block** request REST tabel utama halaman itu:
    - `/sales-orders` → block `rest/v1/sales_orders*`
    - `/material` → block `rest/v1/material_statuses*`
    - `/qc` → block `rest/v1/qc_inspections*` (kena tab Antrian & Riwayat)
17. Reload halaman. Amati maksimal ~20 detik.
18. **Lulus** kalau, untuk tiap halaman:
    - dalam ≤ ~15 detik muncul **error notice** (komponen `<ErrorNotice>`: ikon + "Gagal memuat …" + tombol **"Coba lagi"**), **bukan** empty-state "0 data" / "Kosong" / "Antrian kosong" yang menyesatkan, **bukan** spinner selamanya;
    - klik "Coba lagi" saat masih diblock → tetap error (tidak nyangkut / tidak crash);
    - unblock request → klik "Coba lagi" → data termuat tanpa reload halaman.
19. Khusus `/qc`: pastikan **kedua** tab (Antrian & Riwayat) menampilkan error notice masing-masing.
20. Catat waktu aktual reload→error state per halaman + screenshot (error state + recovered).

### E. BUG-1 — regression ringan

21. Login admin, `/dashboard` normal → angka 3 view cocok (cross-check `v_dashboard_so_status` / `v_dashboard_material_waiting` / `v_dashboard_production_running` via query manual).
22. Block `rest/v1/v_dashboard_so_status*`, reload → dalam ~25 detik jadi error state + alert merah + tombol "Coba lagi"; unblock + retry → pulih tanpa reload. (Tidak perlu se-detail ronde 2 — cukup PASS/FAIL + waktu.)

### F. BUG-6 / BUG-7 / BUG-8 — buktikan atau bantah dengan sungguh-sungguh

Jangan menyerah di percobaan pertama. Kalau selector tidak ketemu, coba: scroll ke elemen, pakai koordinat pointer manual (mousedown → mousemove bertahap → mouseup), tunggu animasi/dialog dengan timeout lebih panjang, coba lewat keyboard kalau ada. Kalau tetap gagal, jelaskan **persis** apa yang dicoba dan di mana macet.

23. **BUG-6 — drag & drop Production** (`/production`):
    - Buka board, cari kartu step di kolom pertama (fixture `RETEST-` yang `running`).
    - Drag kartu ke kolom berikutnya (pointer drag beneran, `@dnd-kit`).
    - Ekspektasi: `StepOperatorDialog` muncul → wajib pilih `operator_id` (tombol konfirmasi disabled sebelum pilih) → simpan.
    - Verifikasi di DB: `production_batch_steps.status` + `operator_id` berubah sesuai.
    - Kalau drag benar-benar tidak bisa dilakukan via tooling: catat itu, **dan** uji jalur alternatif (tombol `Complete`/`Start` pada kartu) untuk memastikan transisi step tetap berfungsi — lalu nilai: apakah drag-drop wajib untuk demo atau tombol sudah cukup.
    - Realtime 2-tab: buka `/production` di 2 tab, ubah 1 step di tab A → tab B ikut update tanpa refresh. (Ronde 2 sudah PASS — konfirmasi ulang cepat.)
24. **BUG-7 — create batch via UI** (`/production-planning`):
    - Pilih engineering job `approved` + material `ready` (fixture `RETEST-`).
    - Klik tombol buat batch → dialog/form terbuka.
    - Pilih routing subset (mis. hanya `laser_cutting` + `assembly`, bukan semua step) → submit.
    - Verifikasi DB: `production_batches` baru dibuat + `production_batch_steps` yang terbentuk **persis sesuai routing yang dipilih**, bukan 5 step default.
    - Kalau tombol/dialog timeout: tunggu lebih lama, cek console error, cek apakah tombol disabled karena syarat tidak terpenuhi (job belum approved / material belum ready) — laporkan penyebab persisnya.
25. **BUG-8 — create delivery via UI** (`/delivery`):
    - Dari `/delivery`, klik "Rencana Baru" → dialog create.
    - Pilih SO yang lolos QC (fixture `RETEST-`) → pilih hasil QC `Lulus` → submit.
    - Verifikasi DB: `deliveries` baru + `delivery_items` terisi.
    - Lanjut transisi status delivery baru itu: draft → prepared → shipped → delivered → cek SO auto-completed. (Detail transition dari delivery yang di-seed sudah PASS ronde 2 — di sini yang diuji adalah **create dari UI**.)
    - Kalau dialog/selector timeout: tunggu lebih lama, cek apakah SO tidak muncul di selector karena filter (belum ada QC pass, sudah punya delivery, dll) — laporkan penyebabnya.

### G. Regresi cek cepat (area PASS ronde 2)

26. RBAC matrix role × menu — ulang cepat, konfirmasi tidak ada perubahan vs ronde 2 (khususnya: `sales`/`admin` masih bisa buka `/sales-orders/new`; menu sidebar per role tidak berubah).
27. Engineering: 1 transisi `assigned → in_progress` (gate) + progress lock 100 — masih jalan.
28. Material: 1 transisi `waiting_material → material_ready` — masih jalan.
29. QC: buka dialog inspeksi, validasi `qty_ok + qty_reject > qty_total` masih ditolak; Trigger Rework masih hanya muncul di status `reject`.
30. Console + Network sepanjang semua langkah: tidak ada uncaught error / 5xx tak terduga / request loop.

## Output yang diminta

Simpan report ke `tasks/codex-full-smoke-retest3-report.md`, format:

1. **Verdict**: PASS / PASS_WITH_MINOR / FAIL — + perbandingan eksplisit vs ronde 2.
2. **Ringkasan setup**: `git rev-parse HEAD`, cara seed + fixture `RETEST-` yang ditambahkan, hasil 4 quality gate (+ ukuran chunk terbesar).
3. **Status tiap bug** — tabel: BUG-1..8, severity, status akhir (CLOSED / STILL_OPEN / NOT_A_BUG / NEW), bukti singkat (waktu, angka, screenshot path).
4. **Detail per bug B–F**: PASS/FAIL + langkah yang dieksekusi + hasil aktual vs harapan + screenshot.
5. **BUG-6/7/8 — putusan jujur**: untuk masing-masing, salah satu: "terbukti berfungsi", "bug app nyata (severity X, repro)", atau "tidak bisa dibuktikan via tooling — ini yang dicoba: … ; rekomendasi verifikasi manual owner".
6. **Regresi**: ada / tidak ada — kalau ada, detail.
7. **RBAC matrix** role × menu (konfirmasi vs ronde 2).
8. **Bug baru** (kalau ada), per bug: severity, modul + route, repro, aktual vs harapan, screenshot.
9. **Saran perbaikan** (terpisah dari bug): UX/konsistensi/performa/aksesibilitas — dampak + effort. Tandai carry-over dari ronde 1/2 yang belum ditindaklanjuti (mis. `<ErrorNotice>` untuk board engineering/production/delivery/operators; code-split jspdf/gantt).
10. **Kesimpulan**: apakah aplikasi sekarang layak disertifikasi stabil untuk demo, dan/atau UAT/produksi; follow-up apa yang butuh keputusan owner.
11. **Cleanup**: hapus semua fixture `RETEST-`, jalankan `supabase test db` sekali lagi → konfirmasi balik 256/256 PASS di state bersih.

## Rules

- **Hanya local Supabase stack.** Jangan pernah mutasi remote `jtzwawtfymljfqfrplib`.
- **Jangan ubah kode** (`src/`, `vite.config.ts`) atau migration lama. Boleh menambah file seed/fixture/report baru saja.
- **Jangan perbaiki bug** apa pun yang ditemukan — cukup laporkan.
- Kalau BUG-2/3/4/5 **masih FAIL** setelah `07d0572` → temuan penting, laporkan detail persis (network trace, apakah `withQueryTimeout`/`retry`/`redirect`/`scope:local` kelihatan jalan di Network/behavior) dan kembalikan ke owner tanpa memperbaiki.
- Kalau login gagal / stack tidak sehat → hentikan, laporkan blocker.
- Kalau 1 modul crash total → catat, lanjut modul lain (kecuali auth).
- Jangan tinggalkan fixture `RETEST-` di DB setelah selesai — wajib cleanup + verifikasi `supabase test db` balik PASS.

---

## Prompt singkat versi sekali tempel

```text
Retest FULL SMOKE DSM MOS ronde 3 di LOCAL Supabase stack saja (jangan sentuh remote jtzwawtfymljfqfrplib). Jangan ubah kode/vite.config/migration; jangan perbaiki bug apa pun; boleh tambah file seed/fixture/report saja. Baseline: tasks/codex-full-smoke-retest-report.md (ronde 2, FAIL tapi naik, BUG-1 closed). Fix BUG-2/3/4/5 sudah di commit 07d0572: src/lib/query-timeout.ts withQueryTimeout + retry:1 di use-sales-orders/use-material-statuses/use-inspections; <ErrorNotice> di route /material /qc(2 tab) /sales-orders; beforeLoad redirect di sales-orders.new + $id.edit untuk role non admin/sales; change-password signOut scope:"local"; vite.config manualChunks pisah vendor. Persiapan: git log pastikan 07d0572 + bd3e6a2 ada, `supabase db reset`, seed supabase/seed-demo/20260823_demo_200_dataset.sql, tambah fixture RETEST- (1 batch step running di kolom pertama Kanban, 1 QC bisa di-reject, 1 SO lolos QC belum punya delivery, 1 eng job approved+material ready), `bun run dev`, jalankan `supabase test db` + `bunx tsc --noEmit` + `bun run lint` + `bun run build` (CATAT ukuran chunk client terbesar + apakah warning >500kB muncul). Lalu uji: (A) BUG-3 — build tidak lagi warning >500kB dan tidak ada chunk non-lazy >500kB (baseline 519kB). (B) BUG-2 — buat user via /admin, first login -> /change-password, submit password baru, PASTIKAN tidak ada request auth/v1/logout?scope=global, tidak ada 403, tidak ada console error merah; login ulang password baru -> /dashboard -> reload tidak loop. (C) BUG-4 — login viewer, buka /sales-orders/new dan /sales-orders/<id>/edit -> harus redirect ke /sales-orders; kontrol positif login sales/admin -> /sales-orders/new form tetap terbuka. (D) BUG-5 — untuk /sales-orders (block rest/v1/sales_orders*), /material (block material_statuses*), /qc (block qc_inspections*, kena 2 tab): buka normal dulu, block, reload, PASTIKAN dalam ~15 detik muncul <ErrorNotice> "Gagal memuat..." + tombol "Coba lagi" (BUKAN "0 data"/"Antrian kosong"/spinner selamanya), retry saat block tetap error tanpa crash, unblock+retry -> data muncul tanpa reload; catat waktu aktual + screenshot. (E) BUG-1 regression ringan — block v_dashboard_so_status*, reload -> error state + "Coba lagi" dalam ~25 detik, unblock+retry pulih; PASS/FAIL + waktu saja. (F) BUG-6/7/8 buktikan SUNGGUH-SUNGGUH (jangan nyerah percobaan pertama, pakai pointer drag manual/koordinat, tunggu dialog lebih lama): BUG-6 drag kartu step /production ke kolom berikutnya -> StepOperatorDialog wajib operator -> simpan -> verifikasi DB status+operator_id; kalau drag benar2 tak bisa via tooling, catat persis + uji tombol Complete/Start sebagai alternatif + nilai apakah drag wajib untuk demo; realtime 2-tab konfirmasi cepat. BUG-7 /production-planning buat batch dari eng job approved+material ready, pilih routing subset -> verifikasi production_batch_steps DB persis sesuai routing (bukan 5 default); kalau timeout catat penyebab (console error / tombol disabled / syarat tak terpenuhi). BUG-8 /delivery "Rencana Baru" -> pilih SO lolos QC + hasil QC Lulus -> submit -> verifikasi deliveries + delivery_items DB, lalu transisi draft->prepared->shipped->delivered -> SO auto-completed; kalau selector timeout catat kenapa SO tidak muncul. (G) Regresi cek cepat: RBAC matrix role x menu vs ronde 2, Engineering assigned->in_progress + lock 100, Material waiting->ready, QC validasi qty_ok+qty_reject>qty_total ditolak + Trigger Rework hanya di reject, console+network bersih. Outputkan report ke tasks/codex-full-smoke-retest3-report.md: verdict + perbandingan vs ronde 2, ringkasan setup (HEAD + fixture + chunk size), tabel status BUG-1..8 (CLOSED/STILL_OPEN/NOT_A_BUG/NEW + bukti), detail per bug B-F, putusan JUJUR BUG-6/7/8 (terbukti berfungsi / bug app nyata / tidak bisa dibuktikan via tooling + apa yang dicoba + rekomendasi manual), regresi ada/tidak, RBAC matrix, bug baru per severity, saran perbaikan (dampak+effort, tandai carry-over), kesimpulan kesiapan demo/UAT + follow-up owner, konfirmasi cleanup fixture RETEST- + supabase test db balik 256/256 PASS. Kalau BUG-2/3/4/5 masih FAIL setelah 07d0572, laporkan detail persis dan kembalikan ke owner tanpa memperbaiki. Kalau login gagal atau stack tidak sehat, hentikan dan laporkan blocker.
```
