# E2E suite (Playwright)

Covers the flows that keep getting retested by hand:

| Spec | Bug | What it proves |
|---|---|---|
| `bug2-forced-password-change.spec.ts` | BUG-2 / BUG-2R4 | forced password change: no dead-token logout, no notifications 401 noise, success toast, no re-login loop |
| `bug8-delivery-qc-pass.spec.ts` | BUG-8 | `delivery` role sees QC-pass candidates and can run draft → prepared → shipped → delivered |
| `bug6-production-dnd.spec.ts` | BUG-6 | only a `running` batch renders a drag handle; dragging it onto the next column opens the confirm panel and completes the step through the gated mutation |

## Local stack only

These run against the **local** Supabase stack (`http://127.0.0.1:54321`) and the
local dev server on port 8080. The remote project is never touched.

## Running

```bash
supabase start            # once — Postgres/Auth/REST on :54321
bun run test:e2e:reset    # db reset + demo seed (destructive to local data)
bun run test:e2e          # runs the specs (starts `bun run dev` itself)
```

`test:e2e:reset` is separate on purpose — it wipes your local DB. Run it when
local data has drifted from the demo seed; otherwise `test:e2e` reuses whatever
state is there.

Each spec creates its own `e2e-*@dsm-mos.local` fixtures and deletes them in
`afterAll`, so a re-run without a reset still works.

Admin login uses the seeded `demo-admin@dsm-mos.local` / `demo1234` account
(provisioned by the demo seed).
