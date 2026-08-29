# Desain: Redesign Board Produksi (kolom-per-proses)

**Tanggal:** 2026-08-29
**Status:** Disetujui (brainstorming)
**Cakupan:** Tampilan halaman Produksi (`/production`). Tidak menyentuh skema DB, RLS, atau modul lain.

## Ringkasan

Halaman Produksi sekarang menampilkan **satu batch** yang dipilih lewat dropdown, lalu memperlihatkan 5 tahapan proses batch itu sebagai deret kartu. Model ini menyembunyikan WIP — shift leader tidak bisa melihat "apa yang ada di stasiun Bending sekarang".

Redesign mengubahnya menjadi **board kontrol produksi kolom-per-proses**: satu kolom per tahapan proses, semua batch terlihat sekaligus, tiap batch sebagai kartu di kolom tahapan aktifnya. Board menjadi alat kontrol — menyeret kartu ke kolom berikutnya = menyelesaikan tahapan tersebut.

## Keputusan desain (dari brainstorming)

| # | Keputusan |
|---|---|
| 1 | **Model A** — drag = memajukan tahapan. Board adalah alat kontrol, bukan sekadar tampilan. |
| 2 | Kartu tetap punya tombol **Start** (butuh dialog operator — tak bisa lewat drag). Drag hanya dari `running`/`paused` = "Complete tahapan ini". Batch terblokir tak bisa di-drag. |
| 3 | **7 kolom**: Antrian \| Laser Cutting \| Bending \| Welding & Grinding \| Powder Coating \| Assembly \| Selesai. |
| 4 | Kartu memuat: no. batch, item, SO+customer, qty, badge status tahapan aktif + durasi, strip mini 5-tahap, **target selesai berwarna**, tombol aksi, kotak blocker. Klik badan kartu → `BatchDetailDrawer` (sudah ada). |
| 5 | Filter: cari + dropdown customer + dropdown SO + chip "Terblokir" + chip "Mepet deadline". Disimpan di URL search params. Kolom Selesai collapse default. |
| 6 | **Konfirmasi inline** (popover kecil di kartu) saat drop, bukan modal penuh: "Selesaikan Bending? [Ya] [Batal]". |

## Arsitektur

### Route

`src/routes/_authenticated/production.tsx` — hapus `<Select>` pemilih batch + `<KanbanBoard>`; render `<ProductionBoard>`. Tambah `validateSearch` untuk state filter (pola dari `sales-orders.index.tsx`).

### Komponen

| Komponen | File | Tugas | Dependensi |
|---|---|---|---|
| `ProductionBoard` | `features/production/components/production-board.tsx` | Container: baca `useProductionBatches()`, turunkan kolom via `assignColumn`, render 7 `BoardColumn` di dalam satu `DndContext`, kelola filter (dari route search params) + handler drop | `use-batches`, `@dnd-kit/core`, `board-columns` |
| `BoardColumn` | `features/production/components/board-column.tsx` | Satu kolom: header (label + count), area `useDroppable`, daftar `BatchCard`. Varian collapsible untuk "Selesai" (state di `localStorage`). | `@dnd-kit/core` |
| `BatchCard` | `features/production/components/batch-card.tsx` | **Dihidupkan** (sekarang nganggur). Tambah: baris target selesai berwarna, tombol aksi per status, drag handle (`useDraggable`), state konfirmasi inline. Klik badan → `onOpen()`. | `step-actions`, `start-blocker`, `planning-status`, `process` |
| `board-columns.ts` | `features/production/lib/board-columns.ts` | Fungsi murni: `assignColumn(batch): ColumnId` dan `canDropOn(batch, targetProcess): boolean`. | `batch-progress`, `start-blocker`, `types` |

### Dipakai ulang tanpa perubahan

- `BatchDetailDrawer` — detail lengkap (semua tahapan, riwayat blocker, input qty selesai, edit rencana)
- `StepOperatorDialog` — pemilihan operator saat Start
- `StepStatusBadge` — badge status tahapan
- `useUpdateBatchStep` — mutation (sudah optimistic + rollback)
- `useProductionBatches` — query (sudah realtime; sudah memuat steps + engineering_job + material_status + SO + customer)
- `computeStartBlocker`, `activeStep`, `isBatchDone`, `computeStatus` — logika yang sudah ada

### Dihapus

`src/features/production/components/kanban-board.tsx` — berisi `KanbanBoard`, `KanbanCell`, `ActionDropButton`. Sepenuhnya digantikan `ProductionBoard` + `BoardColumn` + `BatchCard`.

## Alur data

### Penempatan kartu ke kolom — `assignColumn(batch)`

```
1. isBatchDone(steps)                                → "selesai"
2. steps.every(s => s.status === "waiting")          → "antrian"
   (belum ada satu pun yang running/paused/completed/skipped/rework)
3. selain itu                                        → activeStep(steps).process
```

`activeStep(steps)` (sudah ada) = step pertama yang belum `completed`/`skipped`. Konsekuensinya tiap batch selalu masuk **tepat satu** kolom. Batch dengan routing custom otomatis tak muncul di kolom proses yang tak dipakainya.

### Validitas drag — `canDropOn(batch, targetProcess)`

Kartu **draggable** hanya jika `activeStep.status ∈ {running, paused}` dan tidak terblokir (`computeStartBlocker` null).

Drop **valid** hanya jika `targetProcess` adalah proses **tepat setelah** proses `activeStep` di routing batch itu sendiri (bukan urutan global). Kolom lain (mundur, loncat, Antrian) bukan drop target — tak menampilkan indikator drop.

| Situasi kartu | Draggable | Drop valid |
|---|---|---|
| Di Antrian | ❌ | — |
| `waiting` di kolom proses | ❌ | — |
| `running` / `paused`, tak terblokir | ✅ | kolom proses berikutnya di routing batch |
| Terblokir | ❌ | — |
| Di Selesai | ❌ | — |

### Alur drop

`ProductionBoard` memegang `useUpdateBatchStep` dan `DndContext`. `BatchCard` hanya menampilkan popover dan memanggil callback — ia tidak menyentuh mutation langsung.

```
onDragEnd (di ProductionBoard)
  → validasi canDropOn(batch, targetProcess); jika tidak valid → abaikan
  → setPendingComplete({ batchId, stepId, process })   // memicu popover di kartu terkait
BatchCard (menerima pendingComplete untuk batch-nya)
  → render popover inline: "Selesaikan {PROCESS_LABEL}? [Ya] [Batal]"
  → [Ya]   → onConfirmComplete(stepId)
  → [Batal]→ onCancelComplete()
ProductionBoard.onConfirmComplete(stepId)
  → updateStep.mutate({ id: stepId, status: "completed" })
       → onMutate optimistic (sudah ada di hook): status step → completed
       → activeStep berikutnya jadi "waiting" → assignColumn memindahkan kartu ke kolom +1
       → realtime broadcast → tablet lain ikut update
       → sukses: toast "Tahapan {PROCESS_LABEL} selesai"
       → error: rollback (sudah ada di hook) + notifyError toast
  → clear pendingComplete
```

Complete lewat **tombol** di kartu memanggil `onAction` (pola sudah ada) → `ProductionBoard` menjalankan mutation yang sama. Tombol tidak melewati konfirmasi inline — konfirmasi khusus untuk gestur drag (lebih rawan salah).

### Tombol aksi per status — `actionsFor(status)` (sudah ada, tidak diubah)

| Status | Tombol |
|---|---|
| `waiting` | Start (→ `StepOperatorDialog`), Skip |
| `running` | Pause, Complete |
| `paused` | Resume, Complete |
| `rework` | Start Ulang, Pause, Complete (hanya jika QC memicu rework — di luar alur board) |
| `completed` / `skipped` | — |

### Filter

`ProductionBoard` membaca search params dari route:

```ts
type BoardSearch = {
  q: string;          // cari batch/item/SO/customer, debounce 300ms
  customer: string;   // "all" | customer id
  so: string;         // "all" | SO id
  blocked: boolean;   // chip toggle
  due: boolean;       // chip toggle: target ≤ 2 hari / lewat, & belum selesai
};
```

Filter diterapkan ke seluruh daftar batch sebelum penempatan kolom. Dropdown customer/SO diisi dari batch yang ada. Tombol clear pada input cari.

### Kolom Selesai

- Collapse default; state (`collapsed: boolean`) di `localStorage` key `dsm-board-selesai-collapsed`
- Dibuka → semua batch selesai, urut `updated_at` desc, kolom scroll internal (`overflow-y-auto max-h-...`)
- Tidak ada tautan "lihat semua" (belum ada route daftar batch)

### Target selesai di kartu

`computeStatus(batch)` + `batch.planned_completion_date` (sudah ada):

| Kondisi | Tampilan |
|---|---|
| `overdue` | merah — "Target lewat: {tgl}" |
| `on_track` & selisih ≤ 2 hari | oranye — "Target: {tgl} ({n} hari lagi / besok / hari ini)" |
| `on_track` & > 2 hari | abu — "Target: {tgl}" |
| `unscheduled` | abu samar — "Belum dijadwalkan" |

## Penanganan error & state kosong

| Kondisi | Perlakuan |
|---|---|
| Query gagal | `<ErrorNotice error={error} />` |
| Tidak ada batch sama sekali | `<EmptyState icon={Package} title="Belum ada batch produksi" description="Batch muncul di sini setelah dibuat oleh Production Planning." />` |
| Kolom kosong | teks samar `—` di badan kolom |
| Mutation gagal | rollback optimistic (hook) + `notifyError` toast |
| Drop tak valid (entah bagaimana lolos) | toast "Tidak bisa memindahkan batch: {alasan}" |
| Loading | skeleton grid 7 kolom |

## Aksesibilitas

- `useSensors(PointerSensor{distance:6}, TouchSensor{delay:200,tolerance:6}, KeyboardSensor)` — dibawa dari kerja Task 17
- `DndContext.accessibility.announcements` (Bahasa Indonesia): onDragStart "Mengangkat batch {no}. Pakai panah untuk pilih kolom tujuan, spasi untuk jatuhkan." / onDragOver "Di atas kolom {label}." / onDragEnd "Menjatuhkan di {label}." / onDragCancel "Membatalkan."
- Kartu: `role="button"`, `tabIndex={0}`, Enter/Space → buka drawer (pola sudah ada di `BatchCard`)
- Drag handle: tombol dengan `aria-label="Seret batch {no} ke tahapan berikutnya"`
- Kolom collapse: tombol dengan `aria-expanded`
- Semua status/warna disertai teks (badge sudah teks; target selesai sudah teks + warna)

## Testing

**Unit** (`board-columns.test.ts`):
- `assignColumn`: batch selesai → "selesai"; semua waiting → "antrian"; step 2 running → kolom proses step 2; step 1 skipped + step 2 waiting → kolom proses step 2 (bukan antrian); routing custom tanpa Powder Coating → tak pernah "powder_coating"
- `canDropOn`: running + target = proses berikutnya di routing → true; running + target = proses 2 langkah ke depan → false; running + target = proses sebelumnya → false; waiting → false apa pun target; terblokir → false; batch di antrian → false

**Komponen** (`batch-card.test.tsx`):
- Render state: blocked (kotak kuning + link), running (badge + durasi + Pause/Complete), waiting (Start/Skip), paused (Resume/Complete), done (tak ada tombol)
- Target selesai: overdue → teks merah "Target lewat"; ≤ 2 hari → oranye; normal → abu
- Alur konfirmasi drop: set `confirming` → popover muncul; klik "Ya" → `onConfirmComplete` terpanggil dengan step id; klik "Batal" → popover hilang, tak ada panggilan

**Catatan:** `blocker-history.test.tsx` yang gagal saat ini adalah masalah setup jsdom pre-existing, tidak terkait redesign ini.

## Di luar cakupan

- Skema DB / RLS / trigger — tidak berubah
- Rework (mundur tahapan) — tetap khusus QC/admin lewat RPC, tidak di board ini
- Route daftar batch terpisah
- Perubahan pada Production Planning / modul lain
- Input qty selesai per tahapan — tetap di `BatchDetailDrawer`
