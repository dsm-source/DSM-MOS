# Codex 200 Dummy Data Volume Test Report

## 1. Verdict

**PASS_WITH_MINOR**

Pipeline lokal DSM MOS tetap berfungsi dengan 200 sales order dummy dan route utama bisa di-load tanpa console/page/HTTP 500 error. Minor issue: full `supabase test db` gagal ketika data dummy masih ada karena `production.test.sql` belum terisolasi dari data delivery/QC yang sudah direferensikan `delivery_items`.

## 2. Asumsi yang Diambil

- "200 data" didefinisikan sebagai **200 `sales_orders`**; child rows boleh lebih banyak.
- Distribusi seed:
  - 40 SO draft-only.
  - 20 SO confirmed/engineering only.
  - 50 SO production-active.
  - 40 SO QC-active.
  - 30 SO delivery-active.
  - 20 SO delivered/completed.
- Seed memakai marker konsisten `DUMMY-TEST-` / `SEED200-`.
- Semua aksi dijalankan hanya pada local Supabase stack (`127.0.0.1:5433` / `http://127.0.0.1:54321`), tidak ada mutasi remote `jtzwawtfymljfqfrplib`.

## 3. Ringkasan Eksekusi

- Seed script: `supabase/seed-test/20260823_dummy_200_volume_test.sql`.
- Reset awal: `supabase db reset --local`.
- Load seed final: `docker exec -i supabase_db_jtzwawtfymljfqfrplib psql -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/seed-test/20260823_dummy_200_volume_test.sql`.
- Waktu load seed final: sekitar **1.35s**.

Row count setelah seed:

| Tabel | Count |
|---|---:|
| customers | 10 |
| sales_orders | 200 |
| sales_order_items | 200 |
| engineering_jobs | 160 |
| material_statuses | 160 |
| production_batches | 140 |
| production_batch_steps | 700 |
| qc_inspections | 500 |
| deliveries | 50 |
| delivery_items | 50 |
| audit_logs terkait SO dummy | 380 |

## 4. Hasil per Area

| Area | Status | Bukti singkat |
|---|---|---|
| Sales Order | PASS | 200 SO dummy tampil secara data; status: 40 draft, 140 confirmed, 20 completed. Query list `EXPLAIN ANALYZE` execution **0.984 ms**. |
| Delivery `/delivery` | PASS | 50 delivery total; default aktif (`prepared`, `shipped`) = 30; delivered = 20. Query default aktif execution **0.050 ms**. |
| Delivery Gantt `/delivery/schedule` | PASS | Default range 90 hari lalu-180 hari depan menangkap 50 delivery dummy. Query range execution **0.047 ms**. Browser route load **840 ms**, no console/page/500 error. |
| QC Antrian `/qc` | PASS | Active QC = 90 (`waiting` 50, `inspection` 30, `reject` 10). Query active execution **0.358 ms**. Browser route load **890 ms**, no console/page/500 error. |
| QC Riwayat | PASS | QC pass = 410; default history limit 300 bekerja. Query history execution **0.125 ms**. |
| Production Kanban `/production` | PASS | 140 batches, 700 steps; browser route load **1022 ms**, no console/page/500 error. Query unbounded batches execution **0.112 ms**. Keputusan unbounded masih wajar di volume ini. |
| Dashboard `/dashboard` | PASS | Views cocok dengan query manual: SO active 180, total SO 200; material waiting 20; production running 0. Browser route load **753 ms**, no console/page/500 error. |
| Audit Log `/admin` | PASS | Latest 100 audit log tersedia; total audit event seed besar terisi. Browser route load **862 ms**, no console/page/500 error. |
| pgTAP with dummy data | FAIL_MINOR | `supabase test db` gagal di `production.test.sql` karena delete fixture berbenturan FK `delivery_items_qc_inspection_id_fkey`. 9 file lain ok. |
| pgTAP after cleanup | PASS | Setelah cleanup marker dummy: `supabase test db` kembali **256/256 PASS**. |

## 5. Bug/Temuan

### Minor — pgTAP production fixture tidak terisolasi dari data delivery/QC existing

- Area: `supabase/tests/production.test.sql`.
- Reproduksi: load seed 200 dummy, lalu jalankan `supabase test db`.
- Aktual: gagal pada `production.test.sql:94` dengan error FK: `update or delete on table "qc_inspections" violates foreign key constraint "delivery_items_qc_inspection_id_fkey"`.
- Harapan: test suite bisa berjalan di DB yang punya data existing, atau setup/teardown test menghapus fixture dengan urutan dependensi lengkap.
- Dampak: bukan bug runtime pipeline, tapi membuat full pgTAP tidak tahan terhadap database local yang berisi data realistis delivered.

## 6. Temuan Performa

- Tidak ada query/route yang lambat pada volume ini.
- `production_batches` unbounded masih wajar pada 140 batch: SQL execution **0.112 ms**, browser route sekitar **1.02s**.
- Follow-up hanya perlu dipertimbangkan jika volume batch naik jauh di atas skala test ini atau real browser mulai berat karena jumlah card/step yang dirender.

## 7. Konfirmasi Cleanup

Cleanup sudah dilakukan setelah verifikasi.

Marker tersisa setelah cleanup:

| Marker | Count |
|---|---:|
| customers `DUMMY-TEST` / `SEED200` | 0 |
| sales_orders `DUMMY-TEST-SEED200` | 0 |
| sales_order_items `DUMMY-TEST` | 0 |
| production_batches `DUMMY-TEST-SEED200` | 0 |
| deliveries `DUMMY-TEST-SEED200` | 0 |
| operators `DUMMY-TEST` / `SEED200` | 0 |
| auth users `dummy-200-%@test.local` | 0 |

Clean-state verification: `supabase test db` = **256/256 PASS**.

## 8. Summary/Conclusion

Sistem siap menangani volume sekitar 200 sales order pada local evidence ini. Filter default Delivery/QC bekerja sesuai tujuan, Dashboard tetap konsisten, audit log tetap tampil, dan Production unbounded masih masuk akal pada 140 batch. Satu follow-up yang perlu diputuskan: harden `production.test.sql` agar fixture cleanup tidak gagal saat DB lokal berisi data delivered realistis.

## 9. Follow-up — Fix pgTAP fixture isolation (2026-08-23, SELESAI)

Root cause: 5 pasang `DELETE FROM production_batch_steps;` / `DELETE FROM production_batches;` di `supabase/tests/production.test.sql` (baris 94-95, 119-120, 137-138, 188-189, 233-234 versi sebelum fix) **tidak di-scope** — menghapus seluruh isi tabel, bukan hanya fixture milik test (`sales_order_item_id = '...d9'`). Ketika DB berisi data lain (mis. delivered production dari seed 200 dummy), cascade delete `production_batch_steps → qc_inspections` (`ON DELETE CASCADE`) menabrak `delivery_items_qc_inspection_id_fkey` (`ON DELETE RESTRICT`) milik baris QC pihak lain.

Fix: kelima DELETE di-scope memakai pola `USING production_batches b, engineering_jobs ej ... WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000000d9'`, konsisten dengan pola scoping yang sudah dipakai di seluruh query lain di file yang sama. Tidak ada perubahan assertion/behavior test — murni scoping cleanup ke fixture milik test ini sendiri.

Verifikasi:

- `supabase db reset --local` → `supabase test db production.test.sql` saja: PASS (13/13), baseline tidak regresi.
- Reproduksi bug: load ulang `supabase/seed-test/20260823_dummy_200_volume_test.sql` (200 SO dummy delivered/QC-active) lalu `supabase test db` full suite: **256/256 PASS** (sebelumnya gagal di `production.test.sql`).
- `supabase db lint --local --level warning --fail-on none`: 0 error.
- `supabase db reset --local` lagi (buang data dummy) → `supabase test db`: tetap **256/256 PASS**, state bersih.

File yang diubah: `supabase/tests/production.test.sql` saja (30 insertions, 10 deletions). Tidak ada perubahan migration atau kode aplikasi.
