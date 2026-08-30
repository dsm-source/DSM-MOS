# UI/UX Audit Remediation — Task Detail

> Ringkasan cepat ada di `tasks/ui-ux-audit-plan.md`. File ini: acceptance criteria +
> file per task. Jangan mulai fase berikutnya sebelum checkpoint fase saat ini lolos.
> Verifikasi standar tiap task: `bun run build` hijau, `bun run lint` bersih.

---

## Phase 1 — Quick Wins

### ✅ Task 1: `lang="id"` + lokalisasi 404/error pages
**Deskripsi:** App 100% bahasa Indonesia tapi `<html lang="en">`; halaman 404 & error
berbahasa Inggris dan pakai `<button>`/`<a>` tangan sendiri, bukan komponen `Button`.

**Acceptance criteria:**
- [x] `<html lang="id">` di `RootShell`
- [x] `NotFoundComponent` & `ErrorComponent` teks Indonesia
- [x] Kedua halaman pakai komponen `Button` (`asChild` untuk link) alih-alih kelas manual

**Verification:** buka route ngawur → 404 Indonesia; lempar error di route → halaman error Indonesia, tombol konsisten dengan app.
**Dependencies:** None
**Files:** `src/routes/__root.tsx`
**Scope:** S

### ✅ Task 2: Hapus double padding & samakan spacing shell
**Deskripsi:** `<main className="p-6">` di layout, tapi beberapa route (mis.
`sales-orders.index.tsx`) membungkus lagi `p-6` → 48px. Spacing vertikal campur
(`space-y-6` vs `space-y-4`).

**Acceptance criteria:**
- [x] Tidak ada route `_authenticated/*` yang menambah padding luar sendiri (grep `p-6` di root div route = 0)
- [x] Kontainer halaman pakai `space-y-6` konsisten
- [x] Judul halaman seragam: `text-2xl font-semibold tracking-tight`

**Verification:** buka Dashboard, Sales Order, Engineering, Produksi berturut — gutter kiri/atas identik.
**Dependencies:** None
**Files:** semua `src/routes/_authenticated/*.tsx` (edit ringan per file)
**Scope:** M

### ✅ Task 3: Sidebar active state prefix match + dokumentasi bahasa
**Deskripsi:** `active = pathname === item.url` → `/sales-orders/123` tidak menyorot
"Sales Order". Ganti ke prefix match (hati-hati `/engineering` vs `/engineering/workload`).

**Acceptance criteria:**
- [x] Route detail/edit menyorot item induk yang benar
- [x] `/engineering/workload` menyorot "Engineering Workload", bukan juga "Engineering"
- [x] Komentar singkat di `app-sidebar.tsx` soal keputusan penamaan (menunggu Task 8)

**Verification:** klik ke detail SO, batch produksi, job engineering — item sidebar benar.
**Dependencies:** None
**Files:** `src/components/app-sidebar.tsx`
**Scope:** S

### ✅ Task 4: Bersihkan copy usang & label tak konsisten
**Acceptance criteria:**
- [x] Hapus/ubah catatan dashboard "Kartu Antrian QC dan Siap Kirim akan muncul setelah modul QC & Delivery dibangun" (route sudah ada)
- [x] Label aksi buat SO seragam ("SO Baru" vs "Buat SO Baru" → pilih satu)
- [x] Cek `module-placeholder.tsx` masih terpakai; kalau tidak, catat di komentar (jangan hapus tanpa konfirmasi)

**Verification:** grep string usang = 0; scan visual dashboard + list SO.
**Dependencies:** None
**Files:** `src/routes/_authenticated/dashboard.tsx`, `src/routes/_authenticated/sales-orders.index.tsx`
**Scope:** S

### ✅ Task 5: `aria-label` dinamis badge notifikasi + audit tombol ikon
**Acceptance criteria:**
- [x] `NotificationsBell` trigger `aria-label={`Notifikasi, ${unread} belum dibaca`}` (fallback "Notifikasi" saat 0)
- [x] Audit semua `size="icon"` Button di app punya `aria-label` (target ≥ semua icon-only)
- [x] Panah pagination punya label ("Halaman sebelumnya" / "Halaman berikutnya")

**Verification:** screen reader / axe DevTools pada header + list SO → tidak ada icon-button tanpa nama.
**Dependencies:** None
**Files:** `src/components/notifications-bell.tsx`, `src/routes/_authenticated/sales-orders.index.tsx`, grep hasil audit
**Scope:** S

### ✅ Checkpoint 1
- [x] build + lint hijau
- [x] `/sales-orders/<id>` → sidebar "Sales Order" aktif
- [x] Padding luar seragam semua route
- [x] axe: 0 pelanggaran "button has no accessible name" di header & list SO

---

## Phase 2 — Shared Shell Components

### ✅ Task 6: Komponen `PageHeader` + migrasi semua route
**Deskripsi:** Judul + deskripsi + slot aksi diulang di tiap route dengan style
sedikit beda. Satukan.

**Acceptance criteria:**
- [x] `src/components/page-header.tsx`: props `title`, `description?`, `actions?` (children slot kanan)
- [x] Semua route `_authenticated/*` memakainya; tidak ada `<h1 className="text-2xl` lepas tersisa
- [x] `<h1>` tetap satu per halaman; deskripsi `text-sm text-muted-foreground`

**Verification:** grep `text-2xl font-semibold` di routes hanya muncul di `page-header.tsx`.
**Dependencies:** Task 2
**Files:** `src/components/page-header.tsx` + semua route (boleh dipecah per modul)
**Scope:** L (pecah jadi sub-PR per modul bila perlu; build hijau tiap langkah)

### ✅ Task 7: Komponen `EmptyState`
**Acceptance criteria:**
- [x] `src/components/empty-state.tsx`: `icon`, `title`, `description?`, `action?`
- [x] Dipakai di: dashboard "Belum ada Sales Order", kanban "Belum ada batch produksi", list SO kosong, notifikasi kosong
- [x] `role="status"` pada container

**Verification:** kosongkan filter agar list kosong → tampil ikon + heading + helper + tombol aksi.
**Dependencies:** None
**Files:** `src/components/empty-state.tsx`, `dashboard.tsx`, `kanban-board.tsx`, `sales-orders.index.tsx`, `notifications-bell.tsx`
**Scope:** M

### ✅ Task 8: Lokalisasi + grup navigasi sidebar
**Acceptance criteria:**
- [x] Label diputuskan konsisten (default: "Pelanggan", "Bahan", "Perencanaan Produksi", "Produksi", "Pengiriman", "Jadwal Pengiriman", "Kelola User"; "Dashboard" & "QC" tetap)
- [x] Item dikelompokkan `SidebarGroup`: Penjualan / Engineering / Produksi / Logistik / Admin
- [x] Filter peran per item tetap berfungsi; grup kosong tidak dirender

**Verification:** login sebagai tiap peran → grup & item yang tampil sesuai; label konsisten Indonesia.
**Dependencies:** Task 3
**Files:** `src/components/app-sidebar.tsx`
**Scope:** S

### ✅ Task 9: Breadcrumb di header shell
**Acceptance criteria:**
- [x] Header menampilkan breadcrumb dari route aktif (mis. Sales Order › SO-2026-0001 › Edit)
- [x] Pakai `src/components/ui/breadcrumb.tsx` yang sudah ada
- [x] Segmen non-terakhir adalah link; terakhir `aria-current="page"`
- [x] Mobile: breadcrumb collapse / truncate, tidak mendorong aksi header keluar

**Verification:** navigasi list → detail → edit, breadcrumb update & link berfungsi.
**Dependencies:** Task 8
**Files:** `src/routes/_authenticated/route.tsx`, mungkin helper kecil untuk label per route
**Scope:** M

### ✅ Task 10: Reset focus saat perpindahan route
**Acceptance criteria:**
- [x] Setelah navigasi, focus pindah ke `<main>` (atau `<h1>`) tujuan
- [x] Tidak mencuri focus saat interaksi dalam halaman yang sama
- [x] `<main>` punya `tabIndex={-1}` + `id` untuk skip-link masa depan

**Verification:** keyboard-only: klik link nav, tekan Tab → fokus mulai dari konten baru, bukan elemen lama.
**Dependencies:** None
**Files:** `src/routes/_authenticated/route.tsx`
**Scope:** S

### ✅ Checkpoint 2
- [x] Semua route pakai `PageHeader`
- [x] Breadcrumb benar di detail & edit
- [x] Focus reset terverifikasi keyboard
- [x] build + lint hijau

---

## Phase 3 — Navigation State & Polish

### ✅ Task 11: Filter/pagination Sales Order → search params
**Acceptance criteria:**
- [x] `page`, `status`, `search` dibaca/ditulis via `Route` search params (validasi schema)
- [x] Refresh & share URL mempertahankan state
- [x] Ganti filter me-reset `page` ke 1

**Verification:** buka `/sales-orders?status=production&page=2`, refresh → tetap; ubah status → `page=1`.
**Dependencies:** None
**Files:** `src/routes/_authenticated/sales-orders.index.tsx` (+ route def)
**Scope:** M

### ✅ Task 12: Pagination sungguhan
**Acceptance criteria:**
- [x] Prev/Next benar-benar disabled (bukan cuma `aria-disabled`) di batas
- [x] Tampilkan "Halaman X dari Y · N data"
- [x] Tidak ada `href="#"` yang bisa diklik saat disabled

**Verification:** di halaman 1 Prev tidak bisa diklik/fokus-aktif; di halaman akhir Next mati.
**Dependencies:** Task 11
**Files:** `src/routes/_authenticated/sales-orders.index.tsx`
**Scope:** S

### ✅ Task 13: Debounce search + tombol clear
**Acceptance criteria:**
- [x] Search live dengan debounce ~300ms (hapus pola onBlur/Enter-only)
- [x] Tombol clear (×) muncul saat ada teks, reset search + `page=1`
- [x] Indikator loading halus saat query berjalan

**Verification:** ketik → hasil ter-update tanpa Enter; klik × → list penuh kembali.
**Dependencies:** Task 11
**Files:** `src/routes/_authenticated/sales-orders.index.tsx`
**Scope:** S

### ✅ Task 14: Konfirmasi sign-out
**Acceptance criteria:**
- [x] Tombol "Keluar" pindah ke `DropdownMenu` di bawah email user
- [x] Aksi keluar minta konfirmasi (`AlertDialog`) sebelum clear cache + signOut
- [x] Batal = tidak ada efek

**Verification:** klik email → menu → Keluar → dialog → Batal (tetap login) / Konfirmasi (ke `/auth`).
**Dependencies:** None
**Files:** `src/routes/_authenticated/route.tsx`
**Scope:** S

### ✅ Task 15: Skeleton transisi route + `StatCard` konsisten
**Acceptance criteria:**
- [x] Fallback `<Suspense>` Outlet bukan teks "Memuat..." polos — skeleton generik selaras layout
- [x] `StatCard` loading pakai `<Skeleton>`, bukan string `"…"`

**Verification:** throttle jaringan, pindah route → skeleton, bukan teks kosong; dashboard load → skeleton kartu.
**Dependencies:** None
**Files:** `src/routes/_authenticated/route.tsx`, `src/routes/_authenticated/dashboard.tsx`
**Scope:** S

### ✅ Task 16: Wire dark mode
**Acceptance criteria:**
- [x] Default ikut `prefers-color-scheme`; toggle manual di header (atau menu user) meng-override
- [x] Pilihan persist di `localStorage`, diterapkan sebelum first paint (no flash)
- [x] Smoke test tiap route di mode gelap: teks terbaca, tidak ada elemen "hilang"; catat sisa masalah kontras di Fase 4

**Verification:** toggle → seluruh app gelap; reload → tetap gelap; DevTools emulate `prefers-color-scheme: dark` tanpa pilihan tersimpan → gelap.
**Dependencies:** Task 9 (header sudah punya slot aksi)
**Files:** `src/routes/__root.tsx` atau `route.tsx`, komponen toggle kecil, mungkin inline script di `RootShell`
**Scope:** M

### ✅ Task 17: Aksesibilitas Kanban drag
**Acceptance criteria:**
- [x] Tambah `KeyboardSensor` + `TouchSensor` ke `useSensors`
- [x] Drag bisa diselesaikan via keyboard (space untuk angkat, arrow, space untuk jatuhkan)
- [x] `DndContext` punya `accessibility.announcements` dasar (Indonesia)
- [x] Tombol aksi fallback tetap ada

**Verification:** keyboard-only pindahkan satu batch antar status; VoiceOver mengumumkan perubahan.
**Dependencies:** None
**Files:** `src/features/production/components/kanban-board.tsx`
**Scope:** M

### ✅ Task 18: Responsif tabel Sales Order di mobile
**Acceptance criteria:**
- [x] Di bawah `sm`: baris tampil sebagai kartu bertumpuk (No. SO + Status menonjol), bukan scroll horizontal 7 kolom
- [x] `sm` ke atas: tabel seperti sekarang
- [x] Tidak ada horizontal scroll pada `<body>` di 320px

**Verification:** viewport 320 & 375 → daftar SO terbaca sebagai kartu; 768+ → tabel.
**Dependencies:** Task 11
**Files:** `src/routes/_authenticated/sales-orders.index.tsx` (mungkin sub-komponen `SalesOrderRow`)
**Scope:** M

### ✅ Task 19: Header sempit + posisi Toaster
**Acceptance criteria:**
- [x] Email user disembunyikan `< sm`, tetap tersedia di menu user (Task 14)
- [x] `SidebarTrigger` + breadcrumb + aksi muat di 320px tanpa overflow
- [x] `<Toaster position="top-center">` (atau keputusan final)

**Verification:** 320px → header rapi; trigger toast → tidak menutupi tombol header.
**Dependencies:** Task 9, Task 14
**Files:** `src/routes/_authenticated/route.tsx`, `src/routes/__root.tsx`
**Scope:** S

### ✅ Checkpoint 3 (Complete)
- [x] Refresh `/sales-orders?status=production&page=2` mempertahankan state
- [x] Dark mode toggle + persist berfungsi
- [x] Kanban: ubah status via keyboard berhasil
- [x] Viewport 320/768/1024/1440 — tidak ada horizontal scroll body
- [x] `bun test` hijau, build + lint hijau
- [x] Review dengan pemilik sebelum merge

---

## Phase 4 — Backlog — SELESAI (semua merged ke `main`)

- [x] Redesign Kanban → board kolom-per-proses, semua batch terlihat (scope L)
  - ✅ Spec + plan di `docs/superpowers/`. Subagent-driven (4 task + final review). Merge `6a0dfff`.
- [x] Sistem warna status: ikon/bentuk per status (WCAG 1.4.1) + token semantik
  - ✅ `src/lib/status-tone.ts` (5 tone: neutral/active/attention/success/danger) + `<StatusPill>`. Semua badge (SO/eng/delivery/QC/step) + dashboard tiles + operator. Merge `d82de7d`.
- [x] Aksen brand DSM + audit palet chart default (`--chart-1..5`)
  - ✅ Arah "Charcoal + aksen": netral di-detint ke abu murni, `--brand` = `#D81E1C` sebagai aksen (bukan primary). Palet chart sengaja dibiarkan (data-viz ≠ brand identity). Merge `edd8273`.
- [x] Konsolidasi skala radius container (pilih satu: `rounded-lg` atau `rounded-xl`)
  - ✅ Panel card-like → `rounded-xl`. Merge `512cd74`.
- [x] Tuntaskan sisa masalah kontras dark mode dari Task 16
  - ✅ Gantt → "light island"; legend chip + overdue text dapat `dark:` variant. Merge `512cd74`.
