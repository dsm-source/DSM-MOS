# Task Fix — Item Out-of-Scope Setelah BUG-2R4 CLOSED

Sumber: `tasks/codex-bug2-bug8-retest-report.md` §5, §9.5, §9.6 dan
`tasks/codex-full-smoke-retest3-report.md` §follow-up.

Setelah BUG-2 (notifications-401) dan BUG-8 (delivery QC-pass) CLOSED, tersisa
beberapa item yang belum ditangani. Task ini memecahnya jadi fix-fix kecil dan
independen. **Kerjakan hanya di local Supabase stack.** Remote
`jtzwawtfymljfqfrplib` jangan disentuh.

Kredensial local: admin `test@dsm.com` / `admin 1234`. Role lain tidak punya akun
siap-login — buat via `/admin` (prefix `codex-fix-`) lalu cleanup.

Urutan eksekusi yang disarankan: **T1 → T2 → T3 → T4 → T5**. T1–T3 patch surgical
kecil; T4 investasi automation; T5 verifikasi manual opsional.

---

## T1 — Sidebar: Engineering menu pakai `ALL_ROLES`

**Severity:** minor (kosmetik menu; akses data tetap dijaga RLS + route guard).

**Lokasi:** `src/components/app-sidebar.tsx:86-101`

**Masalah:** grup **Engineering** ("Engineering Job" + "Engineering Workload")
memakai `roles: ALL_ROLES`, jadi semua role (`delivery`, `viewer`, `sales`, `qc`,
`material`, dst.) melihat menu Engineering. Grup lain sudah eksplisit
(mis. "Bahan" hanya `admin/material/viewer`). Report retest §5 mencatat browser
run menunjukkan `deliveryHasEngineeringMenu=false` — kontradiksi dengan source,
kemungkinan run itu build lama.

**Yang harus diputuskan owner dulu (blocker):**
Source-of-truth untuk visibilitas menu = dokumen sidebar-matrix atau
`app-sidebar.tsx`? Dan role mana yang seharusnya melihat menu Engineering?

**Fix (setelah keputusan owner):**

1. Ganti `roles: ALL_ROLES` pada kedua item Engineering dengan daftar eksplisit
   sesuai matrix (dugaan default:
   `["admin", "engineering", "production_planning", "viewer"]` — konfirmasi ke
   owner).
2. Cek route guard `src/routes/_authenticated/engineering*.tsx` konsisten dengan
   daftar role baru. Kalau route belum membatasi role dan memang harus, tambah
   guard; kalau route sengaja terbuka untuk semua, cukup menu yang dibatasi —
   catat alasannya di komentar.
3. Jangan refactor `groups` / `visibleGroups` di luar perubahan ini.

**Acceptance:**

- [ ] Login sebagai `delivery` / `qc` / `material` → menu "Engineering" tidak
      muncul di sidebar (atau muncul, jika itu keputusan owner — sesuai matrix).
- [ ] Login sebagai role yang berhak → menu Engineering muncul dan route
      `/engineering` render normal.
- [ ] `bunx tsc --noEmit`, `bun run lint`, `bun run build` PASS.
- [ ] Unit test kecil untuk `visibleGroups` per role (opsional tapi disarankan)
      di `src/components/app-sidebar.test.tsx`.

### T1 — VERDICT 2026-09-01: CLOSED, bukan bug (tanpa perubahan kode)

Owner memilih "tutup tanpa perubahan". Bukti:

- `docs/PRD.md:233` §11 poin 6: **"Engineering Workload dashboard terbuka semua
  peran — ✓ Final, Tidak berubah sejak v2."**
- `docs/PRD.md:131`: `v_engineering_workload` SELECT **semua peran** (transparansi
  lintas-divisi).
- `docs/PRD.md:165-167`: `engineering_jobs`, `engineering_job_history`,
  `v_engineering_workload` semuanya SELECT untuk **semua peran**.
- `tasks/todo.md:14` M0.4: guard `engineering.workload` sengaja dibuka ke semua
  peran; `tasks/todo.md:30,33` M2.2/M2.6 "akses semua peran".
- Route: `src/routes/_authenticated/engineering.tsx` = `<Outlet>` polos, tidak ada
  role guard — konsisten dengan "semua peran".

Jadi `roles: ALL_ROLES` pada kedua item Engineering di `src/components/app-sidebar.tsx:92,98`
**benar dan disengaja**. Observasi `deliveryHasEngineeringMenu=false` di
`codex-bug2-bug8-retest-report.md` §5 kemungkinan hasil build lama / snapshot
sidebar-matrix draft yang tidak lagi jadi source-of-truth. Tidak ada perubahan
kode. `visibleGroups` unit test tetap boleh ditambah kapan pun sebagai
regression-guard, tapi tidak wajib untuk T1.

---

## T2 — Seed demo tidak punya notifikasi unread

**Severity:** minor (menghalangi verifikasi, bukan bug produk).

**Lokasi:** `supabase/seed-demo/20260823_demo_200_dataset.sql`

**Masalah:** seed demo tidak membuat satu row `notifications` pun. Akibatnya
retest bell (report §9.4) hanya bisa membuktikan endpoint `200 OK` + empty state;
tombol "Tandai semua dibaca" selalu disabled karena `unread = 0`, jadi jalur
mark-all-read tidak pernah teruji.

**Fix:**

1. Tambah blok di akhir seed demo: 2–3 row `notifications` dengan
   `read_at IS NULL` untuk user demo yang dipakai retest (admin). Ikuti kolom
   aktual tabel `notifications` (cek `supabase/migrations/` untuk skema — jangan
   asumsikan). Pakai UUID statik dengan prefix konsisten (mis.
   `d0000000-...`) supaya idempoten / gampang di-cleanup.
2. Kalau ada trigger/RPC yang biasanya membuat notifikasi (mis. saat SO dibuat),
   pertimbangkan memanggil jalur itu daripada INSERT manual, supaya bentuk data
   realistis. Kalau tidak ada, INSERT manual cukup.

**Acceptance:**

- [ ] `supabase db reset` + seed demo → login admin → bell menampilkan badge
      count > 0 dan daftar notifikasi terisi.
- [ ] Klik "Tandai semua dibaca" → request `PATCH /rest/v1/notifications` 2xx →
      badge jadi 0, list ter-update, 0 console error.
- [ ] `supabase test db` PASS (Files=10, Tests=256 atau lebih kalau menambah
      test).

### T2 — TEMUAN 2026-09-01: premис salah, seed SUDAH menghasilkan notifikasi

Analisis statik (`supabase/migrations/20260722054316_*.sql:105-175` +
`supabase/seed-demo/20260823_demo_200_dataset.sql:164-405`):

1. Trigger `sales_orders_notify_on_status_change()` meng-INSERT notifikasi ke
   **semua admin** (`user_roles.role = 'admin'`) pada setiap perubahan status SO,
   kecuali actor (`auth.uid()`).
2. Seed demo mengubah status ~200 SO lewat trigger itu. Blok "confirmed"
   (baris 167) memakai actor `...002` (demo-admin) → demo-admin dikecualikan di
   langkah itu. Tapi blok berikutnya — engineering (`...003`), material
   (`...004`), planning (`...005`), production (`...006`), qc (`...007`),
   delivery (`...008`) — semuanya actor **non-admin**, jadi setiap transisi
   itu meng-INSERT notifikasi unread untuk demo-admin `...002`.
3. Kesimpulan: `demo-admin@dsm-mos.local` (`40000000-0000-0000-0000-000000000002`)
   **sudah punya ratusan row `notifications` unread** setelah seed. Premis T2
   ("seed demo tidak membuat satu row notifications pun") tidak akurat.
4. Retest `codex-bug2-bug8-retest-report.md` §9.4 melihat empty state karena
   login sebagai `test@dsm.com` (admin fixture buatan manual, `user_id` beda),
   **bukan** `demo-admin`. Notifikasi ada, hanya di user yang salah.

Gap sebenarnya = **prosedur retest**, bukan data seed. Opsi penutupan T2:

- **(A)** Seed beri password ke `demo-admin@dsm-mos.local` (seed local-only,
  bukan isu keamanan) → tester login sebagai demo-admin yang sudah punya
  notifikasi. Kontradiksi ringan dengan komentar seed "not meant to be logged
  into", tapi paling kecil perubahannya dan 0 data redundan.
- **(B)** Tambahkan ~3 row `notifications` unread eksplisit (prefix UUID
  `d0000000-…`) untuk `...002` di akhir seed — redundan dengan yang sudah
  di-generate trigger, tapi deterministik & gampang di-assert/cleanup.
- **(C)** Ubah prosedur retest: setelah bikin admin fixture, jalankan
  `INSERT INTO user_roles` **atau** re-assign beberapa notifikasi ke user
  fixture itu.

**BLOCKER: butuh keputusan owner A / B / C sebelum patch T2.**

---

## T3 — BUG-6: Drag-and-drop Kanban Production belum terbukti

**Severity:** major untuk requirement DnD; minor untuk core flow (tombol action
+ dialog konfirmasi sudah terbukti bekerja di 3 ronde).

**Lokasi:**
- `src/features/production/components/production-board.tsx:103-109` (sensors),
  `:204-214` (`handleDragEnd`)
- `src/features/production/components/batch-card.tsx:76-134` (draggable + handle)
- `src/features/production/lib/board-columns.ts:31-52`
  (`isDraggable`, `canDropOn`, `nextColumnFor`)

**Analisis kode (belum tentu ada bug):**

1. `isDraggable` hanya `true` bila active step berstatus `running` **atau**
   `paused` **dan** tidak ada `computeStartBlocker`. Kalau tidak, handle
   `GripVertical` **tidak dirender** sama sekali. Fixture ronde 3
   (`RETEST3-PROD-DRAG-BATCH` di kolom "Laser Cutting") kemungkinan besar
   active step-nya belum `running` → kartu memang tidak bisa diseret. Ini bisa
   jadi **penyebab utama** "drag tidak melakukan apa-apa", bukan bug DnD.
2. `handleDragEnd` yang sukses **tidak memindahkan kartu** — ia `setPending(...)`
   yang membuka dialog konfirmasi "Selesaikan tahapan?". Jadi expected behavior
   drag = buka dialog, bukan kartu langsung pindah kolom.
3. `canDropOn` hanya mengizinkan drop ke `nextColumnFor(batch)` (tepat satu
   kolom). Drop ke kolom lain → toast error "Batch hanya bisa dipindahkan ke
   tahapan berikutnya".
4. Synthetic mouse-drag Playwright (`mouse.move`→`down`→`up`) sering gagal
   memicu dnd-kit `PointerSensor` (`activationConstraint.distance: 6`) karena
   butuh rangkaian `pointermove` bertahap.

**Fix / tindakan:**

1. **Konfirmasi ke owner** apakah alur `drag → dialog konfirmasi → confirm →
   transisi` memang yang diinginkan. Kalau ya, BUG-6 kemungkinan bukan bug —
   tester salah menyiapkan fixture / salah interpretasi. Tutup dengan bukti.
2. **Perbaiki cara verifikasi** (bukan patch produk kalau kode benar):
   - Siapkan fixture batch dengan active step **sudah `running`** dan tanpa
     blocker, di kolom yang punya `nextColumnFor` valid.
   - Uji via `KeyboardSensor` (deterministik): fokus handle → `Space` →
     `ArrowRight` → `Space` → assert dialog konfirmasi muncul → confirm →
     assert DB transition.
   - Atau pointer drag bertahap: loop `mouse.move` dengan step kecil + delay.
3. **Kalau ternyata ada bug nyata** (mis. handle tidak menerima event, dialog
   tak muncul walau fixture benar): patch di layer yang salah — kemungkinan
   `batch-card.tsx` (listeners di `<button>` handle) atau `handleDragEnd`.
   Jangan refactor board.

**Acceptance:**

- [ ] Ada bukti reproducible (screenshot + trace) drag/keyboard-drag pada
      fixture yang benar → dialog konfirmasi muncul → confirm → step transition
      tercatat di DB.
- [ ] Gate QC / operator dialog tetap dihormati saat transisi via drag (tidak
      bypass).
- [ ] Drop ke kolom non-next → toast error, tidak ada transisi.
- [ ] Verdict jelas di report: "BUG-6 CLOSED (kode benar, fixture ronde 3 salah)"
      atau "BUG-6 fix di commit X".

### T3 — INVESTIGASI 2026-09-01: analisis kode selesai, verifikasi browser PENDING

Analisis statik mengonfirmasi hipotesis task file — **belum ada bug yang terbukti**:

- `src/features/production/lib/board-columns.ts:31-37` `isDraggable`: hanya `true`
  bila `activeStep.status ∈ {running, paused}` **dan** `computeStartBlocker` null.
- `src/features/production/components/batch-card.tsx:76,119` handle `GripVertical`
  hanya dirender kalau `draggable === (canWrite && isDraggable(batch))`. Batch
  dengan active step `waiting` → **tidak ada elemen untuk diseret**. Ini
  penjelasan paling mungkin untuk "drag tidak melakukan apa-apa" di ronde 3
  (fixture `RETEST3-PROD-DRAG-BATCH` di kolom Laser Cutting kemungkinan
  active step belum `running`).
- `src/features/production/components/production-board.tsx:207-214` `handleDragEnd`
  yang sukses **tidak memindah kartu** — memanggil `setPending(...)` yang membuka
  dialog "Selesaikan tahapan?". Jadi expected behaviour drag = buka dialog
  konfirmasi, bukan kartu pindah kolom.
- `production-board.tsx:103-108` `useSensors` **sudah** menyertakan
  `KeyboardSensor`, jadi keyboard-drag deterministik bisa dipakai untuk verifikasi.
- `canDropOn` (`board-columns.ts:51`) hanya izinkan `nextColumnFor(batch)`; target
  lain → `handleDragEnd` toast `"Batch hanya bisa dipindahkan ke tahapan
  berikutnya"`, 0 transisi.
- Gate QC/operator: dialog konfirmasi memanggil `runComplete` →
  `update.mutateAsync({ status: "completed" })` — **jalur mutation yang sama**
  dengan tombol aksi. Gate ditegakkan trigger DB (PRD §M5 business rule #1), jadi
  drag tidak mem-bypass gate.

**Verdict sementara: BUG-6 kemungkinan besar CLOSED (kode benar, fixture ronde 3
salah siap).** Konfirmasi final butuh 1 langkah verifikasi browser:

Fixture yang dibutuhkan: batch produksi dengan active step berstatus `running`,
tanpa start-blocker (`engineering_jobs.status='approved'` +
`material_statuses.status='material_ready'` + step sebelumnya `completed`), di
kolom proses yang punya `nextColumnFor` valid (mis. step 1 Laser Cutting running,
step 2 aktif). Lalu: fokus handle `GripVertical` → `Space` → `ArrowRight` →
`Space` → assert dialog "Selesaikan tahapan?" muncul → confirm → assert
`production_batch_steps` step lama `completed` di DB. Ulangi drop ke kolom
non-next → assert toast error + 0 transisi.

**BLOCKER lingkungan:** `supabase start` untuk project ini gagal — port 54321-54327
sudah dipakai project lokal lain (`supabase_*_DSM_SALES_WEB_APP_V2`). Perlu
`supabase stop` project itu dulu (atau jalankan verifikasi di mesin/کontainer
bersih) sebelum langkah browser T3 bisa dijalankan.

---

## T4 — E2E automation untuk 3 flow yang berulang di-retest manual

**Severity:** minor (proses), impact tinggi (menghilangkan siklus retest manual).

**Masalah:** BUG-2 / BUG-6 / BUG-8 sudah di-retest manual berkali-kali tiap
ronde. Tidak ada E2E test permanen, jadi regresi hanya ketahuan lewat UAT manual.

**Fix:** buat suite Playwright E2E (cek dulu apakah project sudah punya setup
Playwright; kalau belum, tambah minimal config + satu spec file — jangan
over-engineer). Cakup 3 skenario:

1. **Forced password-change** (BUG-2): admin buat viewer → viewer login temp
   password → `/change-password` → submit → assert: 0 request `auth/v1/logout`,
   0 request `/rest/v1/notifications*` setelah submit, 0 response 401/403, toast
   "Kata sandi berhasil diganti" terlihat, redirect `/auth`, re-login tidak
   loop.
2. **Delivery QC-pass eligibility** (BUG-8): role `delivery` → `/delivery` →
   buat rencana dari SO fixture QC-pass → dropdown kandidat terisi (bukan empty
   state) → tambah item → transisi `draft → prepared → shipped → delivered`
   tanpa 4xx/5xx.
3. **Production DnD + gate** (BUG-6): pakai temuan T3 (keyboard-drag pada fixture
   `running`) → dialog konfirmasi → transisi → gate QC/operator dihormati.

**Acceptance:**

- [ ] `<runner> test` (mis. `bunx playwright test`) menjalankan ketiga spec dan
      semua PASS terhadap local stack yang sudah di-seed.
- [ ] Dokumentasikan cara menjalankannya di `README` atau `tasks/` (prasyarat:
      `supabase start`, seed demo, `bun run dev`).
- [ ] Tidak menambah dependency berat di luar `@playwright/test`.

---

## T5 — Production realtime multi-tab (di-skip sejak ronde 3)

**Severity:** rendah — kerjakan hanya kalau demo mensyaratkan kolaborasi live.

**Fix / tindakan:** verifikasi manual 2 browser context:
user A menyelesaikan sebuah step → user B melihat kartu berpindah kolom tanpa
reload (via Supabase realtime subscription pada `production_batch_steps` /
`production_batches`). Cek juga tidak ada memory leak / channel bocor saat
navigate keluar-masuk `/production`.

**Acceptance:**

- [ ] Catat hasil di report: PASS/FAIL + screenshot 2 tab.
- [ ] Kalau FAIL, buka bug baru dengan repro; jangan patch di task ini.

---

## Gate wajib sebelum tiap fix dianggap selesai

| Gate | Perintah |
|---|---|
| Type check | `bunx tsc --noEmit` |
| Lint | `bun run lint` (37 warning `react-refresh/only-export-components` sudah diketahui, boleh) |
| Build | `bun run build` |
| DB tests | `supabase test db` |

Commit per task (T1, T2, ...) terpisah. Pesan commit English, akhiri dengan
`Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
