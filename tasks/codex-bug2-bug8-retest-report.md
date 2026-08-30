# Codex Retest BUG-2 + BUG-8 DSM MOS

Tanggal: 2026-08-30 20:50-21:10 WIB  
Target: local Supabase stack only. Remote `jtzwawtfymljfqfrplib` tidak disentuh.  
HEAD diuji: `2061b3e90cff72440ce0df6f200b91bab3c9db5e` (`1f720c4` ada di history).

## 1. Verdict

| Bug | Verdict | Bisa ditutup? |
|---|---|---|
| BUG-2 forced password-change logout 403 | **PARTIAL / FAIL strict** | **Belum penuh**. Target utama `auth/v1/logout` 403 sudah hilang, tetapi strict criterion "tidak ada console error merah" belum bersih karena muncul 2 request notifications HTTP 401 setelah session direvoke. Toast sukses juga tidak terobservasi sebelum full reload. |
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

## 7. Kesimpulan

[Pasti] BUG-8 sekarang bisa ditandai **CLOSED** untuk scope retest ini.  
[Pasti] BUG-2 target `auth/v1/logout` 403 sudah tertutup: 0 request logout dan 0 response 403.  
[Pasti] BUG-2 belum memenuhi strict acceptance penuh karena masih ada console error merah HTTP 401 dari notifications dan toast sukses tidak terbukti.  
[Kemungkinan Besar] Sisa BUG-2 bukan masalah `signOut` lagi, melainkan outstanding notifications queries yang memakai session yang sudah direvoke sebelum halaman hard-reload ke `/auth`.

Follow-up di luar scope retest ini: BUG-6 DnD dari ronde 3 tetap open dan tidak diuji ulang di task ini.

## 8. Cleanup

Cleanup lokal sudah dilakukan:

- Fixture `BUG28-*`: 0 sales order, 0 customer, 0 delivery, 0 production batch.
- Akun test `codex-bug28-*` dan `codex-debug-*`: 0.
- `supabase test db` final setelah cleanup: PASS, Files=10, Tests=256.

