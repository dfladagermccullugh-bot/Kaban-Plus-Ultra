# Agents Index

This project's primary AI agent is **Claude Code**. Other AI tools may be
brought in for specific narrow tasks. This folder primes them.

## Which agent for what

| Agent | Best at | Primer |
|---|---|---|
| **Claude Code** | Architecture, multi-file features, refactors across packages, ops, infra | `CLAUDE.md` at repo root |
| **OpenAI Codex / ChatGPT** | Isolated UI components, refactors with a clear contract, test authoring, small backend handlers | [`CODEX_PRIMER.md`](./CODEX_PRIMER.md) |
| **Google Gemini** | Visual review from screenshots, design-system enforcement, multimodal (Figma → Tailwind) tasks | [`GEMINI_PRIMER.md`](./GEMINI_PRIMER.md) |

## How to delegate a task

1. Copy [`TASK_HANDOFF_TEMPLATE.md`](./TASK_HANDOFF_TEMPLATE.md) and fill it in.
2. **Paste the relevant primer first**, then the filled task template, into that agent's session.
3. When the other agent returns code, the primary agent (Claude) reads it line-by-line before integrating. **Never merge unread AI output.**
4. After every paste, run `pnpm typecheck && pnpm test && pnpm lint`.
5. Note the delegation under "Delegations" in your `docs/SESSION_LOG.md` entry.

## Files

- [`SHARED_CONTEXT.md`](./SHARED_CONTEXT.md) — the canonical 60-second briefing every agent reads. Both primers include it verbatim to prevent drift.
- [`CODEX_PRIMER.md`](./CODEX_PRIMER.md) — Codex-targeted primer with a front-end checklist and repo-specific pitfalls.
- [`GEMINI_PRIMER.md`](./GEMINI_PRIMER.md) — Gemini-targeted primer emphasizing visual review and multimodal tasks.
- [`TASK_HANDOFF_TEMPLATE.md`](./TASK_HANDOFF_TEMPLATE.md) — fill-in-the-blank template (goal / out-of-scope / files / acceptance criteria).

## When NOT to delegate

- Anything spanning more than ~5 files. Split it.
- Anything that touches RLS policies, auth, or migrations. Claude (or a human) handles these end-to-end.
- Anything where the contract isn't clear enough to write down on one page. Clarify first.
