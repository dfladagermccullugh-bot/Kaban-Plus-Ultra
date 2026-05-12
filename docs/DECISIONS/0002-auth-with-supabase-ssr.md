# 0002. Auth via @supabase/ssr with cookie-based sessions

- **Date**: 2026-05-12
- **Status**: accepted

## Context

Phase 1 needs sign-in working across:
- Server Components (read user for SSR data fetching)
- Client Components (initiate magic link / OAuth)
- Middleware (refresh session, gate protected routes)
- Route Handlers (callback, sign-out)

The Supabase JS SDK alone doesn't manage cookies in the Next.js App Router. The
options are:
1. `@supabase/ssr` — the official Supabase package built for this exact case
2. Hand-rolled cookie wiring on top of `@supabase/supabase-js`
3. Auth.js (NextAuth) with a Supabase adapter

## Decision

Use **`@supabase/ssr`** with three thin client factories under
`apps/web/lib/supabase/`:

- `browser.ts` — `createBrowserClient` for Client Components
- `server.ts` — `createServerClient` for Server Components, Route Handlers, and Server Actions, wired to Next's `cookies()` helper
- `middleware.ts` — `createServerClient` wired to `NextRequest`/`NextResponse` cookies for session refresh

A single `middleware.ts` at the app root runs `updateSession()` on every request:
1. Refreshes the session cookie if it expired.
2. Checks `supabase.auth.getUser()`.
3. If unauthed and the path isn't in `PUBLIC_PATHS` (`/`, `/sign-in`, `/auth/callback`, `/sign-out`), redirects to `/sign-in?next={pathname}`.

A `lib/auth.ts` helper (`getCurrentUser()`) wraps the server client + profile
lookup. It returns `null` if signed-out **or** if Supabase env isn't configured
locally — so pages render gracefully during scaffolding.

## Alternatives considered

- **Hand-rolled cookie wiring**: more code to maintain; would re-invent
  `@supabase/ssr`. No upside.
- **Auth.js (NextAuth)**: more flexibility for third-party providers, but adds
  a second source of truth for sessions. RLS depends on Supabase JWTs; using
  Auth.js means sync-ing two systems. Skip.

## Consequences

- **Easier**: one auth library, official from Supabase, idiomatic with App Router.
- **Easier**: middleware gates everything by default; opt-in to public via `PUBLIC_PATHS`.
- **To watch**: `@supabase/ssr` is at 0.x; breaking changes possible. Pin to a known-good version (`0.5.2`).
- **To watch**: `middleware.ts` runs on every matched request; keep it cheap. The current implementation does one `auth.getUser()` call per request, which is the documented pattern.

## Notes on the env-missing graceful path

Local scaffolding sessions may not have a real Supabase project yet. The
middleware checks `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`
and short-circuits to a pass-through if either is empty. `getCurrentUser()`
catches and returns `null`. This is dev-only graceful degradation; in
production both env vars must be set or auth simply won't work — which is the
correct failure mode.
