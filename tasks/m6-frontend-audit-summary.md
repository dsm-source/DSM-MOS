# M6 Frontend Audit Summary — QC Step-Level UI

Tanggal: 2026-08-20
Scope: M6.3 + M6.4 + M6.5 frontend only
Status: PASS untuk UI QC step-level. Offline queue belum dikerjakan.

## Hasil Akhir

| Task | Status | File |
|---|---|---|
| M6.3 UI mobile-responsive antrian + form tanpa foto | ✅ | `src/features/qc/components/inspection-card.tsx`, `inspection-dialog.tsx`, `src/routes/_authenticated/qc.tsx` |
| M6.4 Tombol Trigger Rework via RPC | ✅ | `src/features/qc/hooks/use-inspections.ts`, `inspection-dialog.tsx` |
| M6.5 Timeline riwayat inspeksi multi-cycle per step | ✅ | `src/features/qc/components/inspection-timeline.tsx`, `hooks/use-inspections.ts`, `types.ts` |
| Codex review final | ✅ | verdict `pass` |

## Apa yang Berubah

### 1. Query QC pindah ke model per-step
`qc_inspections` sekarang di-query dengan nested shape:
- `production_batch_step:production_batch_steps!inner(...)`
- lalu `production_batch -> engineering_job -> sales_order_item -> sales_order -> customer`

Artinya semua context batch/SO/customer sekarang lewat `production_batch_step_id`, bukan `production_batch_id` yang sudah dihapus di backend M6.1.

Files:
- `src/features/qc/types.ts`
- `src/features/qc/hooks/use-inspections.ts`

### 2. Photo flow dihapus total
Dihapus dari QC frontend:
- bucket/storage usage
- signed URL fetch
- upload input
- image grid
- remove photo logic
- `photo_urls` reference di dialog/timeline

Files:
- `src/features/qc/components/inspection-dialog.tsx`
- `src/features/qc/components/inspection-timeline.tsx`

### 3. Trigger Rework pakai RPC formal
UI tidak lagi expose direct update status `rework`.

Implementasi:
- `useTriggerRework()` memanggil `supabase.rpc("trigger_rework", { _qc_inspection_id })`
- tombol hanya muncul saat `inspection.status === "reject"` dan `canWrite`
- sukses → toast + invalidate query + close dialog

Files:
- `src/features/qc/hooks/use-inspections.ts`
- `src/features/qc/components/inspection-dialog.tsx`

### 4. Timeline jadi per-step, bukan per-batch
`InspectionTimeline` sekarang menerima `stepId`, query `.eq("production_batch_step_id", stepId)`, urut oldest→newest, dan highlight current inspection.

### 5. Mobile responsiveness
Perubahan kecil tapi penting:
- input qty jadi `grid-cols-1 sm:grid-cols-3`
- input/action targets lebih tinggi (`h-11`, button lebih besar)
- copy route diperjelas jadi per-step queue
- search juga bisa cari nama proses (`PROCESS_LABEL`)

## Review Cycle

### Iterasi 1
- Claude Code refactor QC frontend sesuai schema baru.
- Hermes verify:
  - `bunx tsc --noEmit` ✅
  - `bun run lint` ✅
  - `bun run build` ✅
- Codex review 1: `pass_with_major`
  - Major: route menyimpan object inspeksi penuh (`selected`) sehingga setelah transisi `waiting -> inspection`, dialog stale dan tombol tidak update tanpa tutup-buka ulang.
  - Minor: empty-state queue text masih bilang batch-level.

### Iterasi 2 (tiny fix oleh Hermes)
- `src/routes/_authenticated/qc.tsx`
  - `selected` diganti jadi `selectedId`
  - object `selected` sekarang derive dari data query terbaru via `useMemo`
  - empty-state text diganti ke wording per-step
- Hermes verify ulang:
  - `bunx tsc --noEmit` ✅
  - `bun run lint` ✅
  - `bun run build` ✅
- Codex review 2: **PASS**
  - `major_fixed: true`
  - no new blocking/major

## Verification Commands

```bash
PATH="/Users/macbook/.bun/bin:$PATH" bunx tsc --noEmit
PATH="/Users/macbook/.bun/bin:$PATH" bun run lint
PATH="/Users/macbook/.bun/bin:$PATH" bun run build
```

Results:
- `bunx tsc --noEmit` → PASS
- `bun run lint` → PASS
- `bun run build` → PASS

## Out-of-Scope / Remaining Work

1. **M6.6 offline queue belum ada** [Certain]
   - localStorage queue
   - pending sync indicator
   - online retry

2. **M6.8 manual offline/online test belum dikerjakan** [Certain]
   - perlu browser/manual verification

3. **Checkpoint M6 belum boleh dicentang** [Certain]
   - karena M6.6 + M6.8 + `get_advisors` belum selesai

4. **M7 future bug flagged** [Certain]
   - `src/features/delivery/hooks/use-deliveries.ts` masih query `qc_inspections` lewat relasi lama `production_batch:production_batches!inner(...)`
   - ini tidak kena `tsc` karena raw `.select()` string, tapi akan fail runtime saat M7 nanti kalau tidak diperbaiki
   - tidak disentuh karena di luar scope M6.3-M6.5

## Recommendation

Lanjut **M6.6 + M6.8** next:
1. buat offline queue localStorage sederhana
2. indikator "tersimpan lokal, menunggu sinkronisasi"
3. auto-submit saat online kembali
4. manual test dengan network offline/online
5. setelah itu baru nilai apakah Checkpoint M6 bisa ditutup

## Files Touched
- `src/features/qc/types.ts`
- `src/features/qc/hooks/use-inspections.ts`
- `src/features/qc/components/inspection-card.tsx`
- `src/features/qc/components/inspection-dialog.tsx`
- `src/features/qc/components/inspection-timeline.tsx`
- `src/routes/_authenticated/qc.tsx`
- `tasks/todo.md`
