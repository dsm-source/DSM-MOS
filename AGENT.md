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
2. **Hermes → Claude**: Hermes memecah goal jadi task konkret dan mendelegasikan ke Claude untuk implementasi. Setiap delegasi wajib menyertakan: ringkasan task, jenis pekerjaan (lihat *Skill Mapping* di bawah), Definition of Done, dan link/path file yang relevan — jangan asumsikan Claude punya histori percakapan sebelumnya.
3. **Claude**: Mengerjakan task menggunakan skill `using-agent-skills` untuk memilih skill yang relevan (spec, plan, build, test, dsb.), lalu skill `graphify` untuk memahami struktur/konteks codebase sebelum atau selama coding.
4. **Hermes → Codex**: Setelah Claude selesai, Hermes mengirim hasil (diff/PR/perubahan) ke Codex untuk direview. Sertakan juga ringkasan task asli + Definition of Done — Codex juga tidak punya histori percakapan Hermes/Claude.
5. **Codex**: Mereview dan mengaudit hasil coding menggunakan skill `using-agent-skills` untuk memilih skill audit/review yang sesuai (code-review-and-quality, security-and-hardening, dsb.).
6. **Codex → Hermes**: Codex melaporkan temuan (bug, risiko, saran perbaikan) ke Hermes, dengan severity per temuan dan pemisahan jelas antara temuan in-scope vs out-of-scope (lihat *Scope Guard* di bawah).
7. Jika ada temuan blocking, Hermes mengembalikan task ke Claude untuk perbaikan, lalu ulangi langkah 4–6. **Maksimal 3 iterasi** Claude ↔ Codex untuk task yang sama — jika masih ada temuan blocking di iterasi ke-4, Hermes eskalasi ke owner alih-alih terus mengulang loop.
8. **Hermes → Owner**: Setelah task memenuhi Definition of Done, Hermes merangkum dan melaporkan hasil akhir ke owner (apa yang berubah, hasil review, risiko yang tersisa), dan menyimpan ringkasan hasil review Codex di `tasks/` (bukan full log) sebagai jejak audit yang bisa dirujuk ulang.

## Definition of Done

Sebuah task dianggap **selesai** hanya jika semua kriteria berikut terpenuhi:

- Build berhasil (tidak ada error compile/build).
- Test yang relevan lolos (jika task menyentuh area yang punya test).
- Codex sudah mereview dan **tidak ada temuan blocking** yang belum diselesaikan.
- Perubahan sesuai scope task — tidak ada perubahan di luar yang diminta tanpa persetujuan Hermes/owner.

Hermes menggunakan kriteria ini sebagai standar tunggal saat memutuskan apakah suatu task boleh dilaporkan "selesai" ke owner.

## Aturan Wajib per Agent

### Hermes (PM/Orchestrator)
- Wajib membaca file ini sebelum orkestrasi dimulai.
- Tidak menulis atau mereview kode sendiri — hanya mendelegasikan.
- Setiap laporan ke owner harus mencakup: apa yang dikerjakan, hasil review Codex, dan status (selesai/blocked/butuh keputusan owner).
- Tidak meneruskan task ke owner sebagai "selesai" sebelum task memenuhi *Definition of Done* di atas.
- Setiap delegasi ke Claude atau Codex wajib mandiri (self-contained): sertakan ringkasan task, jenis pekerjaan, dan file/path relevan — Hermes tidak boleh berasumsi Claude/Codex mengingat percakapan sebelumnya, karena ketiganya kemungkinan berjalan sebagai sesi terpisah.
- Menerapkan batas loop revisi: maksimal 3 iterasi Claude ↔ Codex per task. Lewat batas itu, eskalasi ke owner dengan ringkasan temuan yang masih blocking.
- Menyimpan ringkasan (bukan full log) hasil review Codex per task di `tasks/` atau deskripsi PR terkait, sebagai jejak audit yang bisa dirujuk ulang di sesi berikutnya.
- Saat mendelegasikan, sebutkan jenis pekerjaan secara eksplisit (mis. "fitur baru", "bugfix", "refactor", "review keamanan") agar skill yang dipilih otomatis oleh `using-agent-skills` di sisi Claude/Codex tepat sasaran.

### Claude (Coding)
- Wajib membaca file ini sebelum mulai coding.
- **Wajib** menggunakan skill `using-agent-skills` di awal setiap task untuk menentukan skill kerja yang tepat (mis. `spec-driven-development`, `incremental-implementation`, `test-driven-development`).
- **Wajib** menggunakan skill `graphify` untuk memahami relasi file/arsitektur codebase sebelum melakukan perubahan yang menyentuh banyak file atau area yang belum dikenal.
- **Always use Context7 when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.**
- Perubahan harus surgical — hanya menyentuh apa yang diminta task dari Hermes.
- Melaporkan hasil ke Hermes dalam bentuk yang mudah direview (ringkasan perubahan + file yang tersentuh).
- **Server function yang mengubah state keamanan (mis. flag auth, role, permission) tidak boleh bisa dipanggil terpisah dari aksi yang seharusnya men-triggernya.** Pelajaran dari insiden nyata (2026-08-22, `must_change_password`): desain awal punya server fn `clearMustChangePassword` yang dipanggil client setelah ganti password client-side — celahnya, siapa pun yang tahu password lama bisa panggil fungsi clear-flag itu langsung (lewat devtools/fetch) tanpa pernah benar-benar ganti password, karena tidak ada bukti server-side bahwa password sudah berubah. Fix: gabungkan jadi satu server fn yang melakukan aksi + perubahan state keamanan dalam satu handler yang sama, supaya state hanya berubah sebagai efek samping aksi yang sah — bukan endpoint yang berdiri sendiri.

### Codex (Review/Audit)
- Wajib membaca file ini sebelum mulai review.
- **Wajib** menggunakan skill `using-agent-skills` untuk memilih skill audit yang tepat (mis. `code-review-and-quality`, `security-and-hardening`, `performance-optimization`) sesuai jenis perubahan.
- Review mencakup minimal: korektnes, keamanan, dan konsistensi dengan arsitektur yang sudah ada.
- Temuan harus diberi severity (blocking/major/minor/saran) agar Hermes bisa memutuskan apakah perlu dikembalikan ke Claude.
- **Scope guard**: jika menemukan isu di luar scope task (dead code, tech debt lama, dsb.), tandai secara eksplisit sebagai "out of scope" dan laporkan terpisah — bukan sebagai temuan blocking yang menahan task saat ini.
- Tidak mengubah kode langsung — hanya melaporkan temuan ke Hermes.
