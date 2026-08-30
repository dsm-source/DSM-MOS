# Prompt Codex — Full Smoke Test DSM MOS (semua modul, flow, & saran)

Gunakan prompt ini untuk mendelegasikan **full smoke test end-to-end** ke Codex.
Task ini di luar peran review default Codex (`AGENT.md`) — ini **functional smoke test atas permintaan langsung owner**, dijalankan **hanya di local Supabase stack**, bukan review kode.

---

## Context (wajib dibaca — jangan asumsikan histori percakapan)

- Project: **DSM MOS** (Manufacturing Order System). Stack: Supabase (Postgres + RLS + triggers + RPC) + TanStack Start/React + Tailwind + shadcn/ui.
- Alur bisnis inti (semua **per-step & gated**):
  **Sales Order → Engineering Job → Material Status → Production Planning (batch + routing) → Production Execution (Kanban per-step) → QC (per-step) → Delivery → Dashboard / Audit Log**
- Status implementasi: M0–M8 selesai (`tasks/todo.md`). pgTAP suite terakhir: **256/256 PASS**.
- App dev: `bun run dev` → `http://localhost:8080/`. Local stack: `supabase start`.
- Remote project ID (**JANGAN DISENTUH sama sekali**): `jtzwawtfymljfqfrplib`. Semua kerja murni di **local stack**.
- Login: kredensial per-role diberikan owner saat run. Kalau belum ada, minta ke owner sebelum mulai (jangan bikin user sendiri kecuali via UI `/admin` untuk keperluan test dan dicatat).
- RBAC roles: `admin`, `sales`, `qc`, `production`, `production_planning`, `material`, `delivery`, `viewer`.

### Peta route / modul yang harus dicakup

| Modul | Route | Role akses |
|---|---|---|
| Auth / login | `/auth`, `/change-password` | semua |
| Dashboard | `/dashboard` | semua role |
| Sales Order — list/filter/search | `/sales-orders` | admin, sales, viewer |
| Sales Order — detail + assignment PIC + riwayat | `/sales-orders/$id` | admin, sales, viewer |
| Sales Order — create/edit + item dinamis | `/sales-orders/new`, `/sales-orders/$id/edit` | admin, sales |
| Pelanggan (customer CRUD) | `/customers` | admin, sales |
| Engineering Job board + detail + riwayat | `/engineering`, `/engineering/$id` | semua role |
| Engineering Workload | `/engineering/workload` | semua role |
| Bahan / Material board + detail + riwayat | `/material` | admin, material, viewer |
| Perencanaan Produksi (buat batch + routing) | `/production-planning` | admin, production_planning |
| Operator CRUD | `/operators` | admin, production_planning |
| Produksi — Kanban per-step + drag & drop + operator dialog | `/production` | admin, production, viewer |
| QC — tab Antrian + tab Riwayat + dialog inspeksi per-step + rework RPC | `/qc` | admin, qc, viewer |
| Pengiriman — list + filter default "aktif" + limit 200 | `/delivery`, `/delivery/$id` | admin, delivery, viewer |
| Jadwal Pengiriman (Gantt, tombol bukan drag) | `/delivery/schedule` | admin, delivery, viewer |
| Kelola User + assign role + audit log (100 terbaru) | `/admin` | admin |
| Bell notifikasi realtime + mark-as-read | global header | semua |

## Goal

Jalankan smoke test menyeluruh: **setiap modul di atas dibuka, setiap flow inti dijalankan minimal 1x happy-path + 1x guard/negative-path**, lalu laporkan verdict + daftar bug + **saran perbaikan** (UX, konsistensi, performa, aksesibilitas).

## Persiapan

1. `supabase db reset` (state migration bersih).
2. Seed data secukupnya untuk bisa menjalankan flow (boleh pakai seed yang ada, atau `tasks/`-nya volume-test script kalau relevan — tapi smoke test ini **tidak butuh 200 baris**, cukup data kecil yang cukup untuk menempuh semua status). Catat cara seed yang dipakai.
3. `bun run dev` + pastikan `supabase status` semua healthy.
4. Verifikasi statis dulu (catat hasil, jangan lanjut kalau ada yang gagal):
   - `supabase test db`
   - `bunx tsc --noEmit`
   - `bun run lint`
   - `bun run build`

## Yang harus diuji (per modul)

### 1. Auth & RBAC
- Login tiap role yang kredensialnya tersedia. Pastikan redirect ke `/dashboard`.
- Untuk tiap role: verifikasi **sidebar hanya menampilkan menu sesuai tabel di atas**.
- Akses langsung URL yang tidak diizinkan (mis. `sales` buka `/admin`, `qc` buka `/production-planning`) → harus diblokir route guard, bukan blank/crash.
- `/change-password` berfungsi (kalau ada flow first-login force change, uji itu).
- Logout → kembali ke `/auth`, route terproteksi tidak bisa diakses.

### 2. Sales Order
- List: pagination, filter status, search — semua bekerja, tidak error di data kosong.
- Create SO baru (role sales/admin) + tambah/hapus item dinamis → simpan → muncul di list.
- Edit SO → perubahan tersimpan.
- Detail SO: assignment PIC per role, tab riwayat status terisi.
- **Trigger check**: ubah SO ke `confirmed` → verifikasi otomatis terbentuk `engineering_job` + `material` record + notifikasi masuk (cek bell + query `notifications`).
- Negative: role `viewer` tidak bisa create/edit (tombol hilang / form ditolak).

### 3. Pelanggan
- CRUD customer penuh (create, edit, hapus bila diizinkan). Customer baru muncul di dropdown form SO.

### 4. Engineering
- Board menampilkan job per status.
- Flow: assign PIC → `in_progress` (gate: tidak bisa skip) → progress bisa naik, **lock di 100** → `approved`/selesai.
- Tab riwayat job terisi tiap transisi.
- `/engineering/workload` bisa dibuka **semua role**, angka workload masuk akal.

### 5. Material
- Board status material. Flow `waiting → ready`. Tab riwayat tercatat. 1:1 dengan job (tidak ada duplikat).

### 6. Production Planning & Operator
- CRUD operator.
- Buat production batch + pilih routing (checkbox step) → verifikasi `production_batch_steps` yang terbentuk **sesuai routing** (bukan semua step default).
- Gantt planning: navigasi via tombol (bukan drag), rentang tanggal benar.

### 7. Production Execution (Kanban)
- Kanban per-step, drag & drop kartu antar kolom status.
- Saat pindah kartu → `StepOperatorDialog` muncul, wajib pilih `operator_id`.
- Gate §7: coba transisi ilegal (skip step / mundur tanpa rework) → ditolak dengan pesan spesifik.
- Path `rework`: step di-reject → masuk status `rework` → bisa dikerjakan ulang.
- Realtime: buka 2 tab, pindahkan kartu di satu tab → tab lain ikut update.

### 8. QC (per-step)
- Tab **Antrian**: hanya item status aktif (`waiting`/`inspection`).
- Tab **Riwayat**: default 90 hari + limit 300; ubah rentang tanggal → refetch benar.
- Dialog inspeksi: isi `qty_total`, `qty_ok`, `qty_reject`, `defect_notes`.
  - Validasi: `qty_ok + qty_reject` tidak boleh > `qty_total` (cek pesan error).
- Flow: `waiting → Mulai Inspeksi → inspection → Lulus / Tolak`.
- **Rework harus lewat RPC `trigger_rework`**, bukan direct status update. Tombol Trigger Rework **hanya muncul di status `reject`**.
- (Kalau modul offline queue M6 masih aktif) uji singkat: offline → simpan draft → banner amber `"{n} data tersimpan lokal, menunggu sinkronisasi"` + tombol `Coba sinkronkan` → online → auto-sync → refresh → state final benar.

### 9. Delivery
- `/delivery`: filter default = status **aktif** (bukan semua 200); toggle "Semua status" berfungsi; limit 200 tidak memotong data yang seharusnya tampil.
- Detail delivery `/delivery/$id`: data benar, transisi status pengiriman jalan.
- `/delivery/schedule` Gantt: default rentang 90 hari lalu–180 hari depan; ubah rentang manual → refetch benar; navigasi tombol.
- Flow SO yang lolos QC → muncul sebagai kandidat delivery → set `delivered`.

### 10. Dashboard
- 3 view (`v_dashboard_so_status`, `v_dashboard_material_waiting`, `v_dashboard_production_running`) — **validasi silang angka dengan query manual**, jangan cuma percaya UI.
- Loading state & empty state tidak crash.

### 11. Admin & Audit Log
- `/admin`: list user, assign/unassign role via checkbox → efek langsung terlihat saat user tsb re-login.
- Audit log 100 entri terbaru tampil, urut waktu, tidak error setelah banyak trigger berjalan dari test di atas.

### 12. Notifikasi
- Trigger aksi yang menghasilkan notifikasi (mis. SO confirmed, assignment) → bell badge bertambah realtime → klik → mark-as-read → badge berkurang, persist setelah refresh.

### 13. Cross-cutting (sambil menjalankan semua di atas)
- **Console browser**: tidak ada error merah / uncaught.
- **Network**: tidak ada 4xx/5xx tak terduga, tidak ada request infinite-loop.
- **Empty states**: tiap list/board saat kosong menampilkan empty-state, bukan spinner selamanya atau crash.
- **Loading & error states**: matikan sejenak salah satu request (atau stop supabase) → UI tampil error notice yang jelas, bukan blank.
- **Responsif**: cek 1–2 halaman utama di viewport mobile (375px) — sidebar collapse, tabel scroll.
- **Dark mode**: toggle theme → tidak ada teks kontras rendah / warna rusak.
- **Konsistensi status pill**: warna + ikon per status konsisten di semua modul (unified status system).
- **Aksesibilitas dasar**: fokus keyboard pada dialog (trap + Esc close), tombol punya label.

## Output yang diminta

Simpan report ke `tasks/codex-full-smoke-test-report.md`, format:

1. **Verdict**: PASS / PASS_WITH_MINOR / FAIL
2. **Ringkasan setup**: cara seed, hasil `supabase test db` / `tsc` / `lint` / `build`
3. **Matriks hasil per modul** (13 area di atas): PASS / FAIL / SKIP + bukti singkat (1–3 kalimat, angka/query/observasi)
4. **RBAC matrix**: per role × per menu → terlihat / tidak terlihat / bocor (harusnya ditolak tapi bisa diakses)
5. **Bug list**, per bug:
   - severity: blocking / major / minor
   - modul + route
   - langkah reproduksi
   - hasil aktual vs hasil harapan
   - screenshot path (kalau ada)
6. **Saran perbaikan** (terpisah dari bug — ini rekomendasi, bukan defect), kategorikan:
   - UX / flow
   - Konsistensi visual
   - Performa
   - Aksesibilitas
   - Tech-debt / kode (kalau kelihatan dari luar)
   Tiap saran: dampak (tinggi/sedang/rendah) + effort kasar.
7. **Kesimpulan**: apakah aplikasi layak dianggap stabil untuk demo/produksi, dan follow-up apa yang perlu keputusan owner.

## Rules

- **Hanya local Supabase stack.** Jangan pernah mutasi remote `jtzwawtfymljfqfrplib`.
- **Jangan ubah kode** (`src/`) atau migration lama. Boleh menambah file seed/report baru saja.
- Jangan "perbaiki" bug yang ditemukan — cukup laporkan. Ini smoke test, bukan sesi fixing.
- Kalau login gagal / stack tidak sehat → hentikan, laporkan sebagai blocker, jangan lanjut menebak.
- Kalau satu modul crash total → catat, lanjut ke modul lain (jangan berhenti di modul pertama yang gagal kecuali itu memblok semua flow, mis. auth).
- Kalau pgTAP ada yang gagal karena data seed → laporkan sebagai temuan, jangan ubah test.

---

## Prompt singkat versi sekali tempel

```text
Jalankan FULL SMOKE TEST DSM MOS di LOCAL Supabase stack saja (jangan sentuh remote jtzwawtfymljfqfrplib). Jangan ubah kode/migration; boleh tambah file seed & report saja. Persiapan: `supabase db reset`, seed data kecil secukupnya untuk menempuh semua status, `bun run dev` (http://localhost:8080/), lalu jalankan `supabase test db` + `bunx tsc --noEmit` + `bun run lint` + `bun run build` (catat hasil). Login tiap role yang kredensialnya diberikan owner. Uji SEMUA modul & route: /auth + RBAC guard (sidebar per role + akses URL terlarang ditolak), /dashboard (validasi 3 view dashboard silang query manual), /sales-orders (list/filter/search, create+edit+item dinamis, detail+assignment+riwayat, trigger SO confirmed -> job+material+notifikasi otomatis), /customers CRUD, /engineering board+detail+riwayat+gate in_progress+lock progress 100, /engineering/workload (semua role), /material board+flow waiting->ready+riwayat, /production-planning (batch+routing -> steps sesuai routing) + /operators CRUD, /production Kanban per-step (drag&drop, StepOperatorDialog wajib pilih operator, gate transisi ilegal ditolak, path rework, realtime 2 tab), /qc tab Antrian+Riwayat (Riwayat 90 hari+limit 300, ubah rentang), dialog inspeksi per-step (validasi qty_ok+qty_reject <= qty_total), flow waiting->inspection->lulus/tolak, rework wajib lewat RPC trigger_rework & tombol hanya di status reject, (kalau ada) offline queue banner amber + Coba sinkronkan, /delivery (filter default aktif + toggle semua status + limit 200) + /delivery/$id + /delivery/schedule Gantt (rentang 90 hari lalu-180 hari depan, navigasi tombol), /admin (assign role + audit log 100 terbaru), bell notifikasi realtime + mark-as-read. Cross-cutting: console tanpa error, network tanpa 5xx/loop, empty states, loading/error states, responsif 375px, dark mode, konsistensi status pill, aksesibilitas dialog (focus trap + Esc). Outputkan report ke tasks/codex-full-smoke-test-report.md: verdict PASS/PASS_WITH_MINOR/FAIL, ringkasan setup, matriks hasil per modul, RBAC matrix role x menu, bug list per severity (repro + aktual vs harapan), SARAN PERBAIKAN terpisah (UX/konsistensi/performa/aksesibilitas/tech-debt, dampak+effort), dan kesimpulan kesiapan demo/produksi + follow-up untuk owner. Jangan perbaiki bug, cukup laporkan. Kalau login gagal atau stack tidak sehat, hentikan dan laporkan blocker.
```
