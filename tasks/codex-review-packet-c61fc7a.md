# Codex Review Packet — Commit `c61fc7a`

Tanggal: 2026-08-20
Target reviewer: Codex
Reviewer role: audit/review only, jangan ubah kode.

## Tujuan Review

Review commit `c61fc7a` untuk memastikan tidak ada temuan **blocking** pada:
1. fix anti-pattern parent route tanpa `<Outlet />`
2. perubahan M5 Production Execution
3. perubahan M6 QC step-level + offline queue
4. integrasi migration/test/frontend yang masuk dalam commit yang sama

## Aturan Repo yang Wajib Diikuti

Sumber: `AGENT.md`
- Codex adalah reviewer/auditor, bukan implementer.
- Review wajib self-contained. Jangan asumsi histori chat Hermes/Claude.
- Minimal review: korektnes, keamanan, konsistensi arsitektur.
- Setiap temuan beri severity: `blocking` / `major` / `minor` / `saran`.
- Pisahkan jelas temuan `in-scope` vs `out-of-scope`.
- Jika ada blocking, task kembali ke Claude. Maks 3 iterasi.

## Status Verifikasi Sebelum Review

Sudah dilaporkan PASS oleh Claude/Hermes pada sesi sebelumnya:
- `bun run build` PASS
- `bun run lint` PASS
- `bunx tsc --noEmit` PASS
- browser verify nyata untuk route bug:
  - `/sales-orders/new` PASS
  - `/sales-orders/$id/edit` fixed + PASS
  - `/delivery/schedule` fixed + PASS
  - `/delivery/$id` fixed + PASS
  - `/engineering/workload` fixed + PASS
  - `/engineering/$id` fixed + PASS
- M6.8 manual offline/online checklist PASS
- `get_advisors` remote project `jtzwawtfymljfqfrplib`:
  - performance: 0 temuan
  - security: 1 WARN `auth_leaked_password_protection` — accepted risk, non-blocking

Catatan: hasil di atas perlu dianggap sebagai konteks/verifikasi sebelumnya, bukan pengganti review diff.

## Scope Commit

Commit:
- `c61fc7a feat(M5-M6): production execution, QC step-level + offline queue, fix route Outlet anti-pattern`

Stat:
- 46 files
- `+5069 / -1413`

Untracked lokal saat inspeksi Hermes:
- `.playwright-mcp/`
- `.vscode/`
- `tasks/report-claude-to-hermes-2026-08-20.md`

File untracked di atas **bukan** bagian commit review.

## Prioritas Review 1 — Route Outlet Fix

Fokus utama owner untuk review cepat.

### File inti
- `src/routes/_authenticated/sales-orders.$id.index.tsx`
- `src/routes/_authenticated/delivery.tsx`
- `src/routes/_authenticated/delivery.index.tsx`
- `src/routes/_authenticated/engineering.tsx`
- `src/routes/_authenticated/engineering.index.tsx`
- `src/routeTree.gen.ts`

### Ringkasan perubahan

#### A. Sales Orders detail/edit route
Sebelum:
- `sales-orders.$id.tsx` adalah leaf route detail sekaligus parent untuk child `/edit`.
- Karena component detail tidak render `<Outlet />`, page `/sales-orders/$id/edit` menampilkan DOM detail, bukan form edit.

Sesudah:
- `sales-orders.$id.tsx` di-rename menjadi `sales-orders.$id.index.tsx`.
- `routeTree.gen.ts` auto-regenerate sehingga:
  - `/sales-orders/$id/` menjadi index child langsung di bawah `sales-orders`
  - `/sales-orders/$id/edit` juga child langsung di bawah `sales-orders`
- Tidak ada logic JSX detail yang diubah selain path route hasil auto-update plugin.

Hal yang perlu dicek:
- tidak ada regression pada link/params ke `/sales-orders/$id`
- tidak ada mismatch antara generated route tree dan file route actual
- trailing slash `/sales-orders/$id/` tidak memicu bug navigation atau duplicate match
- edit route tidak lagi bergantung pada parent detail route

#### B. Delivery route layout split
Sebelum:
- `delivery.tsx` memuat page list sekaligus parent untuk `/delivery/schedule` dan `/delivery/$id`.
- Child route tertutup karena page tidak render `<Outlet />`.

Sesudah:
- `delivery.tsx` menjadi layout minimal:
  - `createFileRoute("/_authenticated/delivery")({ component: Outlet })`
- page lama dipindah utuh ke `delivery.index.tsx`
- `routeTree.gen.ts` auto-regenerate sehingga index/detail/schedule jadi child benar di bawah route layout

Hal yang perlu dicek:
- split ini benar-benar no-op untuk page `/delivery`
- child `/delivery/$id` dan `/delivery/schedule` sekarang resolve benar
- tidak ada SEO/head regression yang penting untuk app internal

#### C. Engineering route layout split
Pola sama dengan delivery.

Hal yang perlu dicek:
- board `/engineering` tetap no-op behavior
- `/engineering/workload` dan `/engineering/$id` tidak lagi tertutup board parent
- tidak ada role-guard regression implisit akibat perubahan parent-child

## Prioritas Review 2 — M7 Future Runtime Risk

File:
- `src/features/delivery/hooks/use-deliveries.ts`

Temuan Hermes [Certain]:
- `useEligibleQcInspections()` masih query `qc_inspections` lewat relasi lama:
  - ```ts
    production_batch:production_batches!inner(...)
    ```
- Padahal M6 backend memindahkan QC ke model per-step (`production_batch_step_id`), bukan per-batch.
- Ini sudah ditandai di audit M6 frontend sebagai bug future M7.
- Karena query ada di raw `.select()` string, `tsc` tidak menangkap.

Pertanyaan review:
- Apakah ini harus dianggap `major` out-of-scope atau sudah in-scope karena file masuk commit `c61fc7a`?
- Apakah ada jalur runtime lain di delivery yang sudah pasti rusak akibat schema baru?

## Prioritas Review 3 — M5/M6 High-Risk Area

Karena commit besar, review tajam lebih penting dari review lebar.

### Backend / migration / test
- `supabase/migrations/20260816000007_m5_add_rework_enum.sql`
- `supabase/migrations/20260816000008_m5_validate_transition_rework.sql`
- `supabase/migrations/20260817000002_audit_hardening.sql`
- `supabase/migrations/20260817000003_m6_qc_step_level.sql`
- `supabase/migrations/20260817000004_m6_trigger_rework_rpc.sql`
- `supabase/tests/production_execution.test.sql`
- `supabase/tests/qc_rework.test.sql`

Cek khusus:
- gate transisi step produksi
- gate QC pass sebelum next step
- rework hanya via RPC formal
- final-step QC gate untuk delivery
- RLS / SECURITY DEFINER / GUC usage aman
- test benar-benar menutup celah, bukan false confidence

### Frontend / hook / queue
- `src/features/production/components/kanban-board.tsx`
- `src/features/production/components/step-operator-dialog.tsx`
- `src/features/production/hooks/use-batch-steps.ts`
- `src/features/production/hooks/use-batches.ts`
- `src/features/production/lib/step-actions.ts`
- `src/features/qc/components/inspection-dialog.tsx`
- `src/features/qc/components/inspection-timeline.tsx`
- `src/features/qc/hooks/use-inspections.ts`
- `src/features/qc/hooks/use-offline-qc-queue.ts`
- `src/features/qc/lib/offline-queue.ts`
- `src/routes/_authenticated/qc.tsx`

Cek khusus:
- optimistic state tidak mengalahkan server truth
- offline queue tidak replay ganda / corrupt queue
- action rework tidak expose direct status mutation
- stale selected object issue memang sudah tuntas
- sync lock cukup untuk mencegah double processing

## File Konteks Audit yang Boleh Dipakai Reviewer

Ringkasan audit internal:
- `tasks/m5-audit-summary.md`
- `tasks/m6-backend-audit-summary.md`
- `tasks/m6-frontend-audit-summary.md`
- `tasks/m6-offline-audit-summary.md`
- `tasks/route-outlet-audit.md`
- `tasks/todo.md`

Laporan orkestrasi terbaru:
- `tasks/report-claude-to-hermes-2026-08-20.md`

Pakai sebagai konteks. Jangan anggap bukti ini menggantikan inspeksi kode.

## Temuan Hermes Saat Menyiapkan Paket

### Fakta kuat
- Route fix untuk `delivery` dan `engineering` adalah split file murni: page lama dipindah utuh ke `*.index.tsx`, parent jadi `Outlet` minimal. [Certain]
- Route fix untuk `sales-orders/$id/edit` bergantung pada perubahan generated tree: edit route tidak lagi child dari detail route. [Certain]
- `use-deliveries.ts` masih memuat query raw relasi lama per-batch pada helper eligible QC. [Certain]

### Area yang layak diserang reviewer
- generated route tree setelah rename index routes
- trailing slash behavior pada detail sales order
- coupling lama delivery ke schema QC sebelum M7
- queue sync/write-back failure semantics pada offline queue
- DB security around `trigger_rework` and helper triggers

## Output yang Diminta dari Codex

Format jawab:
1. `Verdict`: `pass` / `pass_with_minor` / `changes_requested`
2. `Blocking findings`
3. `Major findings`
4. `Minor findings`
5. `Suggestions`
6. `Out-of-scope findings`
7. `Final recommendation`

Setiap finding minimal isi:
- severity
- file
- baris atau area
- kenapa problem
- risiko konkret
- saran fix singkat

## Batas Keputusan

- Jika tidak ada `blocking`, Hermes bisa lanjut simpulkan checkpoint relevan selesai.
- Jika ada `blocking`, Hermes wajib kirim balik ke Claude.
- Jika temuan hanya future M7 bug di `use-deliveries.ts`, tandai jelas apakah itu menahan close task ini atau tidak.
