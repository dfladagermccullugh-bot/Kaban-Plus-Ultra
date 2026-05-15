# Security

The security model in one sentence: **every authorization decision is made by Postgres RLS**, and the client never holds a credential capable of bypassing it.

## Invariants (do not break)

1. **No `SUPABASE_SERVICE_ROLE_KEY` in the client.** Ever. It only exists in:
   - server-side Next.js code under `apps/web/app/api/admin/**` (none currently)
   - Supabase Edge Functions
   - server-side scripts in `scripts/admin/**` (gitignored env)
2. **RLS is `ENABLE`d on every public table.** Adding a table without a policy block is a CI failure.
3. **Every Supabase client used from a route handler or page that runs as the user must be the anon-key client with the user's JWT attached.** Helpers live in `apps/web/lib/supabase/`.
4. **Public share links read via a short, random, rotatable `share_token`.** Never expose internal UUIDs as the share secret.

## Secrets handling

- All secrets live in `.env` (gitignored). The committed `.env.example` lists the keys with empty values.
- Vercel: secrets set in the project's environment variables panel. `NEXT_PUBLIC_*` only for non-secret values (Supabase URL, anon key).
- Supabase Cloud: service-role key never leaves the dashboard; copied into Vercel server env only.
- Self-host: a `secrets/` dir mounted into containers; `chmod 600`.

## Auth flows

### Email magic link
1. Client submits email → Supabase emails a one-time link valid 1 hour.
2. Link contains an opaque token; consumed once on click.
3. Server sets a `sb-*` HTTP-only, SameSite=Lax cookie. Mobile uses Capacitor Preferences (Keychain / EncryptedSharedPreferences).

### Google OAuth
1. Standard Supabase OAuth redirect.
2. On iOS / Android: opened via Capacitor Browser → `ASWebAuthenticationSession` / Custom Tabs (NOT in-app webview — Google blocks that).
3. Same cookie / Preferences result.

### Sign-out
- Clears Supabase session + cookies / Preferences.
- Revokes the refresh token server-side.

## Image upload validation

Lives in Edge Function `functions/upload-image`:

- Max **10 MB**.
- MIME in `image/jpeg | image/png | image/webp | image/gif`.
- Decode the bitstream (Sharp) — reject if it doesn't actually decode as the claimed type.
- Dimensions ≤ **8192×8192**.
- Strip EXIF.
- Compute blurhash (server-side).
- Insert `images` row, return a **signed URL** with 7-day expiry.
- Storage path scoped: `images/{board_id}/{uuid}.{ext}` — RLS on the bucket checks `private.has_board_access(board_id, 'editor')` (helper lives in the unexposed `private` schema; see ADR 0021).

## Rate limits

Implemented at the Edge Function layer with `@upstash/ratelimit` (or Supabase's built-in rate limiter when self-hosted):

| Endpoint | Limit |
|---|---|
| auth: magic link request | 5 / 10 min / IP+email |
| auth: OAuth callback | 30 / min / IP |
| upload-image | 30 / min / user |
| share-link rotate | 5 / hour / user |
| export-board | 5 / hour / user |

## Headers (web)

Set in `apps/web/middleware.ts`:

```
Content-Security-Policy: default-src 'self'; img-src 'self' https://*.supabase.co blob: data:; ...
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

(Capacitor mobile apps don't go through web HTTP headers; they use their own ATS / Network Security Config — to be set up in Phase 5.)

## Logging & PII

- Sentry: scrub email addresses + auth tokens via `beforeSend`.
- Supabase logs retained 7 days (Cloud Free) or 30 days (Pro) — fine for v1.
- Never log a card body. Bodies can contain anything.

### `profiles.email` (PII)

Migration `0006_profiles_email.sql` pins each signed-up user's email on
their `profiles` row so the invite flow can resolve an existing user
without paging `auth.admin.listUsers`. Treat this column as PII:

- **No public RLS read path.** `profiles` has a select policy that only
  exposes a row to its owner (`auth.uid() = id`). One user cannot read
  another user's email row.
- **Only consumer**: the `inviteCollaborator` server action in
  `apps/web/app/(app)/b/[id]/settings-actions.ts`, which uses the
  service-role `createAdmin()` client to look up
  `profiles.id where email = ?`. It returns only the `id`; the email
  itself never crosses back to the browser.
- **Population path**: the `on_auth_user_created` and
  `on_auth_user_email_updated` triggers (both `security definer`,
  `set search_path = public, auth`) write the column. No client- or
  server-action code ever writes `profiles.email` directly.
- **If you add another reader**, document it here and ensure it
  remains server-side + service-role. Do not surface email on any
  client-rendered page or in any anon-key query.

## Dependencies

- `pnpm audit --prod` runs in CI; high-severity advisories fail the build.
- Renovate (or Dependabot) bumps deps weekly; security fixes are auto-merged after green CI.

## Threat model (v1, abbreviated)

| Threat | Mitigation |
|---|---|
| Unauthorized board access | RLS + signed share tokens |
| XSS via card markdown | Tiptap output sanitized; render through DOMPurify before insertion |
| SSRF via image upload by URL | We only accept user-uploaded blobs, not URL fetches. (If added later, allow-list domains.) |
| Brute-force magic link | Rate limit (above) + Supabase's built-in one-time token |
| Stolen session token | HTTP-only, SameSite=Lax, short-lived refresh; sign-out revokes refresh |
| Hostile collaborator | Roles limit damage; audit_events captures who did what |
| Mass scraping via share link | Rotate token; rate-limit anonymous reads per token+IP |

## Reporting issues

`SECURITY.md` (root, future) will instruct external researchers to email
`security@<domain>` for disclosure. Internal: open an issue with the `security`
label, restricted visibility.
