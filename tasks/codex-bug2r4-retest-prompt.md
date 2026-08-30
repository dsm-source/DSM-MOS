# Prompt Codex — Retest BUG-2 strict (notifications 401) di browser setelah fix `ed5a915`

Retest **fokus 1 residual bug** (BUG-2R4) setelah fix commit `ed5a915`. Bukan full smoke, bukan review kode.
Tujuan: buktikan di browser bahwa flow forced password-change sekarang **0 console error merah** (termasuk tidak ada 401 dari notifications), sehingga BUG-2 bisa ditutup strict.

Task ini **functional retest atas permintaan langsung owner**, **hanya di local Supabase stack**.

---

## Context (wajib dibaca — jangan asumsikan histori percakapan)

- Project: **DSM MOS** (Manufacturing Operating System). Stack: Supabase (Postgres + RLS + triggers + RPC) + TanStack Start/React + Tailwind + shadcn/ui.
- App dev: `bun run dev` → `http://localhost:8080/` (Vite fallback `8081` kalau 8080 dipakai). Local stack: `supabase start`.
- Remote project ID (**JANGAN DISENTUH**): `jtzwawtfymljfqfrplib`. Semua kerja murni di local stack.
- Login: kredensial `admin` diberikan owner saat run. Cukup 1 `admin` (+ 1 user viewer yang dibuat lewat UI selama test).
- RBAC roles: `admin`, `sales`, `qc`, `production`, `production_planning`, `material`, `delivery`, `viewer`.

### Riwayat

| Ronde | Report | Verdict BUG-2 |
|---|---|---|
| Retest BUG-2 + BUG-8 (`3af4c3f`) | `tasks/codex-bug2-bug8-retest-report.md` | PARTIAL / FAIL strict — 2 console error 401 dari `/rest/v1/notifications` setelah session direvoke; toast sukses tidak terobservasi |
| **Retest ini** (`ed5a915`) | update ke `tasks/codex-bug2-bug8-retest-report.md` | — |

### Isi fix `ed5a915` (yang harus kelihatan bekerja)

Root cause BUG-2R4: setelah `changePasswordAndClearFlag` me-revoke session, cache invalidation
dari root `onAuthStateChange` listener (`src/routes/__root.tsx`) masih bisa me-refetch query
notifications dengan token mati → `401` yang dicatat browser sebagai
`Failed to load resource: ... 401 (Unauthorized)` di Console. Commit `3af4c3f` sebelumnya
menambah `cancelQueries()` + `clear()` tapi tidak menutup race refetch setelah `clear()`.

Perubahan `ed5a915`:

1. **`src/features/notifications/hooks/use-notifications.ts`** — `useNotifications` dan
   `useUnreadCount` sekarang memanggil `supabase.auth.getSession()` lebih dulu; kalau tidak
   ada session, `queryFn` langsung `return []` / `0` **tanpa request** ke PostgREST.
   auth-js `__loadSession` membaca token langsung dari `localStorage`, jadi begitu token
   dihapus, `getSession()` → `null`.
2. **`src/routes/change-password.tsx`** — key `sb-*-auth-token` dihapus dari `localStorage`
   **sebelum** `queryClient.cancelQueries()` / `clear()` (sebelumnya urutannya terbalik).
   Jadi refetch apa pun setelah titik itu ketemu session `null` dan short-circuit.

Toast sukses + `setTimeout(..., 800)` sebelum `window.location.assign("/auth")` sudah ada
dari `3af4c3f`, tidak diubah di `ed5a915`.

## Persiapan

1. `git log --oneline -5` → pastikan `ed5a915` (fix BUG-2R4) ada di working tree. Kalau belum, `git pull` (branch `main`).
   Expected HEAD sekitar: `e8647d0` (docs) atau lebih baru; `ed5a915` wajib ada.
2. `supabase db reset` → stack bersih.
3. Seed: `supabase/seed-demo/20260823_demo_200_dataset.sql` via `psql` ke local stack (opsional untuk BUG-2, tapi berguna supaya bell punya data notifikasi nyata di cek regresi).
4. `bun run dev` + `supabase status` sehat.
5. Quality gate (catat hasil, stop kalau FAIL):
   - `supabase test db` → harus **256/256 PASS** (fix ini murni client-side, seharusnya tidak mengubah angka).
   - `bunx tsc --noEmit`
   - `bun run lint` (37 warning `react-refresh/only-export-components` = sudah diketahui, OK)
   - `bun run build`

## Yang harus diuji

### A. BUG-2 strict — forced password-change: 0 console error merah, 0 request 401/403

1. Login `admin`. Buka `/admin` → "Buat User Baru", role `viewer`, password sementara (≥8 char). Catat email + password temp.
2. **Sebelum** langkah berikut, biarkan admin sempat membuka beberapa halaman yang me-mount notification bell (mis. `/dashboard`, `/admin`) supaya query `["notifications", ...]` benar-benar masuk cache — ini kondisi yang dulu memicu 401.
3. Logout admin.
4. Buka **DevTools → Network + Console**, aktifkan **"Preserve log"** di kedua tab.
5. Login sebagai user baru dengan password temp → auto-redirect ke `/change-password`.
6. Isi password baru (≥8 char) + konfirmasi cocok → submit.
7. **Lulus kalau SEMUA benar:**
   - **Tidak ada** request ke `auth/v1/logout` (global maupun local).
   - **Tidak ada** request ke `/rest/v1/notifications*` setelah submit. *(Fix baru: query short-circuit saat session null — kalau masih ada request notifications, fix tidak jalan.)*
   - **Tidak ada** response `401` **maupun** `403` di Network sepanjang flow.
   - **Console benar-benar bersih** — nol error merah, khususnya nol `Failed to load resource: ... 401 (Unauthorized)` dan nol `... 403`.
   - Toast **"Kata sandi berhasil diganti"** terlihat sebelum full reload. *(Kalau full reload masih terlalu cepat sehingga Playwright/observer tidak sempat menangkap toast, catat itu eksplisit + berapa ms jeda yang teramati — jangan diam-diam anggap PASS.)*
   - Halaman berpindah ke `/auth` via full reload (navigasi dokumen baru, bukan SPA transition).
   - `localStorage` setelah submit (sebelum login ulang): key `sb-*-auth-token` sudah **hilang**.
8. Lanjut: login dengan **password baru** → masuk `/dashboard`.
9. Reload `/dashboard` → **tidak** loop balik ke `/change-password`.
10. Screenshot: Network tab (filter `notifications` → kosong setelah submit; filter `logout` → kosong) + Console (bersih) + halaman `/auth` setelah redirect + (kalau tertangkap) toast sukses.

### B. Regresi cek cepat — notification bell tetap normal saat login sah

11. Login `admin` (atau role mana pun yang punya notifikasi seed). Buka `/dashboard`.
12. **Lulus kalau:**
    - Bell (ikon lonceng di header) memuat tanpa error; kalau ada notifikasi seed, badge unread + list terisi seperti biasa.
    - Network: request `/rest/v1/notifications?select=*...` dan `?select=id&read_at=is.null` **berhasil `200`** (bukan 401), karena session hidup.
    - Console bersih.
13. Klik "Tandai semua dibaca" (kalau ada unread) → sukses, badge turun ke 0, tidak ada error.
14. Logout normal via menu akun → redirect ke `/auth`, Console tetap bersih (tidak ada 401 notifications sisa).

### C. Regresi cek cepat — login/logout biasa tidak berubah

15. Login lalu logout 2–3 kali dengan role berbeda (`admin`, lalu `sales` atau `qc` kalau kredensial tersedia — kalau tidak, ulang dengan `admin` saja). Konfirmasi: tidak ada console error baru, tidak ada request 401/403 tak terduga, redirect `/auth` ↔ `/dashboard` normal.
16. Console + Network sepanjang semua langkah: tidak ada uncaught error / 5xx / request loop.

## Output yang diminta

**Update** report `tasks/codex-bug2-bug8-retest-report.md` (jangan buat file baru) — tambahkan section retest baru, format:

1. **Verdict BUG-2 strict**: PASS / FAIL setelah `ed5a915`, + apakah BUG-2 sekarang layak ditandai **CLOSED**.
2. **Ringkasan setup**: `git rev-parse HEAD`, konfirmasi `ed5a915` ada, hasil 4 quality gate (`supabase test db` harus tetap 256/256).
3. **BUG-2 detail**: langkah A dieksekusi + hasil aktual vs harapan — khusus: ada/tidak request `auth/v1/logout`, ada/tidak request `/rest/v1/notifications*` setelah submit, ada/tidak response 401/403, Console bersih atau tidak (kutip persis kalau ada error), toast sukses terlihat atau tidak (+ jeda ms), `localStorage` key hilang, reload loop — + screenshot path.
4. **Regresi B + C**: bell tetap normal saat login sah (request notifications `200`), login/logout biasa tidak berubah — ada / tidak ada regresi.
5. **Bug baru** (kalau ada): severity, modul + route, repro, aktual vs harapan, screenshot.
6. **Kesimpulan**: apakah BUG-2 bisa ditandai CLOSED strict sekarang; sisa risiko / follow-up owner (BUG-6 DnD masih open, di luar scope).
7. **Cleanup**: hapus user viewer yang dibuat via `/admin`; jalankan `supabase test db` sekali lagi → konfirmasi **256/256 PASS** di state bersih.

## Rules

- **Hanya local Supabase stack.** Jangan pernah mutasi remote `jtzwawtfymljfqfrplib`.
- **Jangan ubah kode** (`src/`, `vite.config.ts`) atau migration. Boleh menambah/meng-update file seed/fixture/report saja.
- **Jangan perbaiki bug** apa pun yang ditemukan — cukup laporkan.
- Kalau BUG-2 strict **masih FAIL** setelah `ed5a915` → temuan penting: laporkan network trace persis (URL request yang balik 401/403 + kapan terpicu relatif ke submit) dan kembalikan ke owner tanpa memperbaiki.
- Kalau login gagal / stack tidak sehat → hentikan, laporkan blocker.
- Jangan tinggalkan user test di DB — wajib cleanup + verifikasi `supabase test db` balik 256/256 PASS.

---

## Prompt singkat versi sekali tempel

```text
Retest FOKUS BUG-2 strict (notifications 401) DSM MOS di LOCAL Supabase stack saja (jangan sentuh remote jtzwawtfymljfqfrplib). Jangan ubah kode/vite.config/migration; jangan perbaiki bug apa pun; boleh update file report saja. Baseline: tasks/codex-bug2-bug8-retest-report.md (BUG-2 PARTIAL/FAIL strict — 2 console error 401 dari /rest/v1/notifications setelah session direvoke saat forced password-change). Fix di commit ed5a915: (1) src/features/notifications/hooks/use-notifications.ts — useNotifications & useUnreadCount panggil supabase.auth.getSession() dulu; kalau session null, queryFn return []/0 tanpa request. (2) src/routes/change-password.tsx — hapus localStorage key sb-*-auth-token SEBELUM queryClient.cancelQueries()/clear() (urutan dibalik). Persiapan: git log pastikan ed5a915 ada, `supabase db reset`, seed supabase/seed-demo/20260823_demo_200_dataset.sql, `bun run dev`, jalankan `supabase test db` (WAJIB 256/256 PASS) + `bunx tsc --noEmit` + `bun run lint` + `bun run build`. Uji: (A) BUG-2 strict — login admin, buka /dashboard + /admin dulu supaya query notifications masuk cache, /admin buat user role viewer + password temp, logout, buka DevTools Network+Console preserve-log di kedua tab, login user baru -> /change-password, submit password baru: PASTIKAN tidak ada request auth/v1/logout, tidak ada request /rest/v1/notifications* setelah submit, tidak ada response 401 maupun 403, Console BENAR-BENAR BERSIH (nol error merah, khusus nol "Failed to load resource ... 401" dan nol 403), toast "Kata sandi berhasil diganti" terlihat sebelum full reload (kalau tidak tertangkap, catat eksplisit + jeda ms), halaman pindah ke /auth via full reload, localStorage key sb-*-auth-token hilang; login ulang password baru -> /dashboard -> reload tidak loop ke /change-password; screenshot Network(filter notifications kosong + filter logout kosong)+Console bersih+/auth. (B) Regresi bell — login admin, /dashboard: bell memuat tanpa error, request /rest/v1/notifications balik 200 (bukan 401), badge/list terisi kalau ada seed, "Tandai semua dibaca" sukses, logout normal Console tetap bersih. (C) Regresi login/logout — login+logout 2-3x role berbeda, tidak ada console error baru / 401 / 403 tak terduga, redirect normal. Update report tasks/codex-bug2-bug8-retest-report.md (jangan file baru) tambahkan section retest: verdict BUG-2 strict PASS/FAIL setelah ed5a915 + apakah layak CLOSED, ringkasan setup (HEAD + ed5a915 ada + 4 gate, supabase test db 256/256), BUG-2 detail (ada/tidak logout request, ada/tidak notifications request setelah submit, ada/tidak 401/403, Console bersih/kutip error, toast terlihat/jeda ms, localStorage hilang, reload loop), regresi B+C ada/tidak, bug baru per severity, kesimpulan apakah BUG-2 bisa CLOSED strict + follow-up owner (BUG-6 DnD masih open), konfirmasi cleanup user test + supabase test db balik 256/256 PASS. Kalau BUG-2 strict masih FAIL setelah ed5a915, laporkan network trace persis (URL yang balik 401/403 + kapan terpicu relatif ke submit) dan kembalikan ke owner tanpa memperbaiki. Kalau login gagal atau stack tidak sehat, hentikan dan laporkan blocker.
```
