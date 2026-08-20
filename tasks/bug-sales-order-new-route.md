# Prompt untuk Hermes — Bug: `/sales-orders/new` tidak merender form

Gunakan prompt ini sebagai task untuk Hermes (coding agent) memperbaiki bug routing di DSM MOS.

---

Task: Fix bug — route `/sales-orders/new` merender ulang halaman list Sales Order, bukan form pembuatan SO baru.

Context:
- App: DSM MOS (TanStack Start + TanStack Router, file-based routing).
- Ditemukan saat browser test manual untuk milestone M6.8 (QC offline queue) — proses seeding data test (Sales Order → Production → QC) terhenti total di langkah pertama karena bug ini.
- File terkait:
  - [src/routes/_authenticated/sales-orders.tsx](src/routes/_authenticated/sales-orders.tsx) — list page (`AuthenticatedSalesOrdersRoute`)
  - [src/routes/_authenticated/sales-orders.new.tsx](src/routes/_authenticated/sales-orders.new.tsx) — form page (`AuthenticatedSalesOrdersNewRoute`), memuat `SalesOrderForm`
  - [src/features/sales-orders/components/sales-order-form.tsx](src/features/sales-orders/components/sales-order-form.tsx)
  - [src/hooks/use-my-roles.ts](src/hooks/use-my-roles.ts) — dipakai `NewSalesOrderPage` untuk cek role (pakai `useSuspenseQuery`)
  - [src/routeTree.gen.ts](src/routeTree.gen.ts) — route sudah terdaftar benar (lihat sekitar baris 490–505), jadi kemungkinan bug bukan di route registration.

Reproduksi (100% konsisten, sudah dicoba 4 cara berbeda):
1. Login sebagai admin (`admin@dsm.com`), buka `/sales-orders`.
2. Klik tombol "SO Baru" (link ke `/sales-orders/new`) → halaman tetap menampilkan list, tidak pindah ke form.
3. `navigate({ to: "/sales-orders/new" })` langsung via client router → hasil sama.
4. Hard reload penuh (`navigate` dengan `force: true`, tab browser baru, bahkan `window.location.assign(...)`) ke URL `http://localhost:8080/sales-orders/new` → tetap render list, bukan form.

Evidence:
- URL bar & `document.title` benar: `"SO Baru — DSM MOS"` (sesuai `head.meta` di `sales-orders.new.tsx`).
- Tapi konten DOM yang dirender adalah `SalesOrdersPage` (list): ada search box "Cari nomor SO atau customer...", dropdown "Semua status", tabel dengan header "No. SO / Customer / Tgl Order / ...", teks "Tidak ada data." / "Buat SO Baru", pagination "0 data · Halaman 1 dari 1".
- Network request yang terpicu saat load `/sales-orders/new` adalah query list: `GET /rest/v1/sales_orders?select=*,customer:customers!inner(...),sales_order_items(count)&order=created_at.desc&offset=0&limit=20` — ini query dari `useSalesOrders` (dipakai `SalesOrdersPage`), BUKAN query yang diharapkan dari `NewSalesOrderPage` (yang harusnya query `useCustomers` untuk dropdown customer di form).
- Console error yang muncul bersamaan (kemungkinan terkait, perlu diverifikasi):
  ```
  Can't perform a React state update on a component that hasn't mounted yet.
  This indicates that you have a side-effect in your render function that
  asynchronously tries to update the component. Move this work to useEffect instead.
  ```

Hipotesis awal (perlu diverifikasi, bukan kesimpulan final):
- Route config di `routeTree.gen.ts` terlihat benar, jadi kemungkinan besar bug ada di layer render/transition React, bukan route matching itu sendiri.
- `NewSalesOrderPage` menggunakan `useMyRoles()` yang berbasis `useSuspenseQuery` — cek apakah ada masalah Suspense boundary / error boundary di layout `_authenticated` yang menyebabkan fallback ke match/komponen sebelumnya saat suspense/error terjadi saat transisi route.
- Cek juga apakah ada `pendingComponent`/`errorComponent` di level `_authenticated` root route yang secara tidak sengaja me-render ulang match sebelumnya alih-alih route baru.
- Reproduksi console error di atas dan telusuri call stack-nya — kemungkinan berasal dari komponen di `SalesOrderForm`, `useCustomers`, atau `useMyRoles` yang melakukan setState di render path (bukan `useEffect`).

Goal:
1. Root-cause bug ini (bukan cuma tempel workaround).
2. Fix agar navigasi ke `/sales-orders/new` (via klik link, `navigate()`, maupun hard reload) benar-benar merender `NewSalesOrderPage` dengan form `SalesOrderForm`, query yang terpicu adalah `useCustomers` (bukan `useSalesOrders`).
3. Pastikan tidak regresi ke route lain yang punya pola serupa (list + `/new` sibling route) — cek apakah ada route lain dengan pola sama (mis. `production-planning`, dsb.) yang berpotensi kena bug yang sama.
4. Tulis/jalankan test yang membuktikan fix ini (unit/integration test navigasi, atau minimal verifikasi manual dengan browser test tool).

Acceptance criteria:
- [ ] Klik "SO Baru" dari `/sales-orders` benar-benar membuka form `SalesOrderForm`.
- [ ] Hard reload ke `/sales-orders/new` langsung merender form (bukan list).
- [ ] Console error "Can't perform a React state update on a component that hasn't mounted yet" tidak muncul lagi selama transisi ini (atau dikonfirmasi tidak relevan dengan bug, dengan penjelasan).
- [ ] `bunx tsc --noEmit`, `bun run lint`, `bun run build` tetap PASS.
- [ ] Sales Order baru berhasil dibuat end-to-end lewat form ini (submit → redirect ke `/sales-orders/$id`).

Rules:
- Root-cause dulu sebelum patch — jangan tebak-tebak fix tanpa reproduksi jelas dulu penyebabnya.
- Jangan ubah scope di luar bug ini (jangan refactor besar-besaran modul Sales Order).
- Setelah fix, laporkan penyebab root cause-nya secara singkat supaya bisa dicek apakah pola serupa ada di modul lain.
