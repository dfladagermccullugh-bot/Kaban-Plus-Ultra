# Kaban Plus Ultra v1.0 — Release Notes (draft)

**Status:** draft. Edit before tagging `v1.0.0`. Pending: final hosted URL,
TestFlight + Play track URLs, signed-off privacy-policy URL.

Two friends were tired of Trello — chaotic visual hierarchy, no real
swimlanes, aggressive upsells, no good "Trello at home" alternative.
Kaban Plus Ultra is the version they wanted: a 2D board (rows × columns,
no separator-card hacks), Markdown cards with image support, real-time
collaboration, one Markdown ZIP export that round-trips back in, and a
self-host bundle you can spin up with one command.

---

## Highlights

- **Real swimlanes.** Every board is a true 2D grid: rows and columns,
  not stacked lists.
- **Drag-drop everything.** Cards, rows, columns. Fractional indexing
  under the hood means we never renumber, never thrash, never collide
  under concurrent edits.
- **Markdown cards with images.** Tiptap editor; paste or drag an image
  and we upload, strip EXIF, blurhash-placeholder, and serve via signed
  URL. Card body is canonical Markdown — exports round-trip.
- **Real-time, presence, and "X is editing" hints.** Subscribe per
  board; other clients' cursors and active cards surface inline.
- **Invite + roles + share links.** Invite by email (magic link), assign
  viewer / editor / admin, generate rotatable read-only public share
  links.
- **Own your data.** Export any board to a `.zip` of Markdown files (one
  folder per row, one file per card, YAML frontmatter). Drag the same
  `.zip` back in to import or merge.
- **Native on iOS + Android.** One TypeScript codebase ships to web,
  iOS, and Android via Capacitor. Touch-tuned drag with haptics; native
  camera capture for card images; pull-to-refresh on the boards list.
- **Self-host in one command.** `curl … | sh` spins up the full stack
  (Caddy + Next.js + upstream Supabase) on a Linux VPS, including DNS
  pre-flight, JWT signing, first-boot migrations, and a first-run admin
  wizard.

## What's new since the open-source kickoff

This is the first stable cut, so &mdash; *everything*. Notable since the
Phase 6 polish series:

- ARM64 multi-arch container image (Raspberry Pi 4 / 5 self-host).
- Healthchecked Postgres backup side-car: gzipped `pg_dumpall`, freshness
  check, retention rotation.
- First-run admin wizard at `/setup` (gated by `SETUP_TOKEN`) so
  self-hosters can claim the workspace owner without configuring SMTP
  on day one.
- axe-core a11y assertions in CI.
- Mobile bottom-sheet card editor on coarse pointers; drag-to-dismiss
  from the sticky handle.

## Compatibility

- **Web:** evergreen Chromium, Firefox, Safari (current and one back).
- **iOS:** 16.0+.
- **Android:** 8.0+ (API 26).
- **Self-host:** Linux x86_64 or ARM64, Docker 24+, Docker Compose v2.20+.

## Known limitations / out of scope for v1

These are intentionally deferred to v2; see `docs/ROADMAP.md` →
"v2 candidates":

- Due dates, checklists, comments, mentions.
- Activity feed UI (audit events exist in the DB; no UI surface yet).
- True offline editing with CRDTs.
- Teams / workspaces / billing.
- Calendar / timeline / Gantt views.
- AI features.

## Upgrade & install

- **Hosted:** sign in at the canonical KPU URL. No action required.
- **Self-host:** `curl -fsSL …/install-kaban.sh | KABAN_HOST=… sh`. See
  `docs/SELF_HOSTING.md` for the full walkthrough, including ARM64 and
  backups.
- **Migrations:** the installer applies `supabase/migrations/0001-0006`
  on first boot. Re-running the installer is a safe upgrade path.

## Acknowledgements

Open source: Next.js, Supabase, Tiptap, Framer Motion, dnd-kit,
TanStack Query, Capacitor, shadcn/ui, Lucide, jszip, and the
`@anthropic-ai/claude` / OpenAI Codex / Google Gemini agent stacks that
co-authored a lot of this codebase under human review.

## Privacy & security

- HTTPS everywhere; Caddy auto-HTTPS in the self-host bundle.
- All authorization is enforced by Postgres Row-Level Security.
- Service-role keys never leave the server.
- Privacy policy at <PRIVACY_URL>. Security disclosures to
  <security@kabanplusultra.app>.

## Pre-tag checklist (for the human)

- [ ] Replace `<PRIVACY_URL>` with the hosted URL pointed at
      `/legal/privacy`.
- [ ] Fill the App Store / Play Store listing copy (description,
      keywords, screenshots — six per device class).
- [ ] Cut signed TestFlight + Play Internal builds via
      `scripts/release-ios.sh` / `scripts/release-android.sh`.
- [ ] Smoke-test the install one-liner on a fresh Linux VPS.
- [ ] Verify Lighthouse a11y ≥ 95 / perf ≥ 90 on `/`, `/sign-in`,
      `/setup`, `/boards`, `/b/[id]`, `/s/[id]`.
- [ ] Tag `v1.0.0` and push.
