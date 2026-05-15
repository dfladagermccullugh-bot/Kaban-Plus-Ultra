# 0024. Server-built Supabase storage URLs must be rewritten to the public origin

- **Date**: 2026-05-15
- **Status**: accepted

## Context

ADR 0022 #6 found that server-side Supabase clients in a bundled self-host
deploy must call the in-network gateway, not the browser's public hostname.
ADR 0023 §2 fixed that with `getServerSupabaseUrl()` (prefers
`SUPABASE_INTERNAL_URL=http://kong:8000`) and explicitly enumerated the four
server call sites it routed through it: `admin.ts`, `server.ts`,
`lib/supabase/middleware.ts`, and `app/s/[id]/page.tsx`.

A re-audit of that commit found ADR 0023 §2's enumeration was about the
Supabase **client base origin** for *API hops*. It did not consider that the
storage-js helpers `getPublicUrl()` and `createSignedUrl()` **string-concatenate
that same client origin** to produce a URL and never make their own network
call. So pointing the server/admin client at the internal origin (correct for
API hops) silently made every server-built storage URL start with
`http://kong:8000` — an origin no browser can resolve.

Two real, browser-facing call sites were affected, both only in a bundled
self-host deploy:

1. `app/setup/actions.ts` — the first-run wizard uploads the owner's avatar
   with the admin client, then persists `getPublicUrl().publicUrl` into
   `profiles.avatar_url`. That string is rendered as an `<img src>` across the
   app → broken avatar on every self-host deploy where the owner uploads one.
2. `app/(app)/b/[id]/actions.ts:getSignedImageUrl` — uses the cookie-aware
   server client, returns `createSignedUrl().signedUrl` to the client
   components `cover-image.tsx` and `card-editor-modal.tsx` → broken card /
   cover images.

The hosted-Supabase and local-dev paths were unaffected (`SUPABASE_INTERNAL_URL`
is unset there, so the client origin already equals the public origin).

## Decision

The API hop stays internal (fast, on-network, no public DNS). Only the URL
*handed to the browser* is rewritten, at the point it leaves the server, with a
single helper `toPublicStorageUrl()` in `lib/env.ts`:

- No-op when `SUPABASE_INTERNAL_URL` is unset (hosted / local dev) or when the
  URL is not on the internal origin (defensive — already public).
- Otherwise swap the internal-origin prefix for `getSupabaseUrl()` (the public
  `NEXT_PUBLIC_SUPABASE_URL`), tolerating a trailing slash on either env value.

Applied at exactly the two browser-facing call sites above. `browser.ts` is
untouched — it already builds URLs from the public origin.

### Why a rewrite helper, not "build storage URLs from a public client"

A second Supabase client instance pinned to the public origin would also work,
but it would (a) double the client surface server-side, (b) re-introduce the
"which client am I holding" footgun ADR 0023 §2 collapsed into one helper, and
(c) still hit storage-js's concatenation behaviour for `createSignedUrl`, whose
*signing request* must go over the internal network anyway. A pure string
rewrite at the boundary keeps the API hop internal and touches the URL only
where it's about to be serialised to the browser. Same shape as ADR 0023 §2:
one helper, one place the server-vs-browser origin decision is made.

### Regression guard layering

- **Per-push**: `apps/web/tests/public-storage-url.test.ts` unit-tests the
  helper (no-op, rewrite, signed-URL query preservation, already-public,
  trailing slash). Fast, deterministic, on every push.
- **Heavy proxy**: `deploy-smoke.yml` stays the full-stack E2E (ADR 0023 §5);
  its PR paths filter now also fires on `apps/web/app/setup/**` — the literal
  `/setup` surface it probes, previously uncovered by the filter.

## Consequences

- New rule for contributors: any storage URL produced by a server-side
  Supabase client (`getPublicUrl`, `createSignedUrl`) and sent to the browser
  must pass through `toPublicStorageUrl()`. `lib/env.ts` is now the single
  place both the server-vs-browser API origin (`getServerSupabaseUrl`) and the
  storage-URL origin (`toPublicStorageUrl`) are decided.
- No schema, security-model, or hosted-environment change; the helper is inert
  outside a bundled deploy.
- This was a latent bug *introduced by the ADR-0022 fix itself* — recorded so
  the next reader sees the storage path as a distinct concern from the API hop,
  not folded into ADR 0023 §2's four-call-site list.
