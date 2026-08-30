# Prompt Codex — Retest BUG-2 + BUG-8 di browser (setelah fix `1f720c4`)

Retest **fokus 2 bug** setelah fix commit `1f720c4`. Bukan full smoke, bukan review kode.
Tujuan: buktikan di browser bahwa BUG-2 dan BUG-8 benar-benar tertutup, tanpa regresi di area sekitarnya.

Task ini **functional retest atas permintaan langsung owner**, **hanya di local Supabase stack**.

---

## Context (wajib dibaca — jangan asumsikan histori percakapan)

- Project: **DSM MOS** (Manufacturing Operating System). Stack: Supabase (Postgres + RLS + triggers + RPC) + TanStack Start/React + Tailwind + shadcn/ui.
- App dev: `bun run dev` → `http://localhost:8080/` (Vite fallback `8081` kalau 8080 dipakai). Local stack: `supabase start`.
- Remote project ID (**JANGAN DISENTUH**): `jtzwawtfymljfqfrplib`. Semua kerja murni di local stack.
- Login: kredensial per-role diberikan owner saat run. Minimal butuh: 1 `admin`, 1 `delivery`.
- RBAC roles: `admin`, `sales`, `qc`, `production`, `production_planning`, `material`, `delivery`, `viewer`.

### Riwayat

| Ronde | Report | Verdict |
|---|---|---|
| Full smoke ronde 3 | `tasks/codex-full-smoke-retest3-report.md` | FAIL — BUG-2 & BUG-8 masih open |
| **Retest ini** | `tasks/codex-bug2-bug8-retest-report.md` | — |

### Isi fix `1f720c4` (yang harus kelihatan bekerja)

- **BUG-8** — `supabase/migrations/20260830000001_m8_eng_jobs_select_delivery.sql` (baru):
  policy `eng_jobs_select_scoped` pada `public.engineering_jobs` sekarang menyertakan role `delivery`.
  Alasan: query kandidat QC di `src/features/delivery/hooks/use-deliveries.ts` (`useEligibleQcInspections`)
  melakukan inner-join `qc_inspections → production_batch_steps → production_batches → engineering_jobs → sales_order_items`.
  Role `delivery` sudah punya SELECT di semua tabel itu kecuali `engineering_jobs`, jadi query balik 0 row.
  Test RLS-matrix `supabase/tests/engineering.test.sql` di-flip: "delivery denied" → "delivery can SELECT".
- **BUG-2** — `src/routes/change-password.tsx`:
  tidak lagi memanggil `supabase.auth.signOut({ scope: "local" })`. Sebagai gantinya menghapus
  persisted session langsung dari `localStorage` (key pola `sb-*-auth-token`) lalu `window.location.assign("/auth")`.
  Alasan: admin API sudah me-revoke session saat password diganti; `signOut` apa pun (termasuk `scope:"local"`)
  tetap POST `/auth/v1/logout` dengan token mati → `403` yang tampil di Console sebagai
  `Failed to load resource: 403 (Forbidden)`.

## Persiapan

1. `git log --oneline -3` → pastikan `1f720c4` (fix BUG-2 + BUG-8) ada di working tree. Kalau belum, `git pull` (branch `main`).
   Expected HEAD sekitar: `2061b3e` (docs todo) atau lebih baru; `1f720c4` wajib ada.
2. `supabase db reset` → konfirmasi migration `20260830000001_m8_eng_jobs_select_delivery.sql` **teraplikasi** (lihat output).
3. Seed: `supabase/seed-demo/20260823_demo_200_dataset.sql` via `psql` ke local stack.
4. Fixture (SQL langsung, prefix jelas `BUG28-`, cleanup di akhir) — siapkan:
   - **Untuk BUG-8**: 1 SO dengan minimal 1 item yang punya `engineering_job` → `production_batch` → step terakhir dengan `qc_inspections.status = 'pass'` (`qty_ok > 0`), dan SO itu **belum punya delivery**. Set `sales_orders.status = 'quality_control'` (atau status yang bikin SO muncul di selector "Rencana Baru"). Catat: `so_number`, `sales_order_id`, `qc_inspection_id`, `qty_ok`.
   - **Untuk BUG-2**: tidak perlu fixture SQL — user dibuat lewat UI `/admin`.
5. `bun run dev` + `supabase status` sehat.
6. Quality gate (catat hasil, stop kalau FAIL):
   - `supabase test db` → harus **256/256 PASS** (test engineering.test.sql yang di-flip termasuk di sini).
   - `bunx tsc --noEmit`
   - `bun run lint` (37 warning `react-refresh/only-export-components` = sudah diketahui, OK)
   - `bun run build`

## Yang harus diuji

### A. BUG-2 — forced password-change tidak lagi 403 di logout

1. Login `admin`. Buka `/admin` → "Buat User Baru", role `viewer`, password sementara (≥8 char). Catat email + password temp.
2. Logout admin. Buka **DevTools → Network + Console**, aktifkan "Preserve log".
3. Login sebagai user baru dengan password temp → auto-redirect ke `/change-password`.
4. Isi password baru (≥8 char) + konfirmasi cocok → submit.
5. **Lulus kalau SEMUA benar:**
   - **Tidak ada** request ke `auth/v1/logout` sama sekali (baik `?scope=global` maupun `?scope=local`). *(Fix baru menghapus panggilan signOut — kalau masih ada request logout apa pun, fix tidak jalan.)*
   - **Tidak ada** response `403` di Network.
   - **Tidak ada** console error merah (khususnya `Failed to load resource: ... 403`).
   - Halaman berpindah ke `/auth` (via full reload — akan terlihat sebagai navigasi dokumen baru, bukan SPA transition).
   - Toast "Kata sandi berhasil diganti" muncul sebelum reload.
6. Lanjut: login dengan **password baru** → masuk `/dashboard`.
7. Reload `/dashboard` → **tidak** loop balik ke `/change-password` (flag `must_change_password` benar-benar clear).
8. Cek `localStorage` setelah step 4 (sebelum login ulang): key `sb-*-auth-token` sudah **hilang**.
9. Screenshot: Network tab (filter `logout` → kosong) + Console (bersih) + halaman `/auth` setelah redirect.

### B. BUG-8 — role `delivery` bisa menambah item QC pass ke delivery draft

10. Login role `delivery`. Buka `/delivery` → "Rencana Baru".
11. Pilih SO fixture `BUG28-` (yang punya QC pass, belum ada delivery). Isi jadwal/driver/vehicle/notes → submit.
12. Delivery draft dibuat (mis. `DLV-2026-0000xx`, status `draft`) → halaman detail `/delivery/<id>` terbuka.
13. Buka dropdown **"Pilih hasil QC (Lulus)"**.
14. **Lulus kalau:**
    - Dropdown **menampilkan** minimal 1 baris kandidat (batch number + item name + `qty_ok`), **bukan** "Tidak ada hasil QC lulus yang tersedia."
    - Baris yang muncul cocok dengan `qc_inspection_id` fixture.
15. Pilih kandidat itu → isi qty kirim (≤ `qty_ok`) → tambah item.
16. Verifikasi DB (`psql` sebagai owner / service role): `delivery_items` baru terisi dengan `qc_inspection_id` + `delivery_id` yang benar.
17. Klik transisi **"→ Disiapkan"** (draft → prepared).
    - **Lulus kalau:** transisi sukses (status jadi `prepared`), **bukan** error `400` / "Pengiriman belum memiliki item."
18. Lanjut transisi: prepared → shipped → delivered. Cek SO auto-`completed` setelah delivered (kalau memang itu behavior-nya — cross-check `sales_order_status_history`).
19. Screenshot: dropdown kandidat terisi + delivery detail setelah item ditambah + status `prepared`.

### C. Regresi cek cepat (jangan sampai fix BUG-8 melebarkan akses)

20. **Login role `delivery`**, coba buka langsung route yang bukan haknya:
    - `/engineering` (atau route engineering job list) — konfirmasi apakah `delivery` sekarang bisa **lihat detail engineering job**. Fix ini memang memberi `delivery` SELECT `engineering_jobs` di DB. Yang perlu dicek: **sidebar/route guard app tidak berubah** — `delivery` tidak tiba-tiba dapat menu Engineering kalau sebelumnya tidak. Catat kondisi aktual (sebelumnya di ronde 3: `delivery` **tidak** LEAK Engineering; harus tetap begitu di UI).
    - Konfirmasi `delivery` **tetap tidak bisa** INSERT/UPDATE `engineering_jobs` (policy write tidak diubah) — coba 1 UPDATE via query sebagai role `delivery` → harus ditolak RLS.
21. **Login role lain yang tidak terkait** (`material` atau `qc`): buka `/delivery` dan `/engineering` seperti biasa — tidak ada perubahan perilaku, tidak ada error baru.
22. RBAC matrix role × sidebar — bandingkan cepat dengan tabel di `tasks/codex-full-smoke-retest3-report.md` §6. **Lulus kalau tidak ada perubahan** (fix ini murni RLS SELECT DB, tidak menyentuh sidebar/route guard).
23. Console + Network sepanjang semua langkah: tidak ada uncaught error / 5xx tak terduga / request loop.

## Output yang diminta

Simpan report ke `tasks/codex-bug2-bug8-retest-report.md`, format:

1. **Verdict**: PASS / FAIL — untuk BUG-2 dan BUG-8 masing-masing, + apakah layak menutup keduanya.
2. **Ringkasan setup**: `git rev-parse HEAD`, konfirmasi migration M8 teraplikasi, fixture `BUG28-` yang dibuat, hasil 4 quality gate (`supabase test db` harus 256/256).
3. **BUG-2 detail**: langkah dieksekusi + hasil aktual vs harapan (khusus: ada/tidak request `logout`, ada/tidak `403`, ada/tidak console error, apakah `localStorage` key hilang, apakah reload loop) + screenshot path.
4. **BUG-8 detail**: langkah dieksekusi + isi dropdown kandidat + hasil verifikasi DB `delivery_items` + hasil transisi draft→prepared(→shipped→delivered) + screenshot path.
5. **Regresi**: hasil cek C (akses `delivery` ke engineering_jobs read-only saja; sidebar/route guard tidak berubah; role lain aman) — ada / tidak ada regresi.
6. **Bug baru** (kalau ada): severity, modul + route, repro, aktual vs harapan, screenshot.
7. **Kesimpulan**: apakah BUG-2 & BUG-8 sekarang bisa ditandai CLOSED; sisa risiko / follow-up owner (mis. BUG-6 DnD masih open, di luar scope retest ini).
8. **Cleanup**: hapus semua fixture `BUG28-` + user viewer yang dibuat via `/admin`; jalankan `supabase test db` sekali lagi → konfirmasi balik **256/256 PASS** di state bersih.

## Rules

- **Hanya local Supabase stack.** Jangan pernah mutasi remote `jtzwawtfymljfqfrplib`.
- **Jangan ubah kode** (`src/`, `vite.config.ts`) atau migration. Boleh menambah file seed/fixture/report baru saja.
- **Jangan perbaiki bug** apa pun yang ditemukan — cukup laporkan.
- Kalau BUG-2 atau BUG-8 **masih FAIL** setelah `1f720c4` → temuan penting, laporkan detail persis (network trace untuk BUG-2; hasil query eligibility sebagai role `delivery` + `EXPLAIN`/error untuk BUG-8) dan kembalikan ke owner tanpa memperbaiki.
- Kalau login gagal / stack tidak sehat → hentikan, laporkan blocker.
- Jangan tinggalkan fixture `BUG28-` atau user test di DB — wajib cleanup + verifikasi `supabase test db` balik 256/256 PASS.

---

## Prompt singkat versi sekali tempel

```text
Retest FOKUS BUG-2 + BUG-8 DSM MOS di LOCAL Supabase stack saja (jangan sentuh remote jtzwawtfymljfqfrplib). Jangan ubah kode/vite.config/migration; jangan perbaiki bug apa pun; boleh tambah file seed/fixture/report saja. Baseline: tasks/codex-full-smoke-retest3-report.md (BUG-2 & BUG-8 masih open). Fix di commit 1f720c4: (BUG-8) migration supabase/migrations/20260830000001_m8_eng_jobs_select_delivery.sql menambah role `delivery` ke policy eng_jobs_select_scoped di engineering_jobs, karena query useEligibleQcInspections (src/features/delivery/hooks/use-deliveries.ts) inner-join qc_inspections->production_batch_steps->production_batches->engineering_jobs->sales_order_items dan delivery tidak punya SELECT engineering_jobs; test engineering.test.sql di-flip. (BUG-2) src/routes/change-password.tsx tidak lagi signOut() — hapus localStorage key sb-*-auth-token lalu window.location.assign("/auth"), karena signOut apa pun tetap POST /auth/v1/logout dengan token yang sudah di-revoke -> 403 di Console. Persiapan: git log pastikan 1f720c4 ada, `supabase db reset` (konfirmasi migration M8 applied), seed supabase/seed-demo/20260823_demo_200_dataset.sql, buat fixture BUG28- (1 SO status quality_control dengan item -> engineering_job -> production_batch -> step terakhir qc_inspections.status='pass' qty_ok>0, belum punya delivery; catat so_number/sales_order_id/qc_inspection_id), `bun run dev`, jalankan `supabase test db` (WAJIB 256/256 PASS) + `bunx tsc --noEmit` + `bun run lint` + `bun run build`. Uji: (A) BUG-2 — login admin, /admin buat user role viewer + password temp, logout, buka DevTools Network+Console preserve-log, login user baru -> /change-password, submit password baru: PASTIKAN tidak ada request auth/v1/logout SAMA SEKALI (global maupun local), tidak ada 403, tidak ada console error merah, halaman pindah ke /auth via full reload, toast sukses muncul; cek localStorage key sb-*-auth-token hilang; login ulang password baru -> /dashboard -> reload tidak loop ke /change-password; screenshot Network(filter logout kosong)+Console+/auth. (B) BUG-8 — login role delivery, /delivery "Rencana Baru", pilih SO fixture BUG28-, submit -> draft DLV dibuat -> detail /delivery/<id> terbuka -> buka dropdown "Pilih hasil QC (Lulus)": PASTIKAN muncul minimal 1 kandidat (batch+item+qty_ok) cocok dengan qc_inspection_id fixture, BUKAN "Tidak ada hasil QC lulus yang tersedia"; pilih kandidat, isi qty <= qty_ok, tambah item; verifikasi DB delivery_items terisi benar; klik "-> Disiapkan": PASTIKAN sukses jadi prepared, BUKAN 400 "Pengiriman belum memiliki item"; lanjut prepared->shipped->delivered, cek SO auto-completed via sales_order_status_history; screenshot dropdown terisi + detail + status prepared. (C) Regresi: login delivery coba UPDATE engineering_jobs via query sebagai role delivery -> harus ditolak RLS (write policy tidak diubah); konfirmasi sidebar/route guard delivery TIDAK berubah vs ronde 3 (delivery tetap tidak dapat menu Engineering di UI); login role material/qc buka /delivery + /engineering normal tanpa error baru; RBAC matrix role x sidebar tidak berubah vs tasks/codex-full-smoke-retest3-report.md section 6; console+network bersih. Outputkan report ke tasks/codex-bug2-bug8-retest-report.md: verdict PASS/FAIL per bug, ringkasan setup (HEAD + M8 applied + fixture + 4 gate), BUG-2 detail (ada/tidak logout request, 403, console error, localStorage hilang, reload loop), BUG-8 detail (isi dropdown + verifikasi DB delivery_items + hasil transisi), regresi ada/tidak, bug baru per severity, kesimpulan apakah BUG-2 & BUG-8 bisa ditandai CLOSED + follow-up owner, konfirmasi cleanup fixture BUG28- + user test + supabase test db balik 256/256 PASS. Kalau BUG-2 atau BUG-8 masih FAIL setelah 1f720c4, laporkan detail persis (network trace / hasil query eligibility sebagai role delivery) dan kembalikan ke owner tanpa memperbaiki. Kalau login gagal atau stack tidak sehat, hentikan dan laporkan blocker.
```
