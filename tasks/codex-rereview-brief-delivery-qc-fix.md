# Codex Re-Review Brief — Fix blocker Delivery QC helper

Tanggal: 2026-08-20
Target reviewer: Codex
Jenis pekerjaan: review ulang kecil, fokus blocker sebelumnya

## Konteks

Sebelumnya Codex review commit `c61fc7a` dan menemukan 1 blocker:
- `src/features/delivery/hooks/use-deliveries.ts`
- helper `useEligibleQcInspections()` masih pakai relasi QC lama per-batch, padahal schema M6 sudah pindah ke per-step

Claude sudah mengerjakan fix surgical. Perubahan belum di-commit.

## Scope review ulang

Review **hanya** fix baru pada file:
- `src/features/delivery/hooks/use-deliveries.ts`

Fokus:
1. apakah query sekarang benar mengikuti schema M6 step-level
2. apakah filter hanya menawarkan QC `pass` pada final non-skipped step per batch, konsisten dengan trigger DB
3. apakah ada bug logika baru dari implementasi dua-query + filter JS
4. apakah blocker sebelumnya sudah tuntas

## Diff inti

Perubahan utama:
- query `qc_inspections` sekarang lewat:
  - `production_batch_step:production_batch_steps!inner(...)`
  - lalu `production_batch -> engineering_job -> sales_order_item`
- rows difilter ke `salesOrderId`
- query kedua fetch `production_batch_steps` non-skipped per batch
- `max(sequence_order)` dihitung di JS per batch
- hasil akhir hanya ambil QC row yang sequence-nya sama dengan max non-skipped step batch

## Bukti acuan DB

Trigger referensi:
- `supabase/migrations/20260817000003_m6_qc_step_level.sql`
- area rule delivery final-step gate:
  - baris 256–264

Logika DB:
- hanya `qc_inspections.status = 'pass'`
- hanya step dengan `sequence_order = max(sequence_order)` dari `production_batch_steps` untuk batch itu, exclude `status = 'skipped'`

## Verifikasi implementer

Sudah dijalankan oleh Claude:
- `bunx tsc --noEmit` PASS
- `bun run lint` PASS
- `bun run build` PASS

## Output yang diminta

Format:
1. `Verdict`: `pass` / `pass_with_minor` / `changes_requested`
2. `Blocking findings`
3. `Major findings`
4. `Minor findings`
5. `Suggestions`
6. `Final recommendation`

Jika blocker lama sudah tuntas dan tidak ada blocker baru, katakan eksplisit bahwa fix ini siap menutup temuan blocking review sebelumnya.

Jangan ubah kode.
