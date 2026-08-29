# DSM Manufacturing Operating System — CLAUDE.md

Ini file konteks permanen yang otomatis dibaca setiap sesi. Sebelum mengerjakan fitur apa pun, baca `PRD.md` di root repo — itu spesifikasi lengkap. File ini hanya aturan keras yang tidak boleh dilanggar.

## Apa Ini

DSM MOS — Manufacturing Operating System untuk perusahaan manufaktur sheet metal. **BUKAN ERP.** Scope: `Sales Order → Engineering → Production → Quality Control → Delivery`.

Tidak termasuk dan JANGAN dibangun kecuali diminta eksplisit: CRM, Purchasing, Inventory, Warehouse Management, Finance, Accounting, HR, Payroll, dan pembuatan/pencetakan dokumen surat jalan resmi (itu ditangani sistem finance terpisah di luar repo ini).

## Stack — Tidak Bisa Ditawar

- Frontend: React + TypeScript strict, Vite, React Router, Tailwind, shadcn/ui, TanStack Query.
- Backend: Supabase (Postgres, Auth, RLS, Edge Functions, Realtime, Storage) — **satu-satunya backend**. JANGAN membuat server API terpisah (Express/NestJS/Next.js API routes).
- Migration lewat `supabase/migrations/` atau MCP `apply_migration` — JANGAN ubah skema lewat Supabase Dashboard.
- Setelah migration: generate ulang type TypeScript, jalankan `get_advisors` (security & performance), perbaiki semua temuan sebelum lanjut ke task berikutnya.

## RLS — Tidak Bisa Ditawar

- RLS **enabled di setiap tabel** schema `public`, tanpa kecuali. Tabel tanpa policy = tertutup total, itu default yang benar.
- Peran disimpan di tabel `user_roles`, **JANGAN PERNAH** di `raw_user_meta_data`.
- Cek peran lewat function `security definer stable` `public.has_role(_user_id uuid, _role app_role)` dengan `set search_path = ''`.
- Policy terpisah per operasi (select/insert/update/delete) dan per peran. JANGAN `for all`.
- `service_role` key hanya di Edge Function secrets, TIDAK PERNAH di kode frontend.
- Kalau query kosong karena RLS: **perbaiki policy, jangan matikan RLS**.

## Database — Tidak Bisa Ditawar

- PK `uuid default gen_random_uuid()`. Setiap tabel: `created_at`, `updated_at` (trigger, bukan client), `created_by`.
- State pakai Postgres `enum type`, bukan `text` bebas. Transisi state divalidasi trigger, bukan hanya di frontend.
- Uang & kuantitas: `numeric(18,4)`. JANGAN `float`.
- Nomor dokumen (SO/job/batch/DO) dari Postgres sequence + function, BUKAN dari client.
- Operasi multi-tabel = satu Postgres function via `supabase.rpc()`, satu transaksi.
- Business rule (gate produksi, gate delivery, dst) ditegakkan di **database** (trigger/constraint), bukan hanya validasi di UI. Lihat `PRD.md` bagian Business Rules untuk daftar lengkap.

## Peran (app_role)

`admin`, `sales`, `engineering`, `material`, `production_planning`, `production`, `qc`, `delivery`, `viewer`.

Empat pasangan ini **masing-masing dua peran terpisah**, jangan digabung:

- Engineering (desain teknik) vs Material (kesiapan bahan)
- Production Planning (buat batch & jadwal) vs Production (eksekusi Kanban harian)

## Kode

- TypeScript strict, **JANGAN `any`**. Tipe database di-generate dari Supabase.
- Query Supabase dibungkus custom hook per fitur, tidak dipanggil langsung di komponen.
- Struktur folder per fitur: `src/features/<nama-fitur>/{components,hooks,types}`.
- Error Postgres dipetakan ke pesan manusia, jangan bocorkan detail teknis ke UI operator.

## UI

Gaya Linear/Notion/Stripe Dashboard. Prioritas: kecepatan operator shop floor (≤3 klik, tombol besar untuk sarung tangan, status warna + label teks, dark mode ready).

Kanban dan Gantt (dipakai di Production & Delivery) **TIDAK BOLEH pakai drag-and-drop** — pindah status lewat tombol. Drag tidak reliable di layar sentuh pabrik dengan sarung tangan. **Pengecualian: Kanban Production (M5) — drag-and-drop diizinkan** (dioperasikan satu admin dengan mouse di laptop, bukan touchscreen sarung tangan; lihat SPEC.md §Divergensi dari CLAUDE.md dan PRD.md §M5). Gantt & Kanban lain tetap tombol saja.

## Cara Kerja

1. Baca `PRD.md`, kerjakan satu milestone pada satu waktu, urut sesuai daftar di sana. Jangan lompat atau gabung beberapa milestone dalam satu batch kerja.
2. Sebelum coding: tulis rencana singkat — dampak database, dampak RLS, edge case. Ini bukan opsional.
3. Requirement ambigu atau bertentangan dengan `PRD.md` → **tanya, jangan berasumsi**.
4. Tulis pgTAP test untuk RLS setiap tabel baru (satu test per peran: akses yang diizinkan DAN yang ditolak).
5. Commit per milestone dengan pesan jelas, bukan satu commit raksasa di akhir.
6. Jangan membuat mock data, placeholder, atau `// TODO` bila implementasi nyata bisa dibuat.
7. Bagian "Asumsi & Keputusan Terbuka" di `PRD.md` berisi hal-hal yang BELUM dikonfirmasi pemilik produk — kalau pekerjaanmu menyentuh salah satunya, tandai dan tanyakan, jangan diam-diam pilih salah satu.
