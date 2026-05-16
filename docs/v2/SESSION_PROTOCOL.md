# Session Protocol

The environment is ephemeral: anything not committed and pushed is lost.
Keep this protocol slim — it is a checklist, not a process.

## Start of session

1. Read, in order: `VISION.md`, `PRINCIPLES.md`, `ROADMAP.md`,
   `ARCHITECTURE.md`. Read `DATA_MODEL.md` only if touching schema/data.
2. Read `LESSONS_FROM_V1.md` once if you haven't — the constraints have
   reasons; don't "optimize" them away.
3. Identify the current milestone in `ROADMAP.md`. Work only on it.

## During the session

- Check every change against the Prime Directive (`PRINCIPLES.md`) in one
  sentence. If you can't, don't do it.
- Subtraction bias: prefer removing over adding. Three plain lines beat a
  clever abstraction. A bug fix is a fix, not a refactor.
- Do not build anything fenced under Roadmap → Later / Non-Goals.

## End of session

1. Run `pnpm typecheck`, lint, and the one critical-path E2E. Note any
   failure explicitly in the commit/handoff; don't paper over it.
2. Update the milestone checkboxes in `ROADMAP.md` if a DoD was met.
3. Append a short handoff entry to a running session log (what changed,
   what's next, anything broken). Keep it to a few lines.
4. Commit (Conventional Commits, e.g. `feat(board): add row reorder`).
5. **Push** to the working branch. The environment is ephemeral —
   unpushed work is gone.
6. Do **not** open a PR unless the user explicitly asks.

## The ADR bar (high on purpose)

Write an ADR **only** for a decision that is both **structural** and
**hard to reverse** (e.g. the persistence engine, the auth model, the
single-origin design). One short ADR: context, decision, the heavier
alternative rejected and why.

- ❌ No ADR for a bug fix. A bug fix is a commit message.
- ❌ No ADR for a reversible or local choice.
- If you're unsure whether it clears the bar, it doesn't.

v1 died partly of an ADR log that became a bug log. Don't repeat that.
