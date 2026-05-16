# Data Model

One instance = one trusted group. There is no tenant/org/workspace
concept. Every authenticated user is a member of *this* instance and sees
*all* boards on it. This is a deliberate v1 simplification (see Access
below); it is what makes the model small.

## Entities

**user**
- `id` — primary key
- `display_name`
- `password_hash` — argon2/bcrypt
- `role` — `admin` | `member`
- `created_at`

**board**
- `id`
- `title`
- `description` (nullable)
- `created_at`

**row** (a swimlane — a horizontal lane spanning the board)
- `id`
- `board_id` → board
- `title`
- `color` — a token name (see Design tokens), not a hex literal
- `position` — fractional index (string key)
- `collapsed` — boolean
- `created_at`

**column** (a vertical lane)
- `id`
- `board_id` → board
- `title`
- `color` — token name
- `position` — fractional index (string key)
- `wip_limit` — integer, nullable
- `created_at`

**card**
- `id`
- `board_id` → board
- `row_id` → row
- `column_id` → column
- `title`
- `body_md` — **canonical** card content (Markdown text). Rendered HTML
  is always derived, never stored.
- `position` — fractional index within its (row, column) cell
- `created_by` → user
- `created_at`, `updated_at`

**invite**
- `id`
- `token` — long, random, URL-safe, single-use
- `role` — role granted on acceptance (`member`; `admin` only if an
  admin chooses)
- `created_by` → user
- `used_by` → user (nullable until accepted)
- `created_at`

A card lives at exactly one **cell**: the intersection of one `row` and
one `column` on the same board. Deleting a board cascades to its rows,
columns, and cards; deleting a row or column cascades to its cards.

## Ordering — string-key fractional indexing

Rows (within a board), columns (within a board), and cards (within a
cell) are each ordered by a `position` that is a **string fractional
index** (use a known library such as `fractional-indexing`).

- To place an item, generate a key **between** its neighbours' keys
  (`null` for "no neighbour" at either end).
- Moving an item rewrites **only that item's** key.
- **Never renumber.** **Never** a rebalance job. String keys subdivide
  indefinitely without precision loss — that is the entire reason this
  scheme is chosen over float midpoints.

## Identity / claim / invite flow

- **Unclaimed instance:** no users exist. The first visitor is offered
  the **claim** screen: they set a display name + password and become
  the single `admin`. The instance is now claimed.
- **Invite:** an `admin` (or any member, if the instance allows it —
  default: admins) creates an `invite`, yielding a link
  `${APP_URL}/invite/<token>`. The recipient opens it, sets a display
  name + password, and becomes a `member`. The token is then spent.
- **Session:** successful claim/login sets a signed, httpOnly cookie.
  No email is sent or required anywhere.

## Access

v1 access is intentionally coarse and that is correct for one trusted
group:

- Any authenticated user (admin or member) can read and write all
  boards, rows, columns, and cards on the instance.
- `admin` additionally manages users and invites.
- Unauthenticated requests get nothing except the claim screen (if
  unclaimed) or the login screen.

Enforcement is a single server-side check ("is there a valid session?")
plus a role check for admin-only actions — applied in the app process,
since the app process is the only thing that touches the database. There
is no row-level database security layer, because there is no second
client of the database.

**Fenced as Later (not v1):** per-board membership, per-board roles
(viewer/editor/admin), public share links, multi-board access matrices.
These return only if a real need appears after the friend-group core is
proven.

## Design tokens (colors referenced by `color` fields)

`color` fields store a **token name**, never a literal. The token set:

- Accent presets: `indigo` (default), `blue`, `teal`, `green`, `lime`,
  `amber`, `rose`, `violet`.
- Semantic: `bg`, `bg-elevated`, `surface`, `border`, `text`,
  `text-muted`, `danger`, `success`.

The concrete OKLCH values, spacing scale (4px grid), the three radii, two
shadows, typography, and spring parameters live in the build's Tailwind
theme and are specified for the Build Agent in `GENESIS_PROMPT.md`.
Components reference tokens only — never raw hex/px.
