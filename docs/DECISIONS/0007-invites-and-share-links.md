# 0007. Invites + share links + per-cell virtualization

- **Date**: 2026-05-12
- **Status**: accepted

## Context

The Phase 4 "Realtime + sharing" surface needs four more pieces stacked on
top of the per-board channel + presence avatars (ADR 0006):

1. **Invite a collaborator by email** — the inviter is authed as the board
   owner, but the recipient may not have a Supabase account yet. That
   crosses an RLS boundary: we need the `auth.admin.inviteUserByEmail`
   call which is service-role only.
2. **Public read-only share links** — anonymous (no JWT) clients need to
   read a board scoped by a header-borne token. The existing
   `boards_read` RLS policy already accepts `x-share-token`; the child
   tables didn't.
3. **"X is editing" hint** — the card modal lives in a different React
   subtree from the board header (parallel route), so the presence
   channel owned by `PresenceAvatars` and the consumer in the modal
   couldn't talk through props.
4. **Per-cell virtualization** — large cells (>50 cards) need to stop
   mounting every card to keep dnd-kit responsive.

## Decisions

### Invites: service-role only inside a single server action

`apps/web/app/(app)/b/[id]/settings-actions.ts` defines
`inviteCollaborator`. The action checks
`owner_id = auth.uid()` (or `role='admin'` collaborator) against the
user-scoped client, then constructs a service-role client from
`apps/web/lib/supabase/admin.ts`. Flow:

1. `admin.auth.admin.listUsers({ page: 1, perPage: 200 })` to find an
   existing user.
2. If absent, `admin.auth.admin.inviteUserByEmail(email, { redirectTo })`.
3. `admin.from('board_collaborators').upsert(...)` so the action also
   works when re-inviting an existing collaborator with a new role.

The service-role client lives in a single helper that is `import
'server-only'` to keep it out of any client bundle. `listUsers` is
naive (single page); we'll switch to a directory or to a server-stored
email if KPU ever has a tenant large enough to need it.

### Share links: extend RLS to child tables + RPCs that rotate/revoke

Migration `0005_share_links.sql`:

- Adds `has_share_access(b uuid)` as a `security definer` helper that
  reads `request.headers->>'x-share-token'` and matches against
  `boards.share_token` for `visibility = 'link'` boards.
- Extends `rows_read`, `columns_read`, `cards_read`, `labels_read`,
  `card_labels_read`, `images_read` with `OR has_share_access(...)`.
- `rotate_share_token(board_id)` and `revoke_share_token(board_id)` —
  `security definer` RPCs that re-check ownership before mutating.
  They're exposed to `authenticated` only, so anonymous clients can
  read with a token but only the board owner can change it.

The viewer route is `apps/web/app/s/[id]/page.tsx`. It uses a fresh
`@supabase/supabase-js` `createClient` with
`global: { headers: { 'x-share-token': t } }` and `auth.persistSession:
false`, so the request is genuinely anonymous (no cookies attached) and
the header is the only authorization signal. We deliberately avoided
re-using `@supabase/ssr` here because that client is wired to read auth
cookies, which we don't want to leak into a share-link request.

Middleware (`apps/web/lib/supabase/middleware.ts`) treats `/s/*` as
public so anonymous visitors don't get redirected to `/sign-in`.

### "X is editing" hint: presence-bus module-level singleton

`apps/web/app/(app)/b/[id]/presence-bus.ts` is a tiny pub/sub used by
two unrelated client subtrees:

- `PresenceAvatars` publishes the merged peer list (including each
  peer's `viewingCardId`) and listens for local-viewing-card changes so
  it can re-`track()` over the Realtime channel.
- `CardEditorModal` reports its own `viewingCardId` on mount/unmount,
  and `PeerEditingBanner` subscribes to peers and renders a small inline
  hint when at least one other peer has the same card open.

A module-level singleton is simpler than threading a React context
through the parallel-route boundary, and the presence channel itself
already debounces — there's no flicker risk from re-tracking on every
open/close.

Multiple tabs from the same user still collapse to one avatar in
`PresenceAvatars`, but the avatar component now picks the tab with the
most recent `online_at` so `viewingCardId` reflects the latest tab's
state (rather than whichever tab happened to land first in the
presence sync map).

### Per-cell virtualization: threshold-gated, fallback to cell-level drop

`VirtualCardList` (inside `board-view.tsx`) wraps cards in a
`useVirtualizer` from `@tanstack/react-virtual` when a cell has more
than 50 cards. Below the threshold we render every card so dnd-kit can
treat any card as a precise drop target. Above the threshold:

- Off-screen cards aren't mounted, so they lose their individual
  card-level droppable. The cell-as-a-whole droppable still works
  (drop appends to the end).
- Estimated row height = 80px with `overscan: 6`. The container is
  scrollable at a fixed viewport of 600px so the cell stays bounded.

This is the simplest version that earns the perf win. If users start
asking for precise drop-into-position on giant cells, the next step is
a sentinel droppable per virtual slot — but that's premature today.

## Alternatives considered

- **Magic link in a single email instead of a service-role invite** —
  Supabase's `signInWithOtp` would work for an existing user but
  doesn't help us land them on the right board. The admin invite path
  also auto-provisions the profile via the existing
  `on_auth_user_created` trigger.
- **Storing share tokens as JWTs** — would let us encode scope (e.g.
  expiry) without a DB column, but rotating + revoking is much harder.
  An opaque hex token keyed on `boards.share_token` is the v1.
- **Threading a context through `@modal` and the board header** — Next
  parallel routes don't share a single component tree at render time;
  any context would have to live in the shared `layout.tsx`. The bus
  module is just as small and decouples consumers from producers.
- **Virtualizing every cell** — adds layout-thrash for the common case
  of <10 cards per cell. Threshold-gating keeps the easy path identical
  to before.

## Consequences

- `SUPABASE_SERVICE_ROLE_KEY` is now required in any environment that
  wants the invite flow to work. The build succeeds without it; the
  server action returns a clear error at call time. Local dev with
  inbucket-only SMTP exercises the path end-to-end.
- Anyone with the share URL can read the board. Rotating the token
  invalidates older links; the UI exposes both rotate and revoke. We
  do not yet rate-limit token validation — Supabase's policy
  evaluation runs on every request, and the token check is a cheap
  string compare against the indexed `share_token` column.
- The presence payload schema is now
  `{ id, displayName, accentColor, online_at, viewing_card_id }`.
  Older tabs running the previous build will simply omit
  `viewing_card_id`; the consumer treats missing as `null`, so it's
  forward-compatible.
- `/b/[id]` First Load JS grew ~8 kB (191 kB total) from the
  virtualizer + settings popover. The shared `/s/[id]` route is
  106 kB (no dnd, no realtime, no Tiptap).
