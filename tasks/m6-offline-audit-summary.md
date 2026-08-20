# M6 Offline Queue Audit Summary — QC Offline Sync

Tanggal: 2026-08-20
Scope: M6.6 code + M6.8 checklist artifact
Status: PASS untuk implementasi offline queue. Manual browser verification belum dijalankan.

## Hasil Akhir

| Task | Status | File |
|---|---|---|
| M6.6 Offline queue QC (localStorage) | ✅ | `src/features/qc/lib/offline-queue.ts` |
| M6.6 Hook sync + online retry | ✅ | `src/features/qc/hooks/use-offline-qc-queue.ts` |
| M6.6 Integrasi dialog + banner indikator | ✅ | `src/features/qc/components/inspection-dialog.tsx`, `src/routes/_authenticated/qc.tsx` |
| M6.8 Manual test checklist | ✅ artifact only | `tasks/m6-offline-manual-test.md` |
| Codex review final | ✅ | PASS |

## Queue Design

Key localStorage:
- `dsm-mos:qc-offline-queue`

Shape item:
```ts
{
  id: string,
  kind: 'update-inspection' | 'trigger-rework',
  inspectionId: string,
  payload?: {
    status?: QcStatus,
    qty_total?: number,
    qty_ok?: number,
    qty_reject?: number,
    defect_notes?: string | null,
  },
  createdAt: string,
}
```

Covered operations:
- save draft
- status transition `waiting -> inspection`
- status transition `inspection -> pass/reject`
- RPC `trigger_rework`

## Behavior

### Offline detection
- direct check: `!navigator.onLine`
- fallback detection on failure: `isOfflineLikeError()` checks offline-ish fetch/network errors

### When offline / network failure
- action is queued locally
- toast shown: `Tersimpan lokal, menunggu sinkronisasi`
- for `pass` / `reject` / `trigger_rework`, dialog closes after queue success
- if localStorage write fails, explicit error toast shown

### Sync behavior
- sequential / serial processing
- auto-run on `window` `online` event
- manual button `Coba sinkronkan` available in amber banner
- stops on first failure and keeps failed item + tail in queue
- invalidates `qc-inspections` query if any item syncs successfully

### Safety fixes after Codex review
- synchronous module mutex `syncLock` prevents concurrent `sync()` double-processing
- `dequeue()` now returns boolean; if localStorage write-back fails after a successful remote action, sync stops and warns instead of silently replaying later

## Review Cycle

### Iterasi 1
- Claude Code implemented queue + banner + manual checklist.
- Hermes verify:
  - `bunx tsc --noEmit` ✅
  - `bun run lint` ✅
  - `bun run build` ✅
- Codex review 1: `pass_with_major`
  - Major: sync mutex race — `online` event and manual button could process same item twice
  - Minor: enqueue/localStorage write failure not surfaced

### Iterasi 2 (Hermes fix)
- `src/features/qc/hooks/use-offline-qc-queue.ts`
  - add module-level `syncLock`
  - set before first await
- `src/features/qc/lib/offline-queue.ts`
  - `writeQueue()` safe boolean return
  - `enqueue()` returns `null` on storage failure
  - `dequeue()` returns boolean
- `src/features/qc/components/inspection-dialog.tsx`
  - `queueOrNotify()` helper
  - explicit error toast if queue write fails
- `src/features/qc/hooks/use-offline-qc-queue.ts`
  - stop sync if dequeue write-back fails after successful remote operation
- Hermes verify again:
  - `bunx tsc --noEmit` ✅
  - `bun run lint` ✅
  - `bun run build` ✅
- Codex re-review 2: **PASS**

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

## Manual Test Artifact

Checklist ready:
- `tasks/m6-offline-manual-test.md`

Isi:
1. buka QC page
2. pilih waiting inspection
3. matikan network di devtools
4. save draft offline
5. queue transition offline
6. cek banner count
7. nyalakan network
8. verifikasi auto-sync + refresh persistence
9. optional reject/rework path

## Remaining Work

1. **M6.8 actual browser run belum dilakukan** [Certain]
   - checklist ada
   - execution manual belum

2. **Checkpoint M6 belum boleh dicentang** [Certain]
   - butuh browser/manual proof untuk offline→online sync
   - butuh `get_advisors`

3. **Outstanding non-M6** [Certain]
   - deploy + `get_advisors` masih butuh MCP OAuth user
   - browser smoke global masih butuh user/manual

## Recommendation

Next safest move:
1. jalankan checklist `tasks/m6-offline-manual-test.md` di browser nyata
2. kalau lolos, centang M6.8
3. lalu urus `get_advisors`
4. baru putuskan apakah Checkpoint M6 bisa ditutup

## Files Touched
- `src/features/qc/lib/offline-queue.ts`
- `src/features/qc/hooks/use-offline-qc-queue.ts`
- `src/features/qc/components/inspection-dialog.tsx`
- `src/routes/_authenticated/qc.tsx`
- `tasks/m6-offline-manual-test.md`
- `tasks/todo.md`
