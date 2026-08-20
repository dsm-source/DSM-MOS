# M5 Audit Summary — Production Execution

Tanggal: 2026-08-16
Milestone: M5 (Production Execution)
Hermes orchestrator session.

## Hasil Akhir

| Task | Status | File |
|---|---|---|
| M5.1 Migration enum `rework` | ✅ | `supabase/migrations/20260816000007_m5_add_rework_enum.sql` |
| M5.2 Revisi trigger validate_transition | ✅ | `supabase/migrations/20260816000008_m5_validate_transition_rework.sql` |
| M5.3 UI Kanban Per-Batch + drag-and-drop | ✅ | `src/features/production/components/kanban-board.tsx` (BARU), `src/routes/_authenticated/production.tsx`, `src/features/production/components/station-step-card.tsx` (DIHAPUS) |
| M5.4 Form pilih operator | ✅ | `src/features/production/components/step-operator-dialog.tsx` (BARU), `use-batch-steps.ts` (UpdateStepInput.operator_id), `use-operators.ts` (pure query) |
| M5.5 Realtime Kanban | ✅ | `useProductionBatches` tambah channel `operators-realtime`, `production_batch_steps` realtime sudah ada sebelumnya |
| M5.6 pgTAP test | ✅ | `supabase/tests/production_execution.test.sql` (43 assertions, 890 baris) |
| Checkpoint M5 | ✅ | Semua DoD SPEC.md §M5 + PRD §7 rule #1 terverifikasi |

## Review Cycle

### Backend migration (M5.1 + M5.2)
- Codex iterasi 1: **VERDICT pass** — blocking=0, major=0. Out-of-scope: RPC trigger_rework (M6), dashboard view rework count (M6), RLS tightening untuk rework (M6).
- File tetap: 2 file migration, header comment lengkap, idempotent.

### Frontend (M5.3 + M5.4 + M5.5)
- Claude Code iterasi 1: BANGUN semua file. lint/build/tsc PASS.
- Codex iterasi 1: **VERDICT fail** — 3 blocking + 2 major + 2 minor.
  - B1: duplicate realtime subscription `operators` (useOperators hook level + dipanggil di 2 tempat).
  - B2: `localOverride` optimistic state permanent, mengalahkan Realtime/server truth.
  - B3: Production UI izinkan direct update ke `rework` (langgar PRD §7 rule #3).
  - M1: drop target aktif walau tombol disabled.
  - M2: drawer tidak share action policy dengan kanban.
  - N1: tombol konfirmasi dialog hardcoded "Mulai".
  - N2: `@dnd-kit/sortable` dan `@dnd-kit/utilities` tidak dipakai (dep bloat).
- Claude Code iterasi 2: FIX semua. Tambah `step-actions.ts` shared lib, refactor `useUpdateBatchStep` ke TanStack optimistic mutation, hapus `localOverride`, hapus rework UI exposure, refactor drawer pakai shared actions.
- Codex iterasi 2: **VERDICT pass** — blocking=0, major=0, 1 minor (Section 8 lives_ok belum pakai GET DIAGNOSTICS, bukan blocker).

### Test pgTAP (M5.6)
- Claude Code iterasi 1: BANGUN test file 733 baris, 9 sections, 35 assertions. lint PASS.
- Codex iterasi 1: **VERDICT changes_requested_major_only** — 0 blocking, 2 major.
  - Major 1: 4 transisi valid trigger belum di-cover di Section 1 (`waiting→skipped`, `rework→completed`, `rework→paused`, `paused→completed`).
  - Major 2: `lives_ok` UPDATE bisa silent no-op kalau row target tidak ketemu.
- Claude Code iterasi 2: FIX. Tambah 4 transisi valid. Wrap `lives_ok` UPDATE dalam DO block dengan `GET DIAGNOSTICS v_count = ROW_COUNT`. File jadi 890 baris, 43 assertions.
- Codex iterasi 2: **VERDICT pass** — blocking=0, major=0, 1 minor (Section 8 lives_ok belum pakai guard, tapi assertion status akhir sudah cover).

## Coverage PRD §7 rule #1 (gate produksi)

Semua 3 aspek gate terverifikasi di test:
1. Engineering approved + material ready untuk step pertama → Section 3 (negative + message-specific assertion).
2. Step sebelumnya (active, status <> 'skipped') completed → Section 4 (sequence order + nama tahapan di pesan error).
3. Step sebelumnya dalam `rework` memblokir step berikutnya → Section 5 (message mengandung "rework" + nama tahapan spesifik).

Coverage PRD §7 rule #3 (rework via RPC):
- Trigger level: transisi `*→rework` dan `rework→*` diizinkan dengan pesan error konsisten.
- Enforcement penuh (RPC `trigger_rework` + RLS tightening role qc/admin): **DI-DEFER ke M6** sesuai plan.
- Production UI: tombol/drop Rework sudah DIHAPUS dari UI (B3 fix). M6 QC module yang akan add lewat RPC.

## Risiko / Catatan untuk M6

1. `v_dashboard_production_running` (`20260722063745_c2895064-7d75-4906-b763-df1c984889c7.sql:142`) hanya hitung `status = 'running'`. Step `rework` tidak muncul di dashboard. Flagged di header migration `20260816000008`.
2. RPC `trigger_rework` (security definer, role qc/admin) belum ada — M6 QC akan buat.
3. `qc_inspections` rewrite (per-step + rework_triggered_at) belum ada — M6 QC.
4. RLS UPDATE pada `production_batch_steps.status` belum restrict untuk `rework` (semua role dengan UPDATE boleh set ke `rework` lewat direct update) — M6 akan tighten.
5. types.ts di-extend manual dengan `"rework"` di enum `production_step_status`. Setelah Supabase MCP aktif dan `supabase gen types` dijalankan terhadap project, TODO comment di file bisa dihapus dan file di-regenerate.

## Verifikasi Final

- `bun run lint` → exit 0 ✅
- `bunx tsc --noEmit` → exit 0 ✅
- `bun run build` → exit 0 ✅ (warning pre-existing dari `gantt-task-react` third-party, unrelated)
- File migration: 2 file, idempotent, header comment jelas.
- Frontend: 8 file ditambah/diubah/dihapus, semua konsisten dengan SPEC.md §Code Style.
- pgTAP test: 43 assertions, parens balanced (242/242), 9 sections.
- **`supabase test db` (2026-08-17, local stack running)**: ALL TESTS PASS — `Files=6, Tests=192, Result: PASS`. Bug ditemukan saat eksekusi nyata: 1) enum `rework` belum ter-apply di local DB (fixed via `supabase db reset`); 2) SQL ambiguous column di Section 8 (fixed: `SELECT status` → `SELECT s.status`). Verifikasi bukan statis lagi.
- **`supabase gen types typescript --local` (2026-08-17)**: regenerated, TODO comment di `production_step_status` enum hilang, prettier auto-fix applied, lint+tsc clean.

## Outstanding (di luar scope M5, blocker untuk production deploy)

- Deploy ke remote project `jtzwawtfymljfqfrplib` belum dilakukan — MCP tidak authenticated di sesi ini; ini task M0.1 outstanding dari M0.
- `get_advisors` (security + performance) belum dijalankan — butuh koneksi Supabase aktif (MCP OAuth).
- Browser smoke test Kanban Per-Batch — visual verification drag-and-drop, dialog operator, realtime update (butuh user).