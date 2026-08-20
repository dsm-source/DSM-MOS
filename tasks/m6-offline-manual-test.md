# M6.8 — Manual Test: QC Offline Queue

Checklist verifikasi manual untuk M6.6 (offline queue QC). Jalankan sebagai user dengan role `qc` atau `admin`, di browser dengan Chrome DevTools.

## Prasyarat
- Login sebagai user role `qc`/`admin`.
- Ada minimal 1 batch dengan tahapan berstatus `waiting` (masuk antrian QC) — buat dari halaman Production jika belum ada.

## Langkah

1. **Buka halaman QC** (`/qc`). Pastikan tab "Antrian" menampilkan inspeksi berstatus `waiting`.
2. **Pilih inspeksi `waiting`** — klik "Buka" pada salah satu kartu antrian, dialog inspeksi terbuka.
3. **Matikan jaringan** — DevTools → tab Network → dropdown throttling → pilih "Offline".
4. **Simpan draft offline** — isi Total/OK/Tolak, klik "Simpan". Verifikasi:
   - Muncul toast **"Tersimpan lokal, menunggu sinkronisasi"**.
   - Tidak ada error/crash.
5. **Coba transisi status offline** — klik "Mulai Inspeksi" (atau tombol transisi yang tersedia). Verifikasi:
   - Toast queued muncul lagi.
   - Dialog tertutup jika transisi ke `pass`/`reject`; tetap terbuka untuk `inspection`.
   - Tutup dialog, lihat indikator di halaman QC dekat search box: teks **"N data tersimpan lokal, menunggu sinkronisasi"** dengan N ≥ 2 (draft + transisi).
6. **Nyalakan kembali jaringan** — DevTools Network → set kembali ke "Online" (atau "No throttling").
7. **Verifikasi auto-sync**:
   - Tunggu beberapa detik setelah online (event `online` browser terpicu otomatis) atau klik tombol "Coba sinkronkan" pada indikator.
   - Toast sukses sinkronisasi muncul (mis. "N data lokal berhasil disinkronkan").
   - Indikator antrian lokal hilang (pending = 0).
   - Data di kartu/dialog QC ter-refresh sesuai status & qty terakhir yang diinput.
8. **Verifikasi persistensi setelah refresh** — reload halaman (`F5`). Pastikan status & qty yang tadi disinkronkan tetap tersimpan (bukan hanya tampil sementara di client).
9. **Opsional — reject → rework offline/online**:
   - Buka inspeksi berstatus `inspection`, set qty (misal semua reject), klik "Tolak" → status jadi `reject`.
   - Matikan jaringan, buka inspeksi `reject`, klik "Trigger Rework". Verifikasi toast queued muncul & dialog tertutup.
   - Nyalakan jaringan kembali, verifikasi rework RPC tersinkron (batch/step baru untuk rework muncul di Production, indikator pending hilang).

## Catatan Perilaku yang Diverifikasi
- Deteksi offline: `navigator.onLine === false` ATAU request gagal dengan error jaringan (`failed to fetch`/`network`/`fetch`).
- Sinkronisasi berjalan serial (satu per satu), berhenti di kegagalan pertama (baik error jaringan maupun error validasi server) — item yang gagal tetap ada di antrian lokal dan toast error ditampilkan.
- Antrian tersimpan di `localStorage` (key `dsm-mos:qc-offline-queue`) — bertahan lintas refresh selama belum tersinkron.
