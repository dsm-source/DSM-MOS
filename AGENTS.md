# AGENTS.md

File ini adalah alias untuk tools (Cursor, Copilot, Antigravity, OpenCode, dll.) yang mencari `AGENTS.md` secara konvensi. **Sumber kebenaran (source of truth) untuk aturan orkestrasi ada di [`AGENT.md`](./AGENT.md)** — baca file itu dulu sebelum memulai tugas apa pun di repo ini.

Ringkasan singkat (detail lengkap ada di `AGENT.md`, jangan diduplikasi di sini):

- **Hermes** — PM/orchestrator: menerima instruksi owner, mendelegasikan ke Claude & Codex, melapor ke owner.
- **Claude** — coding: wajib pakai skill `using-agent-skills` lalu `graphify`, juga Context7 untuk dokumentasi library/API tanpa perlu diminta.
- **Codex** — review/audit: wajib pakai skill `using-agent-skills` untuk memilih skill audit yang sesuai, melaporkan temuan dengan severity ke Hermes.
- Definition of Done, batas iterasi loop, jejak audit, scope guard, dan skill mapping — semua diatur di `AGENT.md`.

Jika ada perbedaan antara file ini dan `AGENT.md`, **`AGENT.md` yang berlaku**.
