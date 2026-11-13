# Bamanbirr

*Every birr, accounted for.* A Baman Technologies product.

Turns telebirr (127) and CBE SMS history into a checked, filterable money report.
Messages are parsed **on the user's device**; no AI or third-party API is involved.

## Layout

```
packages/parser   TypeScript engine: telebirr + CBE patterns, balance check,
                  CBE <-> telebirr linking, labels, and readers for
                  PDF page text, Mac chat.db (+ WAL), Android XML backups
apps/web          Next.js 16 app (landing, upload, reports, accounts)
apps/mobile       Expo app (coming next)
fixtures/         YOUR local test data, git-ignored, never committed
```

## Develop

```bash
pnpm install
pnpm --filter @bamanbirr/web dev      # http://localhost:3000
```

- `/` — landing page
- `/analyze` — choose accounts → choose a format (PDF, Mac `chat.db`, Android XML) → drop files →
  live progress → report. Parsing runs in a Web Worker (`apps/web/src/lib/analysis/`); PDFs are read with
  pdf.js and `chat.db` with sql.js (runtime files are copied to `public/vendor` by `scripts/copy-vendor.mjs`).

## Supabase (accounts, saved reports)

1. **Keys** — fill in `apps/web/.env` (copy of `.env.example`): project URL, anon/publishable key, secret key.
2. **Schema** — run `supabase/migrations/20261113000000_init.sql` in the Supabase SQL editor (or `supabase db push`).
   Tables `uploads`, `messages` (bank SMS only, unique per fingerprint), `runs` (immutable, auto-numbered
   versions), `labels` — all with row-level security; deleting a user cascades to their rows.
3. **Auth settings** (Dashboard → Authentication):
   - URL Configuration → Site URL `http://localhost:3000`; Redirect URLs add `http://localhost:3000/auth/callback`
     (and your production URL + `/auth/callback` later).
   - Providers → Email is on by default (confirm-email on is fine). For "Continue with Google", enable Google
     and paste your Google OAuth client ID/secret.
4. Restart `pnpm dev`.

How it works:
- `/signin` — email + password, email sign-in link, or Google. `/auth/callback` finishes links and OAuth.
- "Save report" (after an analysis) keeps the result in this browser (IndexedDB) through sign-in, then
  `/reports/save` stores the telebirr/CBE messages, re-analyses the account's **whole** history, and saves a
  new version. Saving the same messages again reuses the existing version instead of duplicating it.
- `/reports` — versions with totals, Open, Delete, **Re-run analysis** (re-parses stored messages with the
  current analyzer, no upload needed), delete all data, delete account (`/api/account`, uses the secret key).
- `src/proxy.ts` keeps the session cookie fresh.

## Test the parser

Synthetic tests run anywhere:

```bash
pnpm --filter @bamanbirr/parser test
```

Golden tests compare against the Python reference results on real exports.
Put (or symlink) the files in `fixtures/` (`127.jsonl`, `cbe.jsonl`,
`transactions.json`, `cbe.json`, `labels.json`, `chat.db[-wal]`,
`127-2025.pdf`, `pdf-transactions.json`) and run:

```bash
cd packages/parser && TZ=Africa/Addis_Ababa BAMANBIRR_FIXTURES=../../fixtures pnpm test
```
