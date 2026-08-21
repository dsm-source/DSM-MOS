# Brief Fix untuk Claude — Blocker review Codex pasca commit `c61fc7a`

Tanggal: 2026-08-20
Target implementer: Claude
Jenis pekerjaan: bugfix, surgical fix, verifikasi, tanpa perluas scope

## Konteks

Codex sudah review commit `c61fc7a` dan hasilnya **changes_requested**.

Route Outlet fix dinilai benar. Blocker **bukan** di route.

Blocker ada di integrasi Delivery setelah schema M6 pindah dari QC per-batch ke QC per-step.

## Temuan Blocking dari Codex

File:
- `src/features/delivery/hooks/use-deliveries.ts`

Area:
- helper `useEligibleQcInspections()`

Masalah:
- helper masih query relasi lama per-batch:
  ```ts
  production_batch:production_batches!inner(...)
  ```
- setelah M6, `qc_inspections` sudah pindah ke model per-step via `production_batch_step_id`
- akibatnya flow tambah item pengiriman dari hasil QC di route `/delivery/$id` berisiko rusak runtime / ambil data salah

Saran fix Codex:
- ubah select helper ke relasi step-level:
  ```ts
  production_batch_step:production_batch_steps!inner(
    production_batch:production_batches!inner(...)
  )
  ```
- filter sales order lewat jalur baru:
  `production_batch_step.production_batch.engineering_job.sales_order_item.sales_order_id`
- pastikan hanya **final-step QC pass** yang ditawarkan, supaya konsisten dengan trigger `delivery_items_validate()`

## Scope Fix

In-scope:
- perbaiki helper `useEligibleQcInspections()` agar sesuai schema M6 final
- kalau perlu, update typing lokal/helper transform yang langsung terdampak perubahan query itu
- jalankan verifikasi relevan
- ringkas hasil untuk Hermes

Out-of-scope:
- jangan refactor modul Delivery lebih luas
- jangan sentuh bug lama `deliveries_set_defaults()` / `generate_do_number()` kecuali ternyata mutlak perlu untuk verifikasi dan memang tak bisa dihindari
- jangan ubah route fix sales/delivery/engineering yang sudah lolos review
- jangan menambah fitur M7 baru

## File Fokus

Wajib cek:
- `src/features/delivery/hooks/use-deliveries.ts`

Boleh dipakai sebagai konteks:
- `tasks/codex-review-packet-c61fc7a.md`
- `tasks/report-claude-to-hermes-2026-08-20.md`
- `tasks/m6-backend-audit-summary.md`
- `tasks/m6-frontend-audit-summary.md`
- `tasks/route-outlet-audit.md`
- `tasks/todo.md`

## Definition of Done untuk task fix ini

Task dianggap selesai hanya jika semua ini terpenuhi:
1. helper `useEligibleQcInspections()` tidak lagi pakai jalur schema QC lama
2. data eligible QC untuk Delivery mengikuti model step-level M6
3. helper hanya menawarkan QC `pass` yang valid untuk Delivery final-step gate
4. `bunx tsc --noEmit` PASS
5. `bun run lint` PASS
6. `bun run build` PASS
7. Claude memberi ringkasan perubahan yang gampang direview Hermes/Codex

## Hal yang Perlu Dipikirkan Sebelum Coding

Tolong cek tepatnya:
- apakah filter `status = 'pass'` saja cukup, atau perlu pembatasan tambahan supaya hanya final active step yang eligible
- apakah bisa memanfaatkan validasi DB yang sudah ada sambil tetap menampilkan kandidat yang benar di UI
- apakah ada area lain di file yang masih bergantung pada relasi QC lama dan perlu disentuh **hanya jika langsung memblokir helper ini**

Prinsip: diff sekecil mungkin. Jangan over-fix.

## Output yang Diminta dari Claude

Balas ke Hermes dengan format ini:

1. `Ringkasan fix`
2. `Root cause`
3. `File yang berubah`
4. `Verifikasi yang dijalankan`
5. `Hasil verifikasi`
6. `Risiko tersisa / catatan`
7. `Siap kirim ulang ke Codex atau belum`

## Catatan orkestrasi repo

Ikuti `AGENT.md`:
- perubahan harus surgical
- jangan asumsi histori chat lain
- hasil harus self-contained
- setelah selesai, task akan dikirim ulang ke Codex untuk review final
