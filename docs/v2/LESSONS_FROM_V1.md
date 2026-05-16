# Lessons From v1

v1's concept was validated and loved. v1's **execution** failed. The
constraints in `PRINCIPLES.md` and `ARCHITECTURE.md` exist *because of*
these failures. Constraints without their rationale get optimized away by
a well-meaning future agent — so here is the rationale. Do not soften a
rule without re-reading the failure it prevents.

### 1. Self-host stack obesity

"Run a Kanban board with your friends" became orchestrating ~16
containers — a full upstream backend platform (API gateway, auth service,
REST layer, realtime, object storage, an admin studio, metadata service,
image proxy, connection pooler, analytics, a log vector, edge functions),
plus a backup side-car, a reverse proxy, and the app. A friend-group tool
never needed most of that.

→ **Prevented by:** Architecture = one process + one embedded file
(`ARCHITECTURE.md`); minimal-dependency-surface rule, every part
justified or it doesn't ship (`PRINCIPLES.md` 4).

### 2. Origin / identity confusion (the largest defect class)

Too many components each had their own idea of "the URL": build-time
public URL vs an internal service URL (`localhost` vs an internal
hostname); storage URLs leaking the internal origin to the browser; the
auth service stamping an internal host into magic links; the app server
seeing its own bind address as the request URL; the reverse proxy not
bridging the backend's API paths. Each was patched individually — a
string-rewrite on a string-rewrite. **Root cause: an architecture where
the browser, app server, reverse proxy, and auth/storage did not share
one externally-correct base URL by construction.**

→ **Prevented by:** the single-origin guarantee — one process, one URL
the browser knows, DB reached by file path not origin; no origin-rewrite
helper permitted (`ARCHITECTURE.md`; `PRINCIPLES.md` 3). No SMTP/magic
links in v1 removes the "host stamped into an email" mode entirely.

### 3. Quick-fix accretion / ADR sprawl

The deployment ADRs became "live test found X → patched X," each fix
layered on the last. The decision log turned into a bug log.

→ **Prevented by:** decision economy and a high, explicit ADR bar — ADRs
only for structural, hard-to-reverse choices; a bug fix is a commit
(`PRINCIPLES.md` 8; `SESSION_PROTOCOL.md`).

### 4. Broken feedback loop (the meta-failure)

The dev/CI harness had no Docker and no browser. Every
deployment/integration bug was discoverable **only** on the operator's
machine, one slow human round-trip at a time. The critical path was
effectively untestable by the agent — so bugs shipped and compounded.

→ **Prevented by:** one command brings the whole system up; the *same*
path runs headless in CI on every push; one critical-path E2E green from
Milestone 0; no operator-only surface may exist (`PRINCIPLES.md` 2, 6;
`TESTING.md`; `ROADMAP.md` M0). This is the single most important
correction.

### 5. Platform / tooling friction

Windows + Git-Bash path mangling drove real code and installer
contortions instead of a documented, supported runtime matrix.

→ **Prevented by:** a documented runtime/OS matrix (Docker; WSL2 on
Windows); code is not contorted per shell (`PRINCIPLES.md` 1;
`DEPLOY.md`).

### 6. Premature breadth

Native mobile, app-store submission, multi-arch images, backup
side-cars, audit events, realtime presence, share links — all pursued
before the core "me and three friends use a board" experience was solid.

→ **Prevented by:** scope discipline; v1 = friend-group web only; an
explicit fenced Non-Goals list that cannot creep (`PRINCIPLES.md` 7;
`VISION.md`; `ROADMAP.md` Later/Non-Goals).

### 7. Over-engineering & test accretion

Helpers generalized for hypothetical futures; layered string-rewrite
abstractions; a growing pile of tests written *around* the bug class
instead of removing the bug class. Cleverness and test count became
proxies for safety; they were drag.

→ **Prevented by:** MVP minimalism — boring small implementations, no
speculative abstraction; exactly one critical-path E2E and explicit
test anti-goals; subtraction bias in review (`PRINCIPLES.md` 6, 9, 10;
`TESTING.md`).

---

**The one-line summary:** v1 failed on unmanaged complexity and a
feedback loop the agent couldn't run. v2's answer to almost every one of
these is the same: **fewer parts.**
