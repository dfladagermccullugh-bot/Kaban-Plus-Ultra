# Session Protocol

The literal checklists every agent session follows. No skipping.

## Start of session

1. `git status` and `git log -5 --oneline` to orient.
2. Read `CLAUDE.md` (or the appropriate primer in `docs/AGENTS/` if you're a delegated agent).
3. Read the **last entry** in `docs/SESSION_LOG.md` — that's where the previous session left off.
4. Read `docs/ROADMAP.md` — confirm which phase / which checkboxes are next.
5. Read any file listed in the task or in the last session-log entry as "next up".
6. **State the goal of this session in one sentence** before writing any code.
7. Run the baseline once scaffolding exists:
   ```bash
   pnpm install
   pnpm typecheck
   pnpm test
   ```
   Confirm green. If red, fixing red is the session's first task.

## End of session

1. Run the full check:
   ```bash
   pnpm typecheck
   pnpm test
   pnpm lint
   ```
   All green, or note exactly which check fails and why in the session log.
2. Append a new entry to `docs/SESSION_LOG.md` using the template below.
3. Update checkboxes in `docs/ROADMAP.md`.
4. If you made a non-obvious decision, add an ADR:
   ```
   docs/DECISIONS/NNNN-short-title.md
   ```
   where `NNNN` is the next four-digit sequence.
5. Commit with a conventional-commits message:
   ```
   feat(board): add row collapse animation
   ```
6. Push:
   ```bash
   git push -u origin claude/chat-analysis-app-2fsuX
   ```

## SESSION_LOG entry template

Copy/paste this into `docs/SESSION_LOG.md` and fill in:

```md
## YYYY-MM-DD — <one-line summary>

- **Agent / model**: Claude Sonnet 4.6 (or Codex / Gemini if delegated)
- **Branch**: `claude/chat-analysis-app-2fsuX`
- **Phase**: 2 (Board CRUD + 2D grid)

### Goal
<the one-sentence goal stated at session start>

### Changed
- `path/to/file.tsx` — <what changed>
- `path/to/other.ts` — <what changed>

### Verified
- `pnpm typecheck` ✅
- `pnpm test` ✅ (N tests)
- `pnpm lint` ✅
- Manually: <flows tested in the browser / mobile>

### ADRs added
- `docs/DECISIONS/NNNN-short-title.md` (if any)

### Delegations
- (None) or "Delegated <task> to Codex; integrated their output in <files>"

### Next up
<what the next session should pick up; reference roadmap checkboxes>

### Blockers / open questions
<things the user should weigh in on, or environmental issues>
```

## ADR template

For `docs/DECISIONS/NNNN-short-title.md`:

```md
# NNNN. <Title>

- **Date**: YYYY-MM-DD
- **Status**: accepted | superseded by NNNN

## Context
<what problem prompted this decision>

## Decision
<what we chose>

## Alternatives considered
- <option A> — <why not>
- <option B> — <why not>

## Consequences
<what becomes easier; what becomes harder; what we'll have to watch>
```

## When delegating a task to Codex or Gemini

1. Copy `docs/AGENTS/TASK_HANDOFF_TEMPLATE.md` and fill it in.
2. Paste the relevant primer (`docs/AGENTS/CODEX_PRIMER.md` or `GEMINI_PRIMER.md`) **first**, then the filled task template.
3. When the other agent returns code, **read it line-by-line** before integrating. Run `pnpm typecheck` and `pnpm test` after every paste.
4. Record the delegation under "Delegations" in your session log entry.
