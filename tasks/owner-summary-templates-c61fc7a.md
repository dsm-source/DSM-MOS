# Template Ringkasan Owner — Commit `c61fc7a`

## Template A — Jika Codex `pass`

Subject/lead:

`Update DSM MOS: review Codex untuk commit c61fc7a PASS. M5 + M6 + fix route Outlet selesai, tidak ada temuan blocking.`

Body:

```md
Pak, update DSM MOS.

Commit `c61fc7a` sudah direview Codex dan hasilnya **PASS** — tidak ada temuan blocking yang menahan close task ini.

Yang tercakup di commit ini:
- M5 Production Execution
- M6 Quality Control step-level + offline queue
- fix bug route parent tanpa `<Outlet />` di:
  - `/sales-orders/$id/edit`
  - `/delivery/schedule`
  - `/delivery/$id`
  - `/engineering/workload`
  - `/engineering/$id`

Verifikasi yang sudah ada:
- `bun run build` PASS
- `bun run lint` PASS
- `bunx tsc --noEmit` PASS
- browser verification route fix PASS
- M6.8 manual offline→online sync PASS
- `get_advisors` remote jalan: performance bersih, security ada 1 WARN `auth_leaked_password_protection`

Catatan risiko tersisa:
- `auth_leaked_password_protection` di Supabase Auth masih OFF. Status: **accepted risk**, non-blocking.
- Jika Codex memberi minor/saran non-blocking, akan saya catat terpisah untuk backlog/cleanup.

Kesimpulan:
- **Checkpoint M6 valid ditutup**
- branch `main` sudah memuat perubahan ini
- next logical step: mulai M7 Delivery, dengan perhatian khusus ke query delivery yang masih pakai relasi QC lama jika temuan itu dikonfirmasi reviewer sebagai future bug
```

## Template B — Jika Codex `changes_requested`

Subject/lead:

`Update DSM MOS: review Codex untuk commit c61fc7a belum lolos. Ada temuan blocking, task dikembalikan ke Claude.`

Body:

```md
Pak, update DSM MOS.

Commit `c61fc7a` sudah direview Codex, tapi hasilnya **CHANGES REQUESTED** karena ada temuan blocking yang perlu diperbaiki dulu sebelum bisa dianggap selesai penuh.

Ringkas temuan blocking:
- [Temuan blocking #1 — file/area]
- [Temuan blocking #2 — file/area]
- [Temuan blocking #3 — file/area]

Dampak bisnis/operasional:
- [risiko konkret 1]
- [risiko konkret 2]

Yang **sudah benar / tetap valid**:
- build/lint/tsc sebelumnya PASS
- browser verification yang sudah dijalankan tetap tercatat
- M6.8 manual offline→online sync tetap tercatat
- `get_advisors` tetap hanya menemukan 1 WARN non-blocking di Auth setting

Status sekarang:
- task **belum boleh ditutup** menurut Definition of Done
- saya kembalikan ke Claude untuk fix temuan Codex
- setelah fix, review akan diulang lagi ke Codex

Catatan:
- batas loop Claude ↔ Codex maksimal 3 iterasi per task
- jika setelah iterasi berikutnya masih ada blocking, saya eskalasi dengan opsi keputusan owner
```

## Mini Template — 1 paragraf singkat

### PASS

```md
Pak, update: commit `c61fc7a` sudah direview Codex dan **PASS** tanpa temuan blocking. Jadi paket M5 Production Execution, M6 QC step-level + offline queue, plus fix bug route Outlet di sales order/delivery/engineering bisa dianggap selesai. Sisa risiko hanya 1 warning Supabase Auth `auth_leaked_password_protection`, status accepted risk dan non-blocking.
```

### CHANGES REQUESTED

```md
Pak, update: commit `c61fc7a` sudah direview Codex tapi **belum lolos** karena masih ada temuan blocking di [area/file]. Jadi task ini belum bisa ditutup menurut Definition of Done. Saya kembalikan ke Claude untuk fix dulu, lalu akan saya kirim ulang ke Codex untuk review final.
```

## Placeholder cepat buat isi final

Jika PASS, isi bagian ini:
- minor findings:
- suggestions:
- out-of-scope findings:
- next step:

Jika CHANGES REQUESTED, isi bagian ini:
- blocking findings:
- file terdampak:
- risiko konkret:
- estimasi iterasi review berikutnya:
