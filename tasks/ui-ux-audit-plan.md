# Implementation Plan: UI/UX Audit Remediation — DSM MOS

## Overview

Perbaikan UI/UX hasil audit 2026-08-29. Fokus: identitas visual, konsistensi shell
halaman, aksesibilitas, dan state navigasi. Bukan perubahan fungsional — semua
behavior data/RLS tetap. Dikerjakan bertahap; tiap task meninggalkan app dalam
keadaan build hijau.

Sumber temuan: transcript audit (26 temuan). Plan ini memetakan temuan → task.

## Architecture Decisions

- **Komponen shared baru**: `PageHeader` dan `EmptyState` di `src/components/`
  (bukan `src/components/ui/` — itu khusus shadcn primitives). Dipakai lintas route
  untuk menghapus duplikasi judul/deskripsi/empty-state.
- **Dark mode**: diputuskan **di-wire**, bukan dihapus — nilai untuk shift malam /
  tablet shop-floor. Pakai implementasi minimal (class toggle + localStorage +
  `prefers-color-scheme`), tanpa dependency `next-themes` kecuali terbukti perlu.
- **State filter/pagination**: pindah ke TanStack Router search params. Router sudah
  jadi dependency; ini pola idiomatiknya dan memberi shareable/refresh-safe URL.
- **Bahasa**: nav labels dilokalkan ke Indonesia agar konsisten dengan body copy.
  Istilah domain yang lazim Inggris (QC) boleh tetap; keputusan didokumentasikan di
  komentar `app-sidebar.tsx`.
- **Tidak** menyentuh redesign Kanban board (kolom-per-proses) di plan ini — itu
  scope L/XL tersendiri, dicatat sebagai backlog di Fase 4.

## Task List

### Phase 1: Quick Wins (low risk, no new components)

- [x] Task 1: Set `lang="id"` + samakan bahasa 404/error pages
- [x] Task 2: Hapus double padding & samakan spacing shell halaman
- [x] Task 3: Fix sidebar active state (prefix match) + dokumentasi keputusan bahasa
- [x] Task 4: Bersihkan copy usang & label tak konsisten
- [x] Task 5: `aria-label` dinamis untuk badge notifikasi + audit tombol ikon lain

### Checkpoint: Quick Wins
- [ ] `bun run build` hijau, `bun run lint` bersih
- [ ] Klik manual: buka `/sales-orders/<id>` → item "Sales Order" tersorot di sidebar
- [ ] Semua halaman punya padding luar yang sama (tidak ada 48px ganda)

### Phase 2: Shared Shell Components

- [x] Task 6: Buat `PageHeader` dan pakai di semua route `_authenticated`
- [x] Task 7: Buat `EmptyState` dan pakai di dashboard, kanban, list kosong
- [x] Task 8: Lokalisasi label navigasi sidebar + grup `SidebarGroup`
- [x] Task 9: Breadcrumb di header shell (pakai `breadcrumb.tsx` yang sudah ada)
- [x] Task 10: Reset focus ke `<main>` saat perpindahan route

### Checkpoint: Shell
- [ ] Semua route pakai `PageHeader` (grep: tidak ada `<h1 className="text-2xl` lepas)
- [ ] Breadcrumb tampil benar di route detail & edit
- [ ] Navigasi keyboard: Tab setelah pindah route mulai dari konten baru
- [ ] Build + lint hijau

### Phase 3: Navigation State & Polish

- [ ] Task 11: Pindah filter/pagination Sales Order ke search params
- [ ] Task 12: Pagination sungguhan (prev/next disabled nyata + info halaman)
- [ ] Task 13: Debounce search + tombol clear
- [ ] Task 14: Konfirmasi sign-out (dropdown di bawah email)
- [ ] Task 15: Skeleton transisi route + samakan loading `StatCard` pakai `Skeleton`
- [ ] Task 16: Wire dark mode (toggle + persist + `prefers-color-scheme`)
- [ ] Task 17: Aksesibilitas Kanban — `KeyboardSensor` + `TouchSensor` + announcements
- [ ] Task 18: Responsif tabel Sales Order di mobile (stacked card < sm)
- [ ] Task 19: Header sempit — sembunyikan email < sm, pindah ke menu; Toaster `top-center`

### Checkpoint: Complete
- [ ] Refresh di `/sales-orders?status=production&page=2` mempertahankan state
- [ ] Dark mode toggle berfungsi & persist antar reload
- [ ] Kanban: ubah status batch via keyboard berhasil
- [ ] Uji viewport 320 / 768 / 1024 / 1440 — tidak ada horizontal scroll body
- [ ] `bun test` hijau, build + lint hijau

### Phase 4: Backlog (tidak dikerjakan di siklus ini)

- [ ] Redesign Kanban jadi board kolom-per-proses (semua batch terlihat) — scope L
- [ ] Sistem warna status: fill lebih tegas + ikon/bentuk per status (WCAG 1.4.1)
- [ ] Aksen brand DSM + review palet chart default
- [ ] Konsolidasi skala radius container

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Pindah ke search params ubah signature `useSalesOrders` & pecah route lain | Med | Task 11 hanya sentuh route Sales Order; hook terima param sama, cuma sumbernya beda |
| Dark mode buka bug kontras di komponen yang belum pernah diuji gelap | Med | Task 16 di Fase 3; batasi ke smoke test visual per route, catat sisa di backlog |
| `PageHeader` migrasi 15+ route sekaligus | Med | Task 6 satu PR per fase modul kalau perlu; acceptance = build hijau tiap langkah |
| KeyboardSensor dnd-kit butuh koordinasi announcement | Low | Ada fallback tombol aksi; jika mahal, cukup tambah sensor + `aria` minimal |

## Open Questions

- Nav label: lokalkan semua ("Pelanggan", "Bahan", "Pengiriman") atau pertahankan
  sebagian istilah Inggris? Default plan: lokalkan, kecuali "QC" dan "Dashboard".
- Dark mode: perlu toggle manual di header, atau cukup ikut sistem? Default: toggle
  manual + default ikut sistem.
- Toaster position: `top-center` atau `bottom-center` untuk tablet? Default `top-center`.
