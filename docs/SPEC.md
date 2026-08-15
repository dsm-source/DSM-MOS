# Spec: DSM Manufacturing Operating System

> Diturunkan dari `docs/PRD.md` v3 (sumber kebenaran requirement, hasil sesi interview mendalam) dan `docs/CLAUDE.md` (aturan keras). Kalau ada perbedaan antara dokumen ini dan PRD, PRD menang — laporkan selisihnya, jangan diam-diam pilih salah satu. **`docs/CLAUDE.md` sudah tidak akurat di beberapa bagian** (lihat §Divergensi dari CLAUDE.md) — perlu diupdate manual oleh product owner, bukan oleh agen tanpa konfirmasi, karena file itu instruksi permanen yang dibaca otomatis tiap sesi.

## Objective

Membangun sistem tracking operasional untuk pabrik sheet metal yang mendigitalkan lima tahap: **Sales Order → Engineering → Production → Quality Control → Delivery**. Tujuan utama: setiap divisi (9 peran, lihat §Peran) punya tampilan kerja sendiri yang cepat dipakai (≤3 klik per aksi harian), dan aturan bisnis lintas-divisi (gate material, gate QC per-tahapan, urutan proses produksi) ditegakkan oleh database — bukan diingat manusia atau divalidasi hanya di UI.

**Bukan ERP.** Non-goals eksplisit: CRM, Purchasing, Inventory/Warehouse, Finance/Accounting, HR, Payroll, cetak dokumen surat jalan resmi, integrasi otomatis ke sistem finance eksternal, kalkulasi cycle-time otomatis, app terpisah untuk operator mesin/driver, upload foto QC, upload drawing engineering, self-signup akun. Permintaan fitur yang masuk kategori ini → berhenti, konfirmasi ke product owner dulu.

**Success looks like:** kedelapan modul (M1–M8) berjalan sesuai DoD masing-masing di §Success Criteria, RLS menutup akses lintas-peran yang tidak sah, setiap transisi status tercatat otomatis (baik di `audit_logs` forensik maupun tabel `*_history` per-domain), dan modul QC tetap bisa dipakai walau koneksi shop floor putus-putus.

## Divergensi dari CLAUDE.md

`docs/CLAUDE.md` adalah instruksi permanen yang dibaca otomatis tiap sesi, tapi ditulis sebelum sesi refinement ini — dua baris di dalamnya sekarang **tidak sesuai lagi** dengan PRD v3:

1. *"Kanban dan Gantt ... TIDAK BOLEH pakai drag-and-drop"* — PRD v3 §9/M5 **membalik ini untuk Kanban Production**: drag-and-drop dipakai karena inputnya admin dengan mouse di laptop/PC, bukan operator sarung tangan di touchscreen. Gantt (M4, M7) tetap tombol saja, tidak drag.
2. Daftar 9 peran di PRD §4 (termasuk catatan device/pola kerja per peran) lebih detail dari yang ada di CLAUDE.md.

**Jangan edit `CLAUDE.md` tanpa konfirmasi eksplisit product owner** — flag ini di awal setiap sesi kerja sampai product owner update filenya sendiri.

## Status Proyek Saat Ini

Repo ini **bukan greenfield** dari sisi kode, tapi **belum ada Supabase project yang terhubung/dipakai**:

- `supabase/migrations/` berisi 24 migration lokal yang **belum pernah di-deploy** ke database manapun — dan sebagian isinya **sudah tidak sesuai PRD v3** (lihat daftar di bawah), jadi jangan langsung `db push`.
- Supabase project untuk DSM MOS: ref `jtzwawtfymljfqfrplib` (https://supabase.com/dashboard/project/jtzwawtfymljfqfrplib). **MCP Supabase session saat ini tidak punya akses ke project ini** (permission denied saat dicoba) — koneksi MCP yang aktif malah mengarah ke project lain (`dsmsalescrm`, sebuah CRM tidak terkait). Sebelum mulai M0, pastikan MCP/CLI Supabase di-reconnect ke akun yang benar dan project `jtzwawtfymljfqfrplib` bisa diakses.
- `src/features/` sudah punya folder per modul: `customers`, `dashboard`, `sales-orders`, `engineering`, `material`, `production`, `qc`, `delivery`, `notifications`.

**Migration lokal yang perlu direvisi/dibuang sebelum deploy** (temuan audit terhadap PRD v3):
| Item di migration lokal | Status vs PRD v3 |
|---|---|
| `engineering_jobs.drawing_url` | Hapus kolom — engineering tidak simpan drawing lagi |
| `qc_inspections.photo_urls`, relasi ke `production_batch_id` | Hapus kolom foto; ubah relasi ke `production_batch_step_id` (QC per-tahapan, bukan per-batch) |
| `app_role` enum (kalau migration sempat dibuat dengan 5 role per-stasiun) | Pastikan cuma **satu** `production` role, bukan `production_laser_cutting` dst |
| Tabel `operators` | **Belum ada di migration lokal** — perlu dibuat baru (lihat PRD §6.2) |
| `production_batch_steps.operator_id` | Ubah FK dari `auth.users` → `operators.id` |
| `sales_order_assignments`, `sales_order_status_history`, `engineering_job_history`, `material_status_history`, `notifications` | **Sudah benar dan matang** — pertahankan, sekarang resmi terdokumentasi di PRD §6.2 |

Implikasi: jangan asumsikan struktur migration lokal saat ini sudah final. **Audit tiap migration terhadap PRD v3 dulu** sebelum lanjut kerja di modul manapun, dan jangan deploy ke Supabase sebelum revisi di atas selesai.

## Tech Stack

- Frontend: React 19 + TypeScript strict + Vite + TanStack Router + TanStack Query + Tailwind v4 + shadcn/ui (Radix primitives) + react-hook-form + zod.
- Gantt: `gantt-task-react` (Production Planning §M4 dan Delivery Schedule §M7 — jangan bangun custom).
- Backend: Supabase penuh (Postgres + Auth + RLS + Edge Functions + Realtime + Storage). **Tidak ada server API terpisah.**
- Offline (khusus QC): local queue di browser (IndexedDB atau localStorage) untuk submit-only saat offline + auto-sync saat online kembali. Tidak perlu service worker/PWA penuh kecuali dibutuhkan untuk keandalan queue — evaluasi kebutuhan riil saat implementasi M6, jangan over-engineer dari awal.
- Package manager: Bun (`bun.lock`, `bunfig.toml` ada di root).
- Testing: Vitest + Testing Library (unit/component), pgTAP (RLS, dijalankan di Supabase lokal).

## Commands

```
Dev:      bun run dev
Build:    bun run build
Test:     bun run test              # vitest run
Lint:     bun run lint
Format:   bun run format
Migration: supabase migration new <nama>   # atau MCP apply_migration — JANGAN via Dashboard
Generate types: supabase gen types typescript --local > src/integrations/supabase/types.ts
Advisors: MCP get_advisors (security + performance) — wajib bersih sebelum lanjut task berikutnya
pgTAP:    supabase test db   # dijalankan terhadap Supabase lokal, bukan produksi
```

## Project Structure

```
src/
  features/<nama-fitur>/
    components/   → komponen UI khusus fitur ini
    hooks/         → custom hook pembungkus query Supabase (JANGAN panggil Supabase langsung di komponen)
    lib/           → helper murni (mapping error, formatting, dsb)
  components/ui/    → shadcn/ui primitives (jangan taruh logika fitur di sini)
  integrations/supabase/  → client Supabase + types.ts hasil generate (JANGAN ditulis manual)
  routes/            → TanStack Router route tree, termasuk _authenticated/
  hooks/, lib/       → shared, lintas-fitur
  test/              → setup test

supabase/
  migrations/        → satu file per perubahan skema, timestamp-prefixed
  config.toml

docs/
  PRD.md    → requirement lengkap, sumber kebenaran (v3, hasil refinement)
  CLAUDE.md → aturan keras — sebagian sudah stale, lihat §Divergensi
  SPEC.md   → dokumen ini
```

Fitur baru mengikuti pola `src/features/<nama-fitur>/{components,hooks,lib}` yang sudah ada.

## Code Style

Contoh pola query yang sudah dipakai di repo (custom hook membungkus Supabase, bukan dipanggil langsung dari komponen):

```ts
// src/features/engineering/hooks/useEngineeringJobs.ts
export function useEngineeringJobs(filters: EngineeringJobFilters) {
  return useQuery({
    queryKey: ["engineering-jobs", filters],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("engineering_jobs")
        .select("*, sales_order_items(item_name, drawing_number)")
        .match(filters);
      if (error) throw mapPostgresError(error); // JANGAN bocorkan detail teknis ke UI
      return data;
    },
  });
}
```

Konvensi:
- TypeScript strict, **tidak ada `any`**. Tipe database dari `src/integrations/supabase/types.ts` (generated).
- Enum Postgres, bukan string bebas, untuk semua kolom status (lihat PRD §6.1).
- Uang & kuantitas: `numeric(18,4)`, jangan `float`.
- Operasi multi-tabel (mis. trigger rework, approve engineering job) = satu Postgres function via `supabase.rpc()`, satu transaksi — bukan beberapa `update()` berurutan dari client. Rework khususnya **wajib** lewat RPC (PRD §7 rule #3), tidak boleh update langsung ke `production_batch_steps.status`.
- Error Postgres dipetakan ke pesan manusia (`23505` → nomor dokumen dipakai, `23503` → data terkait tidak ditemukan) lewat helper terpusat.
- **Kanban Production (M5): drag-and-drop diizinkan** (admin pakai mouse di laptop/PC — lihat §Divergensi dari CLAUDE.md). **Gantt (M4, M7): tombol saja**, tidak drag.
- Modul QC (M6): komponen wajib mobile-responsive, form sederhana (tanpa foto), dan submit harus tahan offline (queue lokal + retry).

## Testing Strategy

- **Unit test** (Vitest): logika bisnis di `lib/` per fitur — mapping error, kalkulasi tampilan (overdue detection, dst), offline queue logic untuk QC — tidak menyentuh Supabase langsung (mock).
- **pgTAP**: satu file test per tabel baru, dengan minimal satu test per peran (`admin`, `sales`, `engineering`, `material`, `production_planning`, `production`, `qc`, `delivery`, `viewer`) mencakup **akses yang diizinkan DAN yang ditolak** — sesuai RLS Matrix di PRD §8.
- **Trigger/business-rule test**: setiap business rule di PRD §7 harus punya test yang mencoba melanggar rule lewat SQL/RPC langsung dan memverifikasi ditolak. Prioritas: gate produksi (#1), gate QC per-tahapan (#2), rework hanya lewat RPC (#3), gate delivery (#4-5).
- **Offline test (M6)**: simulasikan browser offline (mis. matikan network di dev tools) saat submit form QC, verifikasi data tersimpan lokal, lalu nyalakan network dan verifikasi auto-sync ke Supabase.
- Test dijalankan sebelum commit per milestone.

## Boundaries

**Selalu (Always):**
- Baca `docs/PRD.md` v3 sebelum menyentuh modul manapun — jangan pakai asumsi dari draft PRD lama.
- Kerjakan satu milestone (M1–M8) per batch kerja, urut sesuai PRD §12.
- Audit migration lokal yang relevan terhadap PRD v3 sebelum menulis migration baru di modul yang sama (lihat tabel revisi di §Status Proyek Saat Ini).
- Tulis rencana singkat (dampak DB, dampak RLS, edge case) sebelum coding.
- Tulis pgTAP test untuk setiap tabel baru (satu test per peran: diizinkan + ditolak).
- Jalankan `get_advisors` setelah setiap migration.
- Generate ulang TypeScript types setelah migration.
- Commit per milestone dengan pesan jelas.
- Business rule (gate) ditegakkan di trigger/constraint database.

**Tanya dulu (Ask first):**
- Menyentuh poin #10 di PRD §11 (auto-fill `estimated_delivery_date` → `planned_delivery_date`) — satu-satunya keputusan yang belum final.
- Menambah tabel/kolom yang tidak disebut di PRD §6.
- Requirement yang ambigu atau tampak bertentangan dengan PRD v3.
- Fitur yang masuk kategori non-goal (§Objective).
- Menambah dependency baru di luar `package.json` (termasuk untuk kebutuhan offline queue di M6 — evaluasi apakah `localStorage`/IndexedDB native cukup sebelum menambah library).
- Mengedit `docs/CLAUDE.md` — walau sekarang stale, itu instruksi permanen milik product owner.

**Jangan pernah (Never):**
- Mengubah skema lewat Supabase Dashboard.
- Menyimpan peran di `raw_user_meta_data`.
- Mematikan RLS untuk "memperbaiki" query kosong.
- Menaruh `service_role` key di kode frontend.
- Membuat drag-and-drop di **Gantt** (beda dengan Kanban Production yang boleh).
- Membuat role per-stasiun produksi (`production_laser_cutting` dst) — sudah diputuskan final: satu role `production` saja.
- Membuat fitur upload foto di QC atau upload drawing di Engineering.
- Membuat alur self-signup / registrasi publik.
- Membuat mock data, placeholder, atau `// TODO` bila implementasi nyata bisa langsung dibuat.
- Membuat server API terpisah — Supabase satu-satunya backend.

## Success Criteria

Per-modul DoD (dari PRD §9 v3 — lihat PRD untuk detail UI lengkap):

| Modul | DoD |
|---|---|
| M1 Sales Order | Trigger validasi transisi status jalan; SO `confirmed` otomatis buat Engineering Job + Material Status; perubahan status SO memicu `sales_order_status_history` + `notifications` ke role relevan (test terverifikasi) |
| M2 Engineering | Tidak bisa `in_progress` tanpa assigned_to+target; `progress_percent` terkunci 100 saat approved; `v_engineering_workload` accessible **semua peran**; setiap perubahan field tercatat di `engineering_job_history` |
| M3 Material | `material_statuses` selalu 1:1 dengan engineering_job; perubahan status tercatat di `material_status_history` |
| M4 Production Planning | Hanya production_planning/admin insert/update `production_batches` & `operators`; routing (`routing jsonb`) menentukan baris `production_batch_steps` yang dibuat; Gantt terisolasi dari data `deliveries` |
| M5 Production Execution | Satu Kanban Per-Batch (bukan dua tampilan); trigger gate (PRD §7 rule #1) tidak bisa dilewati lewat manipulasi API langsung; role `production` (satu, bukan per-mesin) bisa update semua step |
| M6 QC | `qc_inspections` per-step, tidak bisa dibuat sebelum step `completed`; tidak ada kolom foto; rework hanya lewat RPC formal role qc/admin; **form berfungsi offline (submit ke local queue, auto-sync saat online)** — verifikasi manual wajib |
| M7 Delivery | Tidak ada tombol cetak/export PDF; `do_number` kode internal; tidak bisa keluar `draft` tanpa dua tanggal rencana terisi |
| M8 Audit & Dashboard | `audit_logs` tidak punya policy INSERT untuk role manapun; dashboard pakai `v_dashboard_*` views; admin bisa buat user + assign role dari UI (tanpa akses Supabase Dashboard langsung); `get_advisors` bersih |

Sistem dianggap selesai kalau seluruh baris di atas terverifikasi dan RLS Matrix PRD §8 tertegakkan penuh di seluruh tabel `public`, termasuk tabel notifikasi/history yang sekarang resmi.

## Open Questions

Hanya **satu** poin yang masih belum final (semua yang lain sudah dikonfirmasi eksplisit lewat sesi interview — lihat PRD §11 untuk riwayat lengkap termasuk keputusan yang sempat dibalik):

1. **PRD §11 poin #10** — `estimated_delivery_date` (Production Planning) TIDAK auto-fill ke `deliveries.planned_delivery_date`. Ini keputusan desain untuk memisahkan forecast vs komitmen aktual, belum diuji ke user apakah auto-fill sebagai starting point tetap diinginkan. Kalau pekerjaan di M4/M7 menyentuh ini, tanya ulang sebelum lanjut.

**Item non-PRD yang perlu diselesaikan sebelum M0 dimulai** (bukan open question ke product owner, tapi blocker teknis):
2. Koneksi Supabase MCP/CLI perlu diarahkan ke project `jtzwawtfymljfqfrplib` — saat ini tidak accessible dari sesi kerja ini (permission denied), dan koneksi yang aktif malah ke project lain yang tidak terkait.
