# Project Reboot — Planning Agent Directive

> **This file is the baton for a three-session relay.**
> Session 1 (authored this): the directive below.
> Session 2 (you, the **Planning Agent**): review this repo + docs, then
> produce a fresh, lean, self-contained doc set + a standalone kickoff prompt.
> Session 3 (the **Build Agent**): fresh, unconnected, *no memory of this
> repo*. It builds the new iteration using **only** the documents you write.
>
> Therefore: everything Session 3 needs must end up in your documents. If
> it isn't written down by you, it does not exist for the build.

---

## 0. Your role (Planning Agent) — read this twice

- You **do not write product code** this session. You write **documents**.
- Your deliverable is a clean-room specification: assume the Build Agent
  **cannot see this old repository, these ADRs, or this conversation.**
  No references to old file paths, old stack choices, or old code unless
  you re-derive and re-justify them from first principles.
- You **mine** this repo for durable truth (domain model, the product
  soul, and — critically — the failure record) and you **discard** the
  incidental implementation and the accreted complexity.
- You end the session by presenting `GENESIS_PROMPT.md` and a one-paragraph
  summary. You do **not** start building. You do **not** open a PR.

---

## 1. The Objective

Rebuild **Kanban Plus Ultra**: a calm, clean, self-hostable Kanban board
with **real swimlanes** (a true 2D grid, not Trello's flat lists), built
for **small groups of friends** to collaborate — no aggressive upsells, no
visual chaos, no enterprise bloat. One TypeScript codebase, web-first.

The *concept* is validated and loved. Mine `docs/VISION.md` for the soul
and restate it tightly. The product is not the problem. **How v1 was built
and shipped is the problem.**

---

## 2. The Prime Directive (non-negotiable, governs every decision)

**Radical operational simplicity is the product.**

- A non-technical user must stand up their own instance — or join a hosted
  one — in effectively **one step**, and have it **just work**.
- A developer must run **and fully test the entire critical path** locally
  and **in CI**, with **no exotic infrastructure** and **no human in the
  loop**.
- Any feature, dependency, service, container, or env var that cannot meet
  this bar **does not ship in v1**.
- This applies to *engineering effort* too: during MVP, resist
  over-engineering and test accretion as hard as feature creep. One thin
  critical-path test is mandatory; the rest is drag until pain proves
  otherwise. Lean backend, responsive frontend, minimal code.
- **When in doubt, subtract.**

Every document you write must be checkable against this directive. If a
proposed design can't be defended against it in one sentence, it's wrong.

---

## 3. What Went Wrong in v1 (the evidence base — design *against* these)

This is the most important section. v1's failure was not bad intent or bad
concept — it was unmanaged complexity and a broken feedback loop. Study the
old `docs/SESSION_LOG.md` and **ADRs 0022–0026** as the concentrated
failure record, then design the new docs so each of these *cannot recur*.

1. **Self-host stack obesity.** "Run a Kanban board with your friends"
   turned into orchestrating ~16 containers (a full upstream Supabase
   stack: Kong, Studio, GoTrue, PostgREST, Realtime, Storage, pg-meta,
   analytics, vector, imgproxy, pooler, edge-functions, plus a backup
   side-car, Caddy, and the app). A friend-group tool never needed most of
   that. The install one-liner accreted DNS pre-flight, containerised JWT
   signing, bind-mount guards, `.env` backfill logic, and workarounds for
   undocumented required upstream env vars (`PGRST_DB_SCHEMAS`,
   `MAILER_URLPATHS_*`).

2. **Origin / identity confusion as a recurring bug class.** The single
   largest source of defects. Too many components each had their own idea
   of "the URL": `NEXT_PUBLIC_SUPABASE_URL` vs `SUPABASE_INTERNAL_URL`
   (`localhost` vs `kong:8000`); storage URLs leaking the internal origin;
   GoTrue stamping `http://kong` into magic links; Next.js standalone
   reporting `request.url` as its internal bind (`0.0.0.0:3000`); Caddy
   not bridging the Supabase API paths. Each was patched individually
   (`toPublicStorageUrl` → `toPublicUrl` → origin-swap; a forwarded-host
   helper; new Caddy routes). **Root cause: an architecture where the
   browser, the app server, the reverse proxy, and the auth/storage
   services do not share one externally-correct base URL by construction.**

3. **Quick-fix accretion / ADR sprawl.** ADRs 0022–0026 are essentially
   "live test found X → patched X," each fix layered on the last, spanning
   the codebase. String-rewrite hacks on top of string-rewrite hacks. The
   decision log became a bug log.

4. **Broken feedback loop (the meta-failure).** The dev harness had no
   Docker, no browser. Every deployment/integration bug was discoverable
   **only** on the operator's Windows + Git Bash + Docker machine, one
   slow human round-trip at a time. The critical path was effectively
   **untestable by the agent**. This is why bugs shipped and compounded.

5. **Platform/tooling friction.** Windows + Git Bash + MSYS path mangling
   drove real code/installer contortions instead of a documented,
   supported runtime matrix.

6. **Premature breadth.** Capacitor iOS/Android, app-store submission,
   multi-arch images, backup side-cars, audit events, realtime presence,
   share links — pursued before the core single-deploy "me and three
   friends use a board" experience was solid and proven.

7. **Over-engineering & test accretion.** Helpers generalized for
   hypothetical futures, layered string-rewrite abstractions, and a
   growing pile of unit/regression tests written *around* the bug class
   instead of removing the bug class. Effort went into hardening the
   accidental complexity rather than deleting it. Cleverness and test
   count became proxies for safety; they were drag.

---

## 4. What to KEEP (extract the durable core, restate it clean)

Carry forward the *ideas*, not the code:

- **The soul** (from `VISION.md`): why it exists, who it's for, what we are
  explicitly NOT building.
- **The domain model**: boards, **real swimlanes (rows) × columns**, cards;
  membership/roles; invites. Re-derive cleanly in `DATA_MODEL.md`.
- **Fractional indexing** for every ordered list (rows, columns, cards) —
  never renumber. This was sound; keep it.
- **Markdown as the canonical card body**; everything else derived. Keep.
- **Calm motion**: spring-based interaction, always honor
  `prefers-reduced-motion`. Keep as a design rule.
- **Token-based design system** (no raw hex/spacing in components). Keep
  the discipline; restate the tokens.
- **Per-board access control** as an *intent* (a member only sees their
  boards). Keep the security goal; the *mechanism* is open for
  re-evaluation (Postgres RLS was powerful but coupled us to a heavy
  stack).
- **Docs-as-contract discipline** (session log + ADRs) — but **slimmer**,
  with a much higher bar for what earns an ADR.

You must produce a `LESSONS_FROM_V1.md` that preserves §3 so the Build
Agent understands *why* the constraints exist — constraints without
rationale get "optimized" away by a well-meaning future agent.

---

## 5. Hard Constraints & Standards for v2 (embed these as testable rules)

Write these into `PRINCIPLES.md` as checkable statements, and make every
other doc conform:

1. **One-step user deploy.** A non-technical user gets a working instance
   with one command or one hosted sign-up. No multi-service orchestration
   exposed to them. Document the exact supported runtime/OS matrix; do not
   contort code to support every shell.

2. **One-command dev run + identical CI.** `&lt;one command&gt;` brings the
   *entire* system up locally. The **same** path runs headless in CI on
   every push. **No operator-only, agent-untestable surface may exist.**

3. **Single source of truth for the public base URL.** The architecture
   must make the browser, app server, and any auth/storage agree on one
   externally-correct origin **by construction**, not by rewriting strings
   at N call sites. If the design needs an origin-rewrite helper, the
   design is wrong — go back.

4. **Minimal dependency surface.** Every service/container/process/env var
   must be justified in `ARCHITECTURE.md` against the Prime Directive, with
   the heavier alternative explicitly recorded as rejected. Default to the
   smallest thing that delivers the core (seriously evaluate: a single app
   process + one database; first-party or embedded auth; object/blob
   storage that needs no gateway; realtime only if it is genuinely cheap
   and testable).

5. **Self-host and hosted are the same code path** differing only by
   config — never a fork.

6. **One thin critical-path E2E — and almost nothing else during MVP.**
   The v1 meta-failure was a broken feedback loop, so **exactly one**
   smoke-level end-to-end test of the critical path (see §6 `TESTING.md`)
   is **mandatory** and must run green headless in CI from milestone 0.
   That is the floor *and* the ceiling for the MVP. **Explicitly forbidden
   during MVP:** unit-test proliferation, coverage targets/gates,
   snapshot-test sprawl, testing framework/library internals, or tests
   written for code that isn't on the critical path. A test earns its
   place only by catching a class of failure that already burned us or
   would break the critical path. More tests are not more safety here —
   they are drag. Add targeted tests *after* MVP, only where pain is real.

10. **MVP minimalism — actively resist over-engineering.** Build the
    simplest thing that delivers the milestone and nothing more. **No**
    speculative abstractions, **no** "we might need it later" layers, **no**
    config knobs without a present user, **no** premature generalization,
    **no** gold-plating. Three similar lines beat one clever abstraction.
    A bug fix is a fix, not a refactor. If a design feels elegant but
    large, it is probably wrong for an MVP — choose the boring small one.

11. **Performance posture: lean backend, responsive frontend.** The
    backend stays lean and cheap by default (small footprint, few moving
    parts, simple queries — do not optimize speculatively, but do not
    architect in bloat). The frontend must stay smooth and responsive
    (instant-feeling interactions, calm spring motion, no jank); that is a
    felt-quality requirement, not an invitation to a heavy client. Both
    are served by the same answer: fewer parts.

7. **Scope discipline.** v1 = the friend-group **web** app only. Native
   mobile, store submission, backups-as-a-feature, analytics, audit logs,
   presence — **explicitly Non-Goals for v1**, parked in a dedicated
   section so they can't creep.

8. **Decision economy.** ADRs are for genuinely structural,
   hard-to-reverse choices only. **No ADR-per-bugfix.** A bug fix is a
   commit, not a decision record.

9. **Subtraction bias in review.** Every doc and milestone is reviewed with
   the question: "What can we remove and still deliver the friend-group
   Kanban experience?"

---

## 6. Deliverables — the exact new document set to produce

Create these as a clean, self-contained set (recommended location:
`docs/v2/`). Each must stand alone for a reader who cannot see this repo.
Keep them **tight** — length is not thoroughness.

1. **`VISION.md`** — ≤1 page. The one-sentence product, who it's for, the
   feel, and an explicit, bulleted **Non-Goals** list.
2. **`PRINCIPLES.md`** — the Prime Directive (§2) + the standards (§5) as
   numbered, testable rules. This is the doc every future decision is
   checked against.
3. **`ARCHITECTURE.md`** — the chosen **minimal** stack, each component
   justified vs the Prime Directive, with rejected heavier alternatives
   listed. Must explicitly specify the **single-origin design** (constraint
   §5.3) and how self-host == hosted by config.
4. **`DATA_MODEL.md`** — boards, swimlanes (rows), columns, cards, members,
   roles, invites; fractional indexing scheme; the access-control model.
5. **`ROADMAP.md`** — v1 milestones only, each with a crisp **Definition of
   Done**. Milestone 0 must be "empty app boots + critical-path E2E green
   in CI." A clearly fenced **Later / Non-Goals** section.
6. **`DEPLOY.md`** — the one-step user install; the one-command dev run;
   the CI job that exercises the *same* path; the supported runtime/OS
   matrix. If a normal user can't follow it in one step, it's not done.
7. **`TESTING.md`** — defines the **one** critical-path E2E up front:
   *fresh deploy → first user signs up/claims → create a board → add a
   swimlane + column → create/move a card → invite a friend → friend signs
   in and sees the board*. It runs headless in CI with no human, and it is
   the floor *and* ceiling of MVP testing. The doc must **explicitly state
   the anti-goals**: no coverage targets, no unit-test mandates, no
   snapshot sprawl, no testing of library internals during MVP; new tests
   require a justification tied to the critical path or a burned failure
   class. Keep it short.
8. **`SESSION_PROTOCOL.md`** — slim start/end checklist; the (high) ADR
   bar; branch/commit conventions; "push at end of session because the
   environment is ephemeral."
9. **`LESSONS_FROM_V1.md`** — §3 preserved and sharpened, each lesson
   paired with the v2 rule that prevents it.
10. **`GENESIS_PROMPT.md`** — the **self-contained kickoff prompt** for
    Session 3. It must (a) state the objective + prime directive, (b) point
    the Build Agent at docs 1–9, (c) define Milestone 0 and the order of
    work, (d) forbid scope creep, and (e) be runnable with **zero** outside
    context. This is the single most important artifact you produce.

---

## 7. Method for the review (how to spend the session)

1. Read the old guiding docs: `docs/VISION.md`, `ARCHITECTURE.md`,
   `DATA_MODEL.md`, `DESIGN_SYSTEM.md`, `SECURITY.md`, `ROADMAP.md`,
   `SESSION_PROTOCOL.md`, and skim **all** ADRs `0001`–`0026`.
2. Read `docs/SESSION_LOG.md` end-to-end, with **close attention to the
   last several entries and ADRs 0022–0026** — that is the concentrated
   record of the deployment/origin failure class.
3. Skim the code map (`apps/`, `packages/`) only to extract the **durable
   domain logic** (board model, fractional indexing, markdown serdes,
   design tokens). Do not catalogue implementation detail.
4. For every stack choice v1 made, ask: *does this survive the Prime
   Directive?* Keep only what does; record the rest as rejected
   alternatives with the reason.
5. Write the doc set as if the implementer has never seen this repo.
6. Sanity-check: could a competent agent, given **only** `GENESIS_PROMPT.md`
   + the doc set, build the friend-group Kanban app without ever needing
   this repo or a human? If not, the docs are incomplete.

---

## 8. Anti-patterns (do not reproduce v1's mistakes in the new docs)

- ❌ Designing a multi-service stack "because it's the standard way."
  ✅ Justify the **smallest** stack that ships the core.
- ❌ Any design requiring origin/URL rewriting at multiple call sites.
  ✅ One externally-correct base URL, true by construction.
- ❌ An "operator runs it on their machine" step the agent/CI can't run.
  ✅ The critical path is CI-verifiable headless from day one.
- ❌ ADRs as a bug log; speculative future-proofing; backwards-compat
  shims. ✅ Decision economy; build only what the milestone needs.
- ❌ Mobile/native/store/analytics/backup features in v1.
  ✅ Friend-group web app first, proven, then nothing until that's solid.
- ❌ A growing test suite as a proxy for safety; coverage gates; unit
  tests for off-critical-path or framework code during MVP.
  ✅ Exactly one critical-path E2E; more tests only where pain is real.
- ❌ Clever/elegant-but-large abstractions; generalizing a helper for a
  caller that doesn't exist yet; refactoring under cover of a bug fix.
  ✅ The boring small implementation that ships the milestone.
- ❌ Long, padded documents. ✅ Tight, scannable, testable.

---

## 9. Definition of Done for the Planning Agent (this next session)

- Docs 1–10 from §6 exist under `docs/v2/`, internally consistent, each
  defensible against the Prime Directive in one sentence.
- `GENESIS_PROMPT.md` is standalone and complete.
- A one-paragraph summary delivered to the user; **no code written, no PR
  opened**; work committed and pushed (environment is ephemeral).
- If any product question is genuinely ambiguous (e.g., hosted-vs-self-host
  default, the auth mechanism, the realtime decision), the Planning Agent
  surfaces it to the user as an explicit question rather than guessing —
  these are the choices that, gotten wrong, recreate v1.
