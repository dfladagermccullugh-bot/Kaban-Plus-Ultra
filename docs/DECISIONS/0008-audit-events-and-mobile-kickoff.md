# 0008. Audit-events writer, profile email pinning, and mobile-shell kickoff

- **Date**: 2026-05-13
- **Status**: accepted

## Context

The follow-up items left over from ADR 0007:

1. The `audit_events` table has lived in migration 0001 since day one,
   but no server code writes to it. RLS gates reads to viewer+ of the
   board; there is intentionally no public INSERT policy.
2. `inviteCollaborator` looked up existing users with a single-page
   `auth.admin.listUsers({ perPage: 200 })` — fine for self-hosted KPU,
   broken for anyone with more than 200 accounts.
3. Phase 5 ("mobile shell") needed a starting point: a `apps/mobile/`
   workspace package with `capacitor.config.ts`, drag haptics in the
   board view, and pull-to-refresh on `/boards`. The generated `ios/`
   and `android/` Xcode + Android Studio projects are deferred — they
   require platform tooling that the harness doesn't have.

## Decisions

### Audit writer: single helper, service-role, fire-and-forget on failure

`apps/web/lib/audit.ts` exports `recordAuditEvent(boardId, actorId,
kind, payload)`. It uses the same `createAdmin()` factory as the invite
flow and logs (but swallows) write failures so an audit hiccup never
breaks the user-facing action. The `AuditKind` union pins the five
kinds we currently emit:

- `collaborator.invite` — payload: `{ target_profile_id, target_email,
  role, new_user }`
- `collaborator.role_update` — payload: `{ target_profile_id, role }`
- `collaborator.remove` — payload: `{ target_profile_id }`
- `share_link.rotate` / `share_link.revoke` — empty payload (the
  board id + actor id are already columns).

`apps/web/app/(app)/b/[id]/settings-actions.ts` calls the helper after
each successful mutation, before `revalidatePath`. `assertBoardAdmin`
now returns the actor's user id so the helper can be called without a
second `auth.getUser()` round-trip; share-token actions still hit
`authedClient()` directly because they don't gate on admin role
(ownership is checked inside the RPC).

### Profile email: pinned by the signup trigger

Migration `0006_profiles_email.sql`:

- Adds `profiles.email text` (nullable — some provider-only signups
  legitimately don't carry one).
- Backfills from `auth.users` for any pre-existing rows.
- Adds a partial unique index `where email is not null`.
- Rewrites `on_auth_user_created` to populate the column on signup.
- Adds `on_auth_user_email_updated` (trigger on `auth.users` email
  changes) so verified email changes propagate to `profiles`.

`inviteCollaborator` now queries `admin.from('profiles').select('id').
eq('email', trimmedEmail).maybeSingle()` instead of paginating
`listUsers`. Falls through to `inviteUserByEmail` for new addresses.
The lookup uses the service-role client because no public RLS policy
exposes `profiles.email` to other users.

### Mobile shell: workspace package without generated native projects

`apps/mobile/` is a new pnpm workspace package:

- `package.json` declares Capacitor 6 deps (`@capacitor/core`,
  `@capacitor/cli`, `@capacitor/ios`, `@capacitor/android`,
  `@capacitor/haptics`).
- `capacitor.config.ts` ships with `webDir: 'public'` (placeholder for
  `cap sync`) and an opt-in `server.url` driven by `KPU_DEV_SERVER` so
  a developer can point the native shell at `pnpm dev` on their LAN
  without rebuilding.
- The `ios/` and `android/` folders are deferred to the first run on a
  machine with Xcode / Android Studio (`npx cap add ios|android`).
  Once generated, they should be committed.

### Haptics: single helper used from `apps/web`

`apps/web/lib/haptics.ts` wraps `@capacitor/haptics` `Haptics.impact`
with a `prefers-reduced-motion` short-circuit and a `navigator.vibrate`
fallback when the Capacitor web shim throws. Imported by
`board-view.tsx` on drag start (`light`) and successful drop
(`medium`). Same module is used by `pull-to-refresh.tsx` for the
threshold-cross + release pulses.

### Pull-to-refresh: web-only, touch-only, `router.refresh()`

`apps/web/app/(app)/boards/pull-to-refresh.tsx` wraps the boards page.
- Active only when `window.matchMedia('(pointer: coarse)').matches` —
  mouse-first surfaces never see the gesture.
- Rubber-bands the pull at 0.55 × deltaY; threshold = 72 px; max
  pull = 120 px.
- On release past the threshold, calls `router.refresh()` and pins
  the spinner for 350 ms so a fast Next refresh doesn't strobe.
- Uses touch event listeners on `window` so the listing under the
  fixed spinner can still scroll normally.

## Alternatives considered

- **Database trigger writing audit rows instead of a server-side
  helper** — simpler in theory, but invite events are mediated by the
  Auth admin API and live outside the public schema, so triggers
  alone can't see them. A single helper keeps the policy in one
  place.
- **Storing email in a sidecar `auth_emails` table mirrored from
  `auth.users`** — adds a second sync surface for no benefit. The
  trigger writes both `profiles.id` and `profiles.email` in one shot.
- **Pull-to-refresh via the iOS scroll-bounce instead of touch
  events** — the boards page mounts a Next `<main>` that doesn't
  scroll the document overflow, and intercepting the inner scroll
  container's bounce would only work in WebKit. A manual touch
  handler is cross-browser and cross-platform.
- **Lazy-loading `@capacitor/haptics`** — its web shim is ~1 kB and
  the import sits inside an already-large client bundle for the
  board view. Saving the kilobyte isn't worth the dynamic-import
  ergonomics.

## Consequences

- `audit_events` finally fills with rows as collaborators are
  managed. RLS already lets viewer+ read them, so an activity-feed UI
  on the board is now a pure UI task (v2 candidate).
- `profiles.email` is now PII, queryable by the service-role client.
  Front-end code never reads it; the only consumer is the invite
  lookup. Documented in `docs/SECURITY.md` (next entry on the
  follow-up list).
- `apps/mobile/` is a workspace package; `pnpm typecheck` includes it
  but `pnpm build` does not (it has no `build` script). Native
  projects are deferred — anyone running `cap run ios|android` from
  the CLI must first add them on a dev machine.
- `/b/[id]` First Load JS grew ~4 kB (195 kB total) for the haptics
  shim; `/boards` grew ~4 kB (122 kB) for the pull-to-refresh
  component.
