# Checkpoint M8 — Ringkasan Penutupan

Tanggal: 2026-08-21
Status akhir: `closed_with_accepted_risk`

## Scope yang ditutup
- M8.1 Verifikasi `audit_logs` + dashboard views
- M8.2 UI dashboard dari views
- M8.3 Halaman admin lihat `audit_logs`
- M8.4 pgTAP: no INSERT policy `audit_logs`

## Bukti verifikasi
### M8.1
- `audit_logs` ada, RLS enabled, hanya policy `SELECT` admin-only
- tidak ada policy `INSERT/UPDATE/DELETE`
- view ada dan dipakai frontend:
  - `v_dashboard_so_status`
  - `v_dashboard_material_waiting`
  - `v_dashboard_production_running`
- `bunx tsc --noEmit` PASS
- `bun run lint` PASS
- `bun run build` PASS
- Codex verdict: `pass`

### M8.2
- dashboard query langsung ke `v_dashboard_*`
- UI tampilkan Sales Order Aktif, Job Menunggu Material, Produksi Berjalan, dan distribusi SO per status
- `bunx tsc --noEmit` PASS
- `bun run lint` PASS
- `bun run build` PASS
- Codex verdict: `pass_with_minor`
- minor follow-up: error state query dashboard belum eksplisit

### M8.3
- route admin existing `/_authenticated/admin` dipakai
- admin bisa create user manual + assign/unassign role dari UI
- admin bisa lihat 100 audit log terbaru via `listAuditLogs`
- `bunx tsc --noEmit` PASS
- `bun run lint` PASS
- `bun run build` PASS
- Codex verdict: `pass_with_minor`
- minor follow-up: error state query audit log belum eksplisit

### M8.4
- file test focused: `supabase/tests/audit_logs.test.sql`
- membuktikan:
  - tidak ada policy `INSERT/UPDATE/DELETE` pada `audit_logs`
  - hanya ada 1 policy `SELECT` admin-only
  - direct `INSERT` oleh authenticated/admin ditolak
  - admin bisa `SELECT`
  - non-admin tersaring RLS
- `supabase db reset` PASS
- `supabase test db supabase/tests/audit_logs.test.sql` PASS
- `bunx tsc --noEmit` PASS
- `bun run lint` PASS
- `bun run build` PASS
- Codex verdict: `pass`

## Advisors
- Performance advisors: bersih
- Security advisors: 1 WARN `auth_leaked_password_protection`

## Keputusan owner
Owner memilih: **accepted risk seperti M6-M7**.

Artinya warning `auth_leaked_password_protection` tidak memblok penutupan milestone M8 pada sesi ini, dan dicatat sebagai batas setting/platform Auth yang belum diaktifkan.

## Rekomendasi lanjut
- Jika nanti ingin checkpoint benar-benar "bersih total" tanpa catatan, aktifkan leaked password protection di Supabase Auth lalu jalankan ulang `get_advisors`.
- Follow-up non-blocking yang tersisa:
  - error state query dashboard
  - error state query audit log
