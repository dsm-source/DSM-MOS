# Prompt Codex — Volume Test 200 Data Dummy DSM MOS

Gunakan prompt ini untuk mendelegasikan task ke Codex. Task ini di luar peran default Codex di `AGENT.md` (biasanya hanya review/audit hasil Claude) — task ini adalah **volume/functional test** end-to-end atas permintaan langsung owner, dijalankan **hanya di local Supabase stack**, bukan review kode.

---

## Context (wajib dibaca, jangan asumsikan histori percakapan)

- Project: DSM MOS (Manufacturing Order System). Stack: Supabase (Postgres + RLS) + TanStack Start/React.
- Alur bisnis inti: **Sales Order → Engineering Job → Production Batch (per-step, gated) → QC (per-step, gated) → Delivery → Dashboard/Audit Log**.
- Status implementasi saat ini: M5–M8 selesai (lihat `tasks/todo.md`). Total pgTAP suite: 256/256 PASS per commit terakhir.
- Follow-up terbaru (`tasks/todo.md`, bagian "Follow-up B — Pagination/filter", selesai 2026-08-23) sengaja menambahkan **filter default + limit** karena volume data bertambah:
  - `/delivery`: default filter status "aktif" + `.limit(200)`.
  - `/delivery/schedule` (Gantt): rentang tanggal default 90 hari lalu s/d 180 hari depan.
  - `/qc`: `useQcActiveQueue()` (tanpa limit, antrian selalu kecil) + `useQcHistory()` (90 hari terakhir + `.limit(300)`).
  - `production_batches`: sengaja **tidak** dibatasi (dianggap volume rendah).
  - Perubahan ini **belum pernah diuji dengan volume data riil ~200 baris** — hanya diverifikasi dengan data kecil hasil manual test. Ini alasan utama task ini diminta.
- Environment: local Supabase stack (`supabase start`), app jalan di `http://localhost:8080/` (`bun run dev` / sesuai `package.json`).
- Project ID Supabase remote (**JANGAN disentuh**): `jtzwawtfymljfqfrplib`. Task ini murni di local stack.

## Goal

Buktikan bahwa seluruh pipeline DSM MOS **tetap berfungsi benar dan tidak melambat/rusak** ketika database berisi ±200 baris data dummy yang mengalir lewat seluruh alur (SO → Engineering → Production → QC → Delivery → Dashboard/Audit Log), lalu laporkan hasilnya.

## Scope kerja

### 1. Siapkan data dummy (±200 record)
- Buat **satu seed script SQL baru** (bukan mengubah migration yang sudah ada) di `supabase/seed-test/` atau lokasi serupa yang jelas terpisah dari migration produksi — beri nama yang jelas mis. `20260823_dummy_200_volume_test.sql`.
- Target: kira-kira 200 **sales order** dummy, masing-masing dengan minimal 1 item, mengalir realistis lewat status berbeda (draft, in_production, delivered, dst) sehingga turunannya (engineering_jobs, production_batches, production_batch_steps, qc_inspections, deliveries) ikut terisi secara proporsional — total baris di seluruh tabel boleh jauh lebih dari 200, yang penting **~200 sales order** sebagai unit dasar. Kalau ini beda dari maksud owner, catat asumsi ini eksplisit di report, jangan diam-diam menebak lalu lanjut.
- Semua data dummy **harus gampang dikenali & dihapus lagi**: pakai penanda konsisten, mis. prefix `customer_name` atau kolom identitas dengan `DUMMY-TEST-` / `SEED200-`, supaya cleanup di akhir bisa 1 query `DELETE ... WHERE ... LIKE 'DUMMY-TEST-%'` (cascade lewat FK, atau hapus manual sesuai urutan dependensi kalau tidak ada `ON DELETE CASCADE`).
- Insert lewat SQL langsung ke local DB (`supabase db` / `psql` ke local stack) — bukan lewat UI manual satu-satu.
- Jalankan `supabase db reset` dulu di local (memastikan start dari state migration bersih) sebelum load seed dummy ini, supaya tidak tercampur data manual test sebelumnya.

### 2. Jalankan verifikasi fungsional dengan data 200 tsb
Untuk tiap area berikut, jalankan test dan catat hasil (query SQL langsung dan/atau lewat UI browser kalau memungkinkan):

- **Sales Order**: list SO tampil benar, tidak error, cek performa query (waktu eksekusi kasar via `EXPLAIN ANALYZE` cukup).
- **Delivery** (`/delivery`): filter default "aktif" menampilkan subset yang benar (bukan seluruh 200), limit 200 tidak memotong data yang seharusnya tampil secara salah, toggle "Semua status" berfungsi.
- **Delivery Gantt** (`/delivery/schedule`): default rentang 90 hari lalu–180 hari depan menampilkan data yang sesuai rentang; ubah rentang tanggal manual dan verifikasi hasil re-fetch benar.
- **QC** (`/qc`): tab Antrian (`useQcActiveQueue`) hanya isi status aktif; tab Riwayat (`useQcHistory`) default 90 hari + limit 300, ubah rentang tanggal dan verifikasi.
- **Production** (`/production` Kanban): dengan volume batch yang ikut bertambah dari 200 SO, pastikan board tetap render benar tanpa filter (sesuai keputusan "tidak dibatasi" di atas) — dan **secara eksplisit nilai** apakah keputusan itu masih masuk akal di volume ini atau perlu jadi temuan follow-up.
- **Dashboard** (`/dashboard`): 3 view (`v_dashboard_so_status`, `v_dashboard_material_waiting`, `v_dashboard_production_running`) menghitung angka yang benar terhadap 200 data dummy (validasi silang dengan query manual, bukan cuma percaya UI).
- **Audit log** (`/admin`, 100 log terbaru): pastikan tetap tampil benar dan tidak error dengan volume trigger yang meningkat drastis dari insert 200 SO.
- **pgTAP full suite**: jalankan `supabase test db` dengan data dummy ini ada di DB — pastikan tidak ada test yang gagal karena bentrok dengan data seed (kalau ada test yang berasumsi DB "bersih", ini temuan valid untuk dilaporkan, bukan untuk langsung diperbaiki).
- **Console/network browser** (kalau sempat cek via browser): tidak ada error 500/timeout saat load halaman-halaman di atas dengan volume ini.

### 3. Cleanup
- Setelah semua verifikasi selesai dan sudah dicatat, **hapus semua data dummy** (pakai penanda yang sudah disiapkan di langkah 1), lalu `supabase test db` sekali lagi untuk konfirmasi kembali ke 256/256 PASS di state bersih.
- Simpan seed script-nya di repo (jangan dihapus) supaya bisa dipakai ulang test volume berikutnya — tapi **jangan** biarkan data dummy itu sendiri tertinggal di local DB setelah task selesai.

## Output yang diminta (report)

Simpan report ke `tasks/codex-200-dummy-data-report.md`, format:

1. **Verdict**: PASS / PASS_WITH_MINOR / FAIL
2. **Asumsi yang diambil** (mis. distribusi status 200 SO, definisi "200 data")
3. **Ringkasan eksekusi**: seed script yang dipakai, waktu total generate data, jumlah baris final per tabel utama
4. **Hasil per area** (Sales Order, Delivery, Delivery Gantt, QC Antrian, QC Riwayat, Production Kanban, Dashboard, Audit Log, pgTAP suite) — masing-masing: PASS/FAIL + bukti singkat (angka, query, atau observasi)
5. **Bug/temuan** (kalau ada), per temuan: severity (blocking/major/minor/saran), area, langkah reproduksi, hasil aktual vs harapan
6. **Temuan performa** (kalau ada query/halaman yang terasa lambat di volume ini — sertakan angka `EXPLAIN ANALYZE` atau waktu load kasar)
7. **Konfirmasi cleanup**: data dummy sudah dihapus, `supabase test db` balik 256/256 PASS
8. **Summary/Conclusion**: apakah sistem siap menangani volume data seperti ini di produksi, atau ada follow-up yang perlu diputuskan owner (mis. `production_batches` perlu dibatasi juga)

## Rules

- Jalankan **hanya di local Supabase stack** — jangan pernah insert/mutasi apa pun ke project remote `jtzwawtfymljfqfrplib`.
- Jangan ubah kode aplikasi (`src/`) atau migration yang sudah ada. Hanya boleh menambah 1 file seed script baru untuk keperluan test ini.
- Jangan tinggalkan data dummy di DB setelah task selesai — wajib cleanup dan diverifikasi.
- Kalau ada test pgTAP yang gagal gara-gara data dummy ini, laporkan sebagai temuan — jangan mengubah test yang sudah ada untuk "meloloskan" tanpa sepengetahuan Hermes/owner.
- Kalau seed script gagal di tengah jalan (mis. constraint/trigger menolak), hentikan, laporkan detail error persis di baris/step mana, jangan dipaksa lanjut dengan workaround yang menyimpang dari alur bisnis asli (mis. bypass trigger).

---

## Prompt singkat versi sekali tempel

```text
Jalankan volume/functional test DSM MOS dengan ±200 data dummy sales order di LOCAL Supabase stack saja (jangan sentuh remote jtzwawtfymljfqfrplib). Buat 1 seed script SQL baru (bukan ubah migration lama) yang insert ±200 sales order dummy bertanda jelas (mis. prefix "DUMMY-TEST-") mengalir lewat SO -> Engineering -> Production (per-step gated) -> QC (per-step gated) -> Delivery, sehingga tabel turunannya ikut terisi proporsional. Sebelum seed, jalankan `supabase db reset` dulu. Setelah data masuk, verifikasi: list & filter /delivery (default status aktif + limit 200), /delivery/schedule Gantt (default rentang 90 hari lalu-180 hari depan), /qc tab Antrian & Riwayat (Riwayat default 90 hari + limit 300), /production Kanban (unbounded, nilai apakah masih wajar di volume ini), 3 view dashboard (validasi angka lewat query manual), audit log admin, dan full `supabase test db` (harus tetap semua PASS, laporkan kalau ada yang bentrok karena data seed). Catat temuan bug/performa dengan severity. Setelah selesai, hapus semua data dummy pakai penanda yang sama, jalankan ulang `supabase test db` untuk konfirmasi balik ke state PASS bersih. Simpan seed script di repo tapi jangan tinggalkan data dummy di DB. Jangan ubah kode aplikasi atau migration lama, jangan pernah mutasi project remote. Outputkan report ke tasks/codex-200-dummy-data-report.md dengan: verdict PASS/PASS_WITH_MINOR/FAIL, asumsi yang diambil, hasil per area, daftar bug per severity, temuan performa, konfirmasi cleanup, dan summary/conclusion kesiapan sistem menangani volume ini.
```
