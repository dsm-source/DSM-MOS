# M6 Backend Audit Summary — QC Step-Level + Rework RPC

Tanggal: 2026-08-20
Scope: M6.1 + M6.2 + M6.7 backend only
Status: PASS untuk backend DB layer. UI/offline M6.3-M6.6 belum dikerjakan.

## Hasil Akhir

| Task | Status | File |
|---|---|---|
| M6.1 Migration qc_inspections per-step, hapus foto, enqueue per-step, validate insert, delivery join update, storage cleanup | ✅ | `supabase/migrations/20260817000003_m6_qc_step_level.sql` |
| M6.2 RPC `trigger_rework` + gate GUC untuk rework | ✅ | `supabase/migrations/20260817000004_m6_trigger_rework_rpc.sql` |
| M6.7 pgTAP gate completed-only + RLS insert/RPC | ✅ | `supabase/tests/qc_rework.test.sql` |
| Regression update M5 production gate tests | ✅ | `supabase/tests/production_execution.test.sql` |

## Review Cycle

### Iterasi 1
- Claude Code build backend migrations + test.
- Local verify:
  - `supabase db reset` ✅
  - `supabase test db` ✅ 208/208
  - `bun run lint` ✅
  - `bun run build` ✅
  - `bunx tsc --noEmit` ❌ only `src/features/qc/*` schema drift (`photo_urls`, `production_batch_id`) — expected because UI out of scope.
- Codex review 1: **FAIL**
  - Blocking 1: next production step bisa jalan tanpa QC pass step sebelumnya.
  - Blocking 2: delivery menerima QC pass dari step non-final.
  - Major 1: direct `qc_inspections.status='rework'` bisa bypass RPC.
  - Major 2: duplicate active QC rows allowed.
  - Minor: nullable FK possible after partial backfill.

### Iterasi 2
- Claude Code fix semua temuan:
  1. `production_batch_steps_validate_transition()` sekarang mewajibkan previous active step `completed` **dan** punya `qc_inspections.status='pass'` sebelum next step `running`.
  2. `delivery_items_validate()` sekarang mewajibkan QC pass berasal dari **final active step** batch.
  3. `qc_inspections_validate_transition()` di-hardening: `reject -> rework` juga wajib lewat GUC transaction-local dari RPC.
  4. Added partial unique index `uq_qc_inspections_active_step` untuk mencegah >1 active waiting/inspection/reject row per step.
  5. Migration aborts explicit jika backfill `production_batch_step_id` gagal sebelum drop kolom lama.
  6. `production_execution.test.sql` di-update karena gate QC baru membuat urutan test M5 lama invalid tanpa QC pass.
- Local verify:
  - `supabase test db` ✅ 215/215
  - `bun run lint` ✅
  - `bun run build` ✅
  - `bunx tsc --noEmit` ❌ only `src/features/qc/*` schema drift, still out of scope.
- Codex review 2: **PASS**
  - 0 blocking
  - 0 major
  - 0 minor

## Coverage PRD

### PRD §6.2 — `qc_inspections` per-step
Covered:
- FK pindah dari `production_batch_id` ke `production_batch_step_id`
- foto dihapus (`photo_url`, `photo_urls` dropped)
- `rework_triggered_at` added
- multi-cycle supported via row-per-cycle pattern

### PRD §7 rule #2 — QC per-step gate
Covered in DB:
- `qc_inspections` insert hanya boleh untuk step `completed`
- next production step tidak bisa `running` sebelum previous step punya QC `pass`
- pgTAP covers reject/waiting/pass paths

### PRD §7 rule #3 — rework hanya via RPC formal
Covered in DB:
- `public.trigger_rework(uuid)` security definer, role-gated qc/admin
- direct `production_batch_steps.status='rework'` rejected without GUC
- direct `qc_inspections.status reject->rework` rejected without GUC
- pgTAP covers direct-update rejection + happy path RPC

### PRD §7 rule #4 — delivery hanya dari final QC pass
Covered in DB logic:
- `delivery_items_validate()` now requires passed inspection belongs to final active step of batch
- not covered end-to-end by actual `INSERT INTO deliveries` test because of pre-existing M7 bug below

## Verification Commands

Executed for real:

```bash
supabase db reset
supabase test db
supabase gen types typescript --local 2>/dev/null > src/integrations/supabase/types.ts
PATH="/Users/macbook/.bun/bin:$PATH" bunx eslint --fix src/integrations/supabase/types.ts
PATH="/Users/macbook/.bun/bin:$PATH" bun run lint
PATH="/Users/macbook/.bun/bin:$PATH" bun run build
PATH="/Users/macbook/.bun/bin:$PATH" bunx tsc --noEmit
```

Results:
- `supabase db reset` → PASS
- `supabase test db` → PASS (`Files=7, Tests=215`)
- `bun run lint` → PASS
- `bun run build` → PASS
- `bunx tsc --noEmit` → FAIL only in `src/features/qc/*` due schema drift expected before M6.3 rewrite

## Out-of-Scope / Remaining Work

1. **QC frontend broken against new schema** [Certain]
   - `src/features/qc/components/inspection-dialog.tsx` still references `photo_urls`
   - `src/features/qc/components/inspection-timeline.tsx` still references `photo_urls`
   - `src/features/qc/hooks/use-inspections.ts` still filters by `production_batch_id`
   - This is exactly M6.3-M6.5 scope.

2. **Pre-existing M7 delivery bug** [Certain]
   - `public.deliveries_set_defaults()` is not `SECURITY DEFINER`.
   - It calls `generate_do_number()` which is revoked from `authenticated`.
   - Result: real `INSERT INTO deliveries` by app roles fails with permission denied.
   - This blocked an end-to-end pgTAP insert test for delivery final-step gate. Logic still reviewed/passed statically by Codex.

3. **M6 not complete yet** [Certain]
   - M6.3 UI mobile-responsive queue/form belum dikerjakan
   - M6.4 Trigger Rework button belum dikerjakan
   - M6.5 timeline multi-cycle belum dikerjakan
   - M6.6 offline queue belum dikerjakan
   - M6.8 manual offline/online sync belum dikerjakan
   - Checkpoint M6 belum boleh dicentang

## Recommendation

Lanjut **M6.3-M6.5 dulu** next pass:
1. refactor `src/features/qc/*` ke model per-step
2. hapus semua upload foto
3. tambah tombol `Trigger Rework`
4. buat timeline multi-cycle
5. target minimal: `bunx tsc --noEmit` kembali hijau sebelum masuk offline queue M6.6

## Files Touched (backend pass)
- `supabase/migrations/20260817000003_m6_qc_step_level.sql`
- `supabase/migrations/20260817000004_m6_trigger_rework_rpc.sql`
- `supabase/tests/qc_rework.test.sql`
- `supabase/tests/production_execution.test.sql`
- `src/integrations/supabase/types.ts`
- `tasks/todo.md`
