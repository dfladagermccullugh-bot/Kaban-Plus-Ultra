# Principles

These are the rules every decision is checked against. Each is phrased so
you can answer "does this design obey it?" with yes or no. If a proposed
design can't be defended against the Prime Directive in one sentence, it
is wrong.

## Prime Directive

**Radical operational simplicity is the product.**

A non-technical user stands up their own working instance in effectively
one step. A developer runs and fully tests the entire critical path
locally and in CI with no exotic infrastructure and no human in the loop.
Any feature, dependency, service, container, or env var that cannot meet
this bar does not ship in v1. **When in doubt, subtract.**

## Rules (testable)

1. **One-step user deploy.** A non-technical user gets a working instance
   with one command (or one hosted sign-up). No multi-service
   orchestration is ever exposed to them. The supported runtime/OS
   matrix is documented; code is not contorted to support every shell.

2. **One-command dev run, identical in CI.** One command brings the
   *entire* system up locally. The *same* path runs headless in CI on
   every push. No operator-only, agent-untestable surface may exist.

3. **Single source of truth for the public base URL.** The browser, the
   app server, and anything that emits a link agree on one
   externally-correct origin **by construction** — because there is only
   one process the browser talks to. No string is rewritten at N call
   sites. If the design needs an origin-rewrite helper, the design is
   wrong — go back.

4. **Minimal dependency surface.** Every service / container / process /
   env var is justified in `ARCHITECTURE.md` against the Prime Directive,
   with the heavier alternative recorded as rejected. Default to the
   smallest thing that delivers the core: one app process + one embedded
   database; first-party auth; no gateway.

5. **Self-host == hosted.** Same code path, differing only by config.
   Never a fork.

6. **One thin critical-path E2E — and almost nothing else during MVP.**
   Exactly one smoke-level end-to-end test of the critical path is
   mandatory and runs green headless in CI from Milestone 0. That is the
   floor *and* the ceiling. Forbidden during MVP: unit-test
   proliferation, coverage targets/gates, snapshot sprawl, testing
   library/framework internals, tests for off-critical-path code. A test
   earns its place only by catching a failure class that already burned
   us or would break the critical path.

7. **Scope discipline.** v1 is the friend-group **web** app only.
   Everything in `VISION.md` Non-Goals stays parked and cannot creep.

8. **Decision economy.** ADRs are for genuinely structural,
   hard-to-reverse choices only. No ADR-per-bugfix. A bug fix is a
   commit, not a decision record.

9. **Subtraction bias in review.** Every doc and milestone is reviewed
   with: "What can we remove and still deliver the friend-group Kanban?"

10. **MVP minimalism — actively resist over-engineering.** Build the
    simplest thing that delivers the milestone and nothing more. No
    speculative abstractions, no "might need it later" layers, no config
    knobs without a present user, no premature generalization, no
    gold-plating. Three similar lines beat one clever abstraction. A bug
    fix is a fix, not a refactor. Elegant-but-large is wrong for an MVP.

11. **Lean backend, responsive frontend.** Backend stays small and cheap
    by default (few moving parts, simple queries; don't optimize
    speculatively, don't architect in bloat). Frontend stays smooth and
    responsive (instant-feeling interactions, calm spring motion, no
    jank). Both are served by the same answer: fewer parts.
