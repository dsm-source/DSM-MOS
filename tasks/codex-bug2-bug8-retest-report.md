# Codex Retest BUG-2 + BUG-8 DSM MOS

Update terbaru: lihat §9 untuk retest BUG-2R4 setelah commit `ed5a915`. Verdict terbaru BUG-2 strict: **PASS / layak CLOSED** untuk scope notifications-401 forced password-change.

Tanggal: 2026-08-30 20:50-21:10 WIB  
Target: local Supabase stack only. Remote `jtzwawtfymljfqfrplib` tidak disentuh.  
HEAD diuji: `2061b3e90cff72440ce0df6f200b91bab3c9db5e` (`1f720c4` ada di history).

## 1. Verdict

| Bug | Verdict | Bisa ditutup? |
|---|---|---|
| BUG-2 forced password-change logout 403 | **PARTIAL / FAIL strict** (fix menyusul, lihat §6) | **Belum penuh**. Target utama `auth/v1/logout` 403 sudah hilang, tetapi strict criterion "tidak ada console error merah" belum bersih karena muncul 2 request notifications HTTP 401 setelah session direvoke. Toast sukses juga tidak terobservasi sebelum full reload. **Update:** residual notifications-401 sudah di-patch di commit `ed5a915` (gate query pada sesi hidup); menunggu retest browser. |
| BUG-8 delivery QC pass eligibility | **PASS** | **Ya, bisa ditandai CLOSED** untuk scope BUG-8. Role `delivery` melihat kandidat QC pass, menambah item, dan transisi draft -> prepared -> shipped -> delivered berhasil tanpa 400/403/5xx/console error. |

Kesimpulan: **BUG-8 layak CLOSED; BUG-2 belum layak CLOSED strict** kecuali owner memutuskan scope penutupan hanya untuk hilangnya `auth/v1/logout` 403.

## 2. Ringkasan Setup

- `git rev-parse HEAD`: `2061b3e90cff72440ce0df6f200b91bab3c9db5e`.
- `git log --oneline -8`: `1f720c4 fix: grant delivery SELECT on engineering_jobs; drop dead-token logout` terkonfirmasi.
- `supabase db reset`: PASS; migration `20260830000001_m8_eng_jobs_select_delivery.sql` teraplikasi.
- Seed demo: `supabase/seed-demo/20260823_demo_200_dataset.sql` via local container `psql`.
- Fixture BUG-8:
  - `so_number`: `BUG28-SO-QC-PASS`
  - `sales_order_id`: `42800000-0000-0000-0000-000000000010`
  - `qc_inspection_id`: `42800000-0000-0000-0000-000000000015`
  - `qty_ok`: `8`
- Policy check: `engineering_jobs` SELECT policy `eng_jobs_select_scoped` sekarang menyertakan `delivery`.

Quality gates awal:

| Gate | Hasil |
|---|---|
| `supabase test db` | PASS, Files=10, Tests=256 |
| `bunx tsc --noEmit` | PASS |
| `bun run lint` | PASS exit 0, 37 warning `react-refresh/only-export-components` |
| `bun run build` | PASS |

Dev server: `bun run dev --host 127.0.0.1 --port 8080`, Vite ready di `http://127.0.0.1:8080/`.

## 3. BUG-2 Detail

Langkah browser:

1. Login admin lokal.
2. `/admin` -> `Buat User Baru`, role `viewer`, password sementara.
3. Logout admin.
4. Login viewer baru -> redirect ke `/change-password`.
5. Submit password baru.
6. Halaman pindah ke `/auth`.
7. Login ulang dengan password baru -> `/dashboard`.
8. Reload `/dashboard` -> tetap `/dashboard`, tidak loop ke `/change-password`.

Hasil aktual:

| Check | Hasil |
|---|---|
| First login temp password | PASS, URL `http://127.0.0.1:8080/change-password` |
| Request `auth/v1/logout` setelah submit | PASS, **0 request** |
| Response 403 setelah submit | PASS, **0 response 403** |
| Console error merah | **FAIL strict**, 2 error merah HTTP 401 dari `/rest/v1/notifications?...` |
| `localStorage` key `sb-*-auth-token` setelah redirect | PASS, jumlah key = 0 |
| Redirect setelah submit | PASS, URL `http://127.0.0.1:8080/auth` |
| Toast sukses sebelum reload | **Tidak terbukti**, Playwright tidak melihat `Kata sandi berhasil diganti` sebelum full reload |
| Login password baru | PASS, URL `http://127.0.0.1:8080/dashboard` |
| Reload dashboard loop balik change-password | PASS, tidak loop |

Console error yang muncul:

- `Failed to load resource: the server responded with a status of 401 (Unauthorized)` untuk `/rest/v1/notifications?select=id&read_at=is.null`
- `Failed to load resource: the server responded with a status of 401 (Unauthorized)` untuk `/rest/v1/notifications?select=*&order=created_at.desc&limit=20`

Screenshot:

- `tasks/codex-bug2-bug8-retest-artifacts/bug2-admin-page.png`
- `tasks/codex-bug2-bug8-retest-artifacts/bug2-created-viewer.png`
- `tasks/codex-bug2-bug8-retest-artifacts/bug2-auth-after-change.png`
- `tasks/codex-bug2-bug8-retest-artifacts/bug2-dashboard-after-reload.png`

## 4. BUG-8 Detail

Langkah browser:

1. Login role `delivery`.
2. `/delivery` -> `Rencana Baru`.
3. Pilih SO fixture `BUG28-SO-QC-PASS`.
4. Isi jadwal, driver, kendaraan, notes.
5. Submit -> draft `DLV-2026-000054`, detail `/delivery/b1cc9ae2-8b0a-44a4-bcdd-de6a133a5a3c`.
6. Buka dropdown `Pilih hasil QC (Lulus)`.
7. Pilih kandidat `BUG28 QC Passed Item · BUG28-BATCH-QC-PASS · OK 8`.
8. Isi `Jumlah=5`, klik `Tambah`.
9. Transisi `draft -> prepared -> shipped -> delivered`.

Hasil aktual:

| Check | Hasil |
|---|---|
| Dropdown kandidat QC pass | PASS, tidak menampilkan empty state |
| Kandidat cocok fixture | PASS, `BUG28 QC Passed Item · BUG28-BATCH-QC-PASS · OK 8` |
| Delivery item masuk DB | PASS, `qc_inspection_id=42800000-0000-0000-0000-000000000015`, `quantity=5` |
| Draft -> prepared | PASS, status `prepared` terlihat di UI |
| Prepared -> shipped -> delivered | PASS, status final DB `delivered` |
| Network 400/403/5xx selama flow | PASS, 0 |
| Console error selama flow | PASS, 0 |

DB verification:

- Delivery `b1cc9ae2-8b0a-44a4-bcdd-de6a133a5a3c` final status `delivered`.
- `prepared_at`, `shipped_at`, dan `delivered_at` terisi.
- `delivery_items` berisi row untuk delivery tersebut dengan `qc_inspection_id=42800000-0000-0000-0000-000000000015`.
- SO fixture tetap `quality_control`; `sales_order_status_history` untuk SO fixture kosong. Karena prompt menyebut auto-completed hanya "kalau memang itu behavior-nya", ini dicatat sebagai behavior aktual, bukan blocker BUG-8.

Screenshot:

- `tasks/codex-bug2-bug8-retest-artifacts/bug8-dropdown-candidate.png`
- `tasks/codex-bug2-bug8-retest-artifacts/bug8-item-added.png`
- `tasks/codex-bug2-bug8-retest-artifacts/bug8-status-prepared.png`
- `tasks/codex-bug2-bug8-retest-artifacts/bug8-status-delivered.png`

## 5. Regresi

| Area | Hasil |
|---|---|
| `delivery` SELECT `engineering_jobs` | PASS, policy SELECT sekarang mencakup `delivery`, terbukti flow eligibility browser berhasil. |
| `delivery` UPDATE `engineering_jobs` | PASS, simulasi RLS sebagai role `delivery` menghasilkan `UPDATE 0`; notes fixture tetap `BUG28 approved fixture`. |
| Sidebar delivery | PASS pada browser run continuation: `deliveryHasEngineeringMenu=false`. Catatan: source `AppSidebar` saat ini mendefinisikan Engineering untuk `ALL_ROLES`, jadi ini perlu reconciled bila owner memakai source/sidebar matrix sebagai source-of-truth. |
| Role `material` buka `/delivery` dan `/engineering` | PASS browser quick check, kedua halaman render heading, 0 console error, 0 5xx. |
| Role `qc` buka `/delivery` dan `/engineering` | PASS browser quick check, kedua halaman render heading, 0 console error, 0 5xx. |

Tidak ada regresi baru yang terbukti dari fix BUG-8 pada flow delivery utama atau quick role check.

## 6. Bug Baru / Residual

### BUG-2R4 - Notifications 401 console noise after forced password change

Severity: **major jika strict console-clean acceptance dipakai; minor/major product decision jika hanya target 403 logout yang dihitung.**

Route: `/change-password`

Repro:

1. Admin membuat user baru role `viewer`.
2. User login dengan temporary password.
3. User submit password baru di `/change-password`.

Actual:

- Tidak ada request `auth/v1/logout`.
- Tidak ada response 403.
- Redirect ke `/auth` berhasil dan auth token localStorage hilang.
- Tetapi console mencatat 2 error merah HTTP 401 dari query notifications.
- Toast sukses tidak terobservasi sebelum full reload.

Expected:

- Tidak ada console error merah sama sekali sepanjang successful password-change flow.
- Toast sukses terlihat sebelum reload, atau acceptance diubah bila full reload terlalu cepat untuk toast.

#### Fix (commit `ed5a915`)

Root cause: query notifikasi menembak PostgREST tanpa cek sesi. Setelah
`changePasswordAndClearFlag` mencabut sesi, cache invalidation dari root
`onAuthStateChange` listener masih bisa me-refetch query itu dengan token mati
-> `401` yang dicatat browser sebagai error merah (bukan error JS, jadi hanya
bisa dicegah di level request). Commit `3af4c3f` sebelumnya menambah
`cancelQueries()` + `clear()` tapi tidak menutup race refetch setelah `clear()`.

Perubahan:

1. `src/features/notifications/hooks/use-notifications.ts` — `useNotifications`
   dan `useUnreadCount` sekarang `supabase.auth.getSession()` dulu; kalau tidak
   ada sesi, langsung `return []` / `0` tanpa request. auth-js 2.110.7
   (`__loadSession`) membaca token langsung dari localStorage, jadi begitu token
   dihapus hasilnya `null`.
2. `src/routes/change-password.tsx` — hapus `sb-*-auth-token` dari localStorage
   **sebelum** `cancelQueries()` / `clear()`, sehingga refetch apa pun setelah
   titik itu ketemu sesi `null` dan short-circuit.

Toast sukses + delay reload 800ms sudah ada dari `3af4c3f`, tidak diubah.

Gate lokal:

| Gate | Hasil |
|---|---|
| `bunx tsc --noEmit` | PASS, 0 error |
| `bun run lint` | PASS, 0 error, 37 warning pre-existing |
| `bun run build` | PASS |

Retest status: **belum diverifikasi end-to-end di browser.** Jalur 401 sudah
tertutup secara statik (token dihapus lebih dulu -> `getSession()` -> `null` ->
query short-circuit). Perlu retest browser ulang flow admin -> viewer ->
`/change-password` untuk konfirmasi 0 console error merah sebelum menutup BUG-2
strict.

## 7. Kesimpulan

[Pasti] BUG-8 sekarang bisa ditandai **CLOSED** untuk scope retest ini.  
[Pasti] BUG-2 target `auth/v1/logout` 403 sudah tertutup: 0 request logout dan 0 response 403.  
[Pasti] BUG-2 belum memenuhi strict acceptance penuh karena masih ada console error merah HTTP 401 dari notifications dan toast sukses tidak terbukti.  
[Kemungkinan Besar] Sisa BUG-2 bukan masalah `signOut` lagi, melainkan outstanding notifications queries yang memakai session yang sudah direvoke sebelum halaman hard-reload ke `/auth`.

[Update pasca-report] Residual notifications-401 (BUG-2R4) di-patch di commit `ed5a915`: query notifikasi sekarang gate pada `getSession()` dan token localStorage dihapus sebelum cache di-clear. Gate lokal (tsc/lint/build) PASS. Belum diverifikasi end-to-end di browser — perlu retest flow forced password-change untuk konfirmasi 0 console error merah.

Follow-up di luar scope retest ini: BUG-6 DnD dari ronde 3 tetap open dan tidak diuji ulang di task ini.

## 8. Cleanup

Cleanup lokal sudah dilakukan:

- Fixture `BUG28-*`: 0 sales order, 0 customer, 0 delivery, 0 production batch.
- Akun test `codex-bug28-*` dan `codex-debug-*`: 0.
- `supabase test db` final setelah cleanup: PASS, Files=10, Tests=256.

## 9. Retest BUG-2R4 Strict Setelah `ed5a915`

Tanggal: 2026-08-30 21:44-22:06 WIB
Target: local Supabase stack only. Remote `jtzwawtfymljfqfrplib` tidak disentuh.
Scope: retest browser fokus BUG-2R4 notifications 401 setelah fix `ed5a915`; bukan full smoke dan bukan review kode.

### 9.1 Verdict BUG-2 Strict

| Bug | Verdict setelah `ed5a915` | Bisa ditutup? |
|---|---|---|
| BUG-2 forced password-change notifications 401 | **PASS strict** | **Ya, layak ditandai CLOSED** untuk scope BUG-2 strict: forced password-change menghasilkan 0 request `auth/v1/logout`, 0 request `/rest/v1/notifications*` setelah submit, 0 response 401/403, dan 0 console error merah. |

### 9.2 Ringkasan Setup

- `git rev-parse HEAD`: `d68eb2376dbcd2d8230ca6aed7e337300b5d2ba3`.
- Branch: `main`.
- `git log --oneline -5`: `d68eb23`, `e8647d0`, `ed5a915`, `3af4c3f`, `a24e959`.
- `git merge-base --is-ancestor ed5a915 HEAD`: exit `0`, jadi fix `ed5a915` ada di working tree.
- `supabase db reset`: PASS; migration terakhir `20260830000001_m8_eng_jobs_select_delivery.sql` teraplikasi.
- Seed demo: `supabase/seed-demo/20260823_demo_200_dataset.sql` via local container `psql`: PASS.
- Dev server: `bun run dev --host 127.0.0.1 --port 8080`, Vite ready di `http://127.0.0.1:8080/`.
- Catatan setup: setelah reset+seed, tidak ada admin siap-login di `auth.users`; seed demo hanya membuat `demo-*` tanpa password. Untuk melanjutkan retest local-only, dibuat fixture admin sementara `test@dsm.com` via Auth Admin API lokal dan role `admin` di DB lokal. Fixture ini dihapus saat cleanup.

Quality gates awal:

| Gate | Hasil |
|---|---|
| `supabase test db` | PASS, Files=10, Tests=256 |
| `bunx tsc --noEmit` | PASS, exit 0 |
| `bun run lint` | PASS exit 0, 37 warning `react-refresh/only-export-components` yang sudah diketahui |
| `bun run build` | PASS |

### 9.3 BUG-2 Detail Browser

Langkah dieksekusi:

1. Login admin fixture lokal.
2. Buka `/dashboard`, lalu `/admin`, supaya notification queries masuk cache.
3. Buat user baru via UI `/admin` dengan role `viewer`: `codex-bug2r4-20260830150136@dsm-mos.local`.
4. Logout admin.
5. Login viewer dengan password sementara -> redirect ke `/change-password`.
6. Submit password baru.
7. Observasi toast, redirect hard reload ke `/auth`, dan localStorage.
8. Login ulang dengan password baru -> `/dashboard`.
9. Reload `/dashboard` -> tetap `/dashboard`, tidak loop ke `/change-password`.

Hasil aktual:

| Check strict | Hasil |
|---|---|
| First login temp password | PASS, URL `http://127.0.0.1:8080/change-password` |
| Request `auth/v1/logout` setelah submit | PASS, **0 request** |
| Request `/rest/v1/notifications*` setelah submit | PASS, **0 request** |
| Response 401/403 setelah submit | PASS, **0 response** |
| Console error merah setelah submit | PASS, **0 error level console** |
| Toast sukses | PASS, `Kata sandi berhasil diganti` tertangkap sekitar **280 ms** setelah submit |
| Redirect hard reload ke `/auth` | PASS, URL `http://127.0.0.1:8080/auth`, redirect sekitar **1028 ms** setelah submit |
| `localStorage` key `sb-*-auth-token` setelah redirect | PASS, jumlah key = 0 |
| Login password baru | PASS, URL `http://127.0.0.1:8080/dashboard` |
| Reload dashboard loop balik change-password | PASS, tetap `http://127.0.0.1:8080/dashboard` |

Console/network note:

- Setelah submit password, tidak ada network trace 401/403 yang perlu dikutip karena hasilnya 0.
- Browser masih mencatat log dev biasa (`[vite] connecting`, `[vite] connected`, React DevTools info) dan satu console `verbose` Chrome tentang password form username field sebelum submit. Ini bukan console error merah dan tidak terkait notifications 401.
- Setelah login ulang dengan password baru, notification requests kembali berjalan dengan session hidup dan response `200`, sesuai ekspektasi.

Evidence:

- JSON Flow A: `tasks/codex-bug2-bug8-retest-artifacts/bug2r4-browser-result.json`
- Screenshot admin sebelum create: `tasks/codex-bug2-bug8-retest-artifacts/bug2r4-admin-before-create.png`
- Screenshot viewer dibuat: `tasks/codex-bug2-bug8-retest-artifacts/bug2r4-created-viewer.png`
- Screenshot `/change-password` sebelum submit: `tasks/codex-bug2-bug8-retest-artifacts/bug2r4-change-password-before-submit.png`
- Screenshot toast sukses: `tasks/codex-bug2-bug8-retest-artifacts/bug2r4-toast-success.png`
- Screenshot `/auth` setelah redirect: `tasks/codex-bug2-bug8-retest-artifacts/bug2r4-auth-after-change.png`
- Screenshot dashboard setelah login ulang: `tasks/codex-bug2-bug8-retest-artifacts/bug2r4-dashboard-after-relogin.png`
- Screenshot dashboard setelah reload: `tasks/codex-bug2-bug8-retest-artifacts/bug2r4-dashboard-after-reload.png`

### 9.4 Regresi B + C

Notification bell saat login sah:

| Check | Hasil |
|---|---|
| Login admin -> `/dashboard` | PASS |
| Bell memuat tanpa console error | PASS |
| Request `/rest/v1/notifications?select=*...` | PASS, `200 OK` |
| Request `/rest/v1/notifications?select=id&read_at=is.null` | PASS, `200 OK` |
| Badge/list | PASS untuk state aktual: bell menampilkan empty state `Belum ada notifikasi`; tombol `Tandai semua dibaca` disabled karena unread = 0 |
| `Tandai semua dibaca` | Tidak dieksekusi karena tombol disabled/unread = 0 |
| Logout normal | PASS, `auth/v1/logout?scope=global` -> `204 No Content`, redirect `/auth`, 0 console error, 0 response 401/403 |

Login/logout biasa:

| Siklus | Hasil |
|---|---|
| `admin-1` login -> logout | PASS, `/auth` -> `/dashboard` -> `/auth`, 0 console error, 0 response 401/403 |
| `viewer` login -> logout | PASS, `/auth` -> `/dashboard` -> `/auth`, 0 console error, 0 response 401/403 |
| `admin-2` login -> logout | PASS, `/auth` -> `/dashboard` -> `/auth`, 0 console error, 0 response 401/403 |

Catatan network normal logout:

- Setiap logout normal mengirim `POST /auth/v1/logout?scope=global` dan menerima `204 No Content`.
- Playwright juga merekam `requestfailed net::ERR_ABORTED` setelah `204` karena halaman langsung redirect/navigate. Ini bukan response 401/403 dan tidak muncul sebagai console error.

Evidence regresi:

- JSON: `tasks/codex-bug2-bug8-retest-artifacts/bug2r4-regression-result.json`
- Screenshot bell admin: `tasks/codex-bug2-bug8-retest-artifacts/bug2r4-bell-admin-open.png`
- Screenshot `/auth` setelah logout admin: `tasks/codex-bug2-bug8-retest-artifacts/bug2r4-auth-after-admin-logout.png`
- Screenshot siklus admin/viewer: `tasks/codex-bug2-bug8-retest-artifacts/bug2r4-cycle-admin-1-logged-in.png`, `tasks/codex-bug2-bug8-retest-artifacts/bug2r4-cycle-viewer-logged-in.png`, `tasks/codex-bug2-bug8-retest-artifacts/bug2r4-cycle-admin-2-logged-in.png`

### 9.5 Bug Baru

Tidak ada bug baru yang terbukti dari retest fokus ini.

Out-of-scope / follow-up owner:

- BUG-6 DnD Production masih open dari ronde 3 dan tidak diuji ulang di task ini.
- Bila owner ingin bell regression membuktikan `Tandai semua dibaca` pada unread > 0, perlu fixture notifikasi unread eksplisit. Pada run ini state seed/admin aktual menghasilkan empty state, tetapi endpoint notifications tetap terbukti `200 OK`.

### 9.6 Kesimpulan

[Pasti] BUG-2 strict sekarang bisa ditandai **CLOSED** untuk scope forced password-change notifications-401 setelah `ed5a915`: browser retest membuktikan 0 request logout, 0 request notifications setelah submit, 0 response 401/403, 0 console error merah, toast sukses terlihat, token localStorage hilang, redirect ke `/auth`, dan login ulang tidak loop ke `/change-password`.

[Pasti] Regresi notification bell saat session hidup tidak terlihat: endpoint notifications mengembalikan `200 OK` dan console bersih.

[Pasti] Regresi login/logout biasa tidak terlihat pada siklus admin/viewer/admin: redirect normal, 0 console error, 0 response 401/403.

### 9.7 Cleanup

Cleanup lokal sudah dilakukan:

- User viewer `codex-bug2r4-20260830150136@dsm-mos.local`: 0 di `auth.users`.
- Admin fixture sementara `test@dsm.com`: 0 di `auth.users`.
- Query cleanup users: `remaining_test_users = 0`.
- `supabase test db` final setelah cleanup: PASS, Files=10, Tests=256.
