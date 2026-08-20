# Prompt Browser Test — M6.8 DSM MOS

Gunakan prompt ini di Claude / agent browser tester.

---

Task: Browser smoke test + manual verification untuk DSM MOS milestone M6 (QC offline queue).

Context:
- App URL: `http://localhost:8080/`
- Local Supabase stack aktif.
- Scope fokus: modul **Quality Control** (`/qc`), khusus fitur M6.6 + M6.8.
- Login credentials akan diberikan terpisah oleh owner saat run.
- Backend dan frontend sudah lulus verifikasi statis:
  - `supabase test db` PASS (215 tests)
  - `bunx tsc --noEmit` PASS
  - `bun run lint` PASS
  - `bun run build` PASS
- QC sekarang model **per-step**, bukan per-batch.
- Rework harus lewat RPC formal `trigger_rework`, bukan direct status update.
- Offline queue pakai `localStorage`, dengan banner amber: `"{n} data tersimpan lokal, menunggu sinkronisasi"` dan tombol `Coba sinkronkan`.

Goal:
Lakukan browser test end-to-end untuk memastikan flow offline QC benar-benar bekerja di UI nyata.

Yang harus diuji:

## A. Login
1. Buka app.
2. Login memakai credential yang diberikan owner.
3. Pastikan berhasil masuk ke aplikasi.

## B. Navigasi ke QC
4. Buka halaman `/qc`.
5. Pastikan queue inspeksi tampil.
6. Pilih satu item QC dengan status `waiting` atau `inspection`.

## C. Offline draft queue
7. Buka DevTools / network controls.
8. Matikan network / set browser ke offline.
9. Di dialog QC, ubah field draft:
   - `qty_total`
   - `qty_ok`
   - `qty_reject`
   - `defect_notes`
10. Klik `Simpan`.
11. Verifikasi:
   - tidak ada crash
   - muncul toast / indikator bahwa data disimpan lokal
   - banner amber tampil dengan count > 0

## D. Offline status transition queue
12. Saat masih offline, coba jalankan transisi status yang valid:
   - jika status `waiting`, klik `Mulai Inspeksi`
   - jika status `inspection`, isi angka valid lalu klik `Lulus` atau `Tolak`
13. Verifikasi:
   - action tidak hilang
   - queue count bertambah / tetap sesuai ekspektasi
   - UI memberi tahu bahwa data menunggu sinkronisasi

## E. Online auto-sync
14. Nyalakan kembali network.
15. Tunggu auto-sync berjalan.
16. Jika perlu, klik `Coba sinkronkan`.
17. Verifikasi:
   - banner amber hilang jika queue habis
   - data/status benar-benar tersimpan setelah refetch
   - refresh halaman tetap menunjukkan state final yang benar

## F. Optional reject → rework path
18. Jika ada item yang bisa diuji dengan status `reject`, uji tombol `Trigger Rework`.
19. Verifikasi:
   - tombol hanya muncul pada status `reject`
   - action sukses tanpa direct status edit
   - setelah sync/refetch, state berubah konsisten dengan backend

## Output yang diminta
Berikan laporan ringkas dengan format:

1. **Verdict**: PASS / FAIL
2. **Test steps executed**
3. **Observed results**
4. **Bug list** (jika ada), per bug:
   - severity: blocking / major / minor
   - page
   - langkah reproduksi
   - hasil aktual
   - hasil harapan
5. **Evidence**:
   - screenshot path jika ada
   - URL/page
6. **Conclusion**:
   - apakah M6.8 bisa dicentang atau belum

Rules:
- Jangan ubah kode.
- Jangan ubah database manual kecuali owner secara eksplisit minta.
- Fokus hanya pada browser verification, bukan refactor.
- Kalau login gagal, hentikan dan laporkan blocker.
- Kalau queue offline gagal sinkron, laporkan detail persis di langkah mana gagal.

---

Prompt singkat versi sekali tempel:

```text
Lakukan browser test untuk DSM MOS M6.8 di http://localhost:8080/. Fokus hanya pada modul Quality Control (/qc) dan fitur offline queue M6.6. Login pakai credential yang diberikan owner. Uji flow ini: login -> buka /qc -> pilih item inspeksi -> matikan network -> simpan draft offline -> verifikasi banner amber/pending queue -> lakukan transisi status offline -> nyalakan network -> verifikasi auto-sync / tombol Coba sinkronkan -> refresh halaman -> pastikan data final tersimpan. Jika memungkinkan, uji juga path reject -> Trigger Rework. Jangan ubah kode atau database. Outputkan verdict PASS/FAIL, langkah yang dieksekusi, hasil observasi, daftar bug dengan severity, dan apakah M6.8 bisa dicentang.
``` 
