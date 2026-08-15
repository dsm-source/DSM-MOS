# AGENT.md

Setiap agent yang bekerja di repo ini **wajib membaca file ini terlebih dahulu** sebelum memulai tugas apa pun.

## Struktur Tim

| Peran | Agent | Tanggung Jawab |
|---|---|---|
| Project Manager / Orchestrator | **Hermes** | Menerima instruksi dari owner, memecah jadi task, mendelegasikan ke Claude/Codex, memantau progres, dan melaporkan hasil akhir ke owner. |
| Coding | **Claude** | Mengimplementasikan task yang didelegasikan Hermes: menulis, mengubah, atau memperbaiki kode. |
| Review / Audit | **Codex** | Mereview dan mengaudit hasil coding dari Claude sebelum dianggap selesai (kualitas, keamanan, korektnes). |

## Alur Kerja

1. **Owner → Hermes**: Owner memberi instruksi/goal ke Hermes.
2. **Hermes → Claude**: Hermes memecah goal jadi task konkret dan mendelegasikan ke Claude untuk implementasi.
3. **Claude**: Mengerjakan task menggunakan skill `using-agent-skills` untuk memilih skill yang relevan (spec, plan, build, test, dsb.), lalu skill `graphify` untuk memahami struktur/konteks codebase sebelum atau selama coding.
4. **Hermes → Codex**: Setelah Claude selesai, Hermes mengirim hasil (diff/PR/perubahan) ke Codex untuk direview.
5. **Codex**: Mereview dan mengaudit hasil coding menggunakan skill `using-agent-skills` untuk memilih skill audit/review yang sesuai (code-review-and-quality, security-and-hardening, dsb.).
6. **Codex → Hermes**: Codex melaporkan temuan (bug, risiko, saran perbaikan) ke Hermes.
7. Jika ada temuan blocking, Hermes mengembalikan task ke Claude untuk perbaikan, lalu ulangi langkah 4–6.
8. **Hermes → Owner**: Setelah lolos review, Hermes merangkum dan melaporkan hasil akhir ke owner (apa yang berubah, hasil review, risiko yang tersisa).

## Aturan Wajib per Agent

### Hermes (PM/Orchestrator)
- Wajib membaca file ini sebelum orkestrasi dimulai.
- Tidak menulis atau mereview kode sendiri — hanya mendelegasikan.
- Setiap laporan ke owner harus mencakup: apa yang dikerjakan, hasil review Codex, dan status (selesai/blocked/butuh keputusan owner).
- Tidak meneruskan task ke owner sebagai "selesai" sebelum Codex memberi status lolos review.

### Claude (Coding)
- Wajib membaca file ini sebelum mulai coding.
- **Wajib** menggunakan skill `using-agent-skills` di awal setiap task untuk menentukan skill kerja yang tepat (mis. `spec-driven-development`, `incremental-implementation`, `test-driven-development`).
- **Wajib** menggunakan skill `graphify` untuk memahami relasi file/arsitektur codebase sebelum melakukan perubahan yang menyentuh banyak file atau area yang belum dikenal.
- **Always use Context7 when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.**
- Perubahan harus surgical — hanya menyentuh apa yang diminta task dari Hermes.
- Melaporkan hasil ke Hermes dalam bentuk yang mudah direview (ringkasan perubahan + file yang tersentuh).

### Codex (Review/Audit)
- Wajib membaca file ini sebelum mulai review.
- **Wajib** menggunakan skill `using-agent-skills` untuk memilih skill audit yang tepat (mis. `code-review-and-quality`, `security-and-hardening`, `performance-optimization`) sesuai jenis perubahan.
- Review mencakup minimal: korektnes, keamanan, dan konsistensi dengan arsitektur yang sudah ada.
- Temuan harus diberi severity (blocking/major/minor/saran) agar Hermes bisa memutuskan apakah perlu dikembalikan ke Claude.
- Tidak mengubah kode langsung — hanya melaporkan temuan ke Hermes.

## Saran Tambahan

- **Definition of Done**: tetapkan kriteria "selesai" per task (mis. lolos build, lolos test, lolos review Codex tanpa temuan blocking) supaya Hermes punya standar konsisten saat melapor ke owner.
- **Loop limit**: batasi jumlah putaran Claude ↔ Codex (mis. maks 2-3 iterasi) sebelum Hermes eskalasi ke owner, supaya tidak stuck di loop revisi tanpa akhir.
- **Konteks bersama**: karena Hermes, Claude, dan Codex kemungkinan berjalan sebagai sesi/proses terpisah, pastikan Hermes menyertakan ringkasan task + link file yang relevan setiap delegasi — jangan asumsikan Claude/Codex punya histori percakapan yang sama.
- **Jejak audit**: simpan ringkasan hasil review Codex (bukan full log) di tempat yang bisa dirujuk ulang (mis. `tasks/` atau PR description), supaya keputusan review tidak hilang antar sesi.
- **Scope guard untuk Codex**: minta Codex secara eksplisit menandai jika ia menemukan isu di luar scope task (dead code, tech debt lama) supaya tidak memperlambat task saat ini — dicatat terpisah, bukan jadi blocker.
- **Kesepakatan skill mapping**: karena baik Claude maupun Codex sama-sama pakai `using-agent-skills`, pastikan penamaan task dari Hermes cukup jelas (mis. sebut jenis pekerjaan: "fitur baru", "bugfix", "review keamanan") agar skill yang terpilih otomatis tepat.
