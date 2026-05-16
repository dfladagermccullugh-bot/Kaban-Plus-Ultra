# Testing

v1's meta-failure was a broken feedback loop, not too few tests. The
countermeasure is **one** end-to-end test that runs headless in CI from
Milestone 0 — not a growing suite.

## The one critical-path E2E (mandatory)

A single Playwright test, headless, no human, green in CI on every push.
It walks the whole product spine against a real freshly-deployed
instance:

1. **Fresh deploy** — start the app exactly as a user would; a clean
   SQLite file, no users.
2. **Claim** — first user sets admin name + password; lands logged in.
3. **Create a board.**
4. **Add a swimlane (row) and a column.**
5. **Create a card** in the (row, column) cell.
6. **Move the card** to a different cell; it stays there after reload.
7. **Generate an invite link.**
8. **Second user** opens the invite, sets name + password, signs in,
   and **sees the board** (and the moved card).

If this is green, the product's spine works. If it's red, nothing ships.
It is the floor *and* the ceiling of MVP testing.

## Anti-goals (explicit — do not do these during MVP)

- ❌ Coverage targets or coverage gates.
- ❌ A unit-test mandate; unit tests for off-critical-path code.
- ❌ Snapshot-test sprawl.
- ❌ Testing library/framework internals (don't test that Next.js,
  SQLite, the DnD lib, or the markdown renderer work).
- ❌ Adding tests "to be safe." More tests are drag, not safety, here.

## When a new test is allowed

Only if it cites one of:

1. **It defends the critical path** (it would catch a regression in the
   eight steps above), or
2. **It pins a failure class that already burned us** (a real bug we
   shipped, written down so it can't return).

No other justification qualifies during MVP. Add targeted tests *after*
v1, only where pain is real.

## What CI runs

`typecheck`, lint, and **this one E2E**, on every push, against the app
started the same way a user starts it. Nothing more is required to call
the pipeline green.
