# CLAUDE.md

Instructions for Claude Code in this repository.

## Startup
1. Read `AI_CONTEXT.md`.
2. Read `AGENTS.md`.
3. If requirements are ambiguous, use minimal safe assumptions and call them out.

## Working Style
- Make small, reviewable edits.
- Keep behavior changes paired with tests when practical.
- Avoid touching unrelated files.
- Prefer existing patterns over introducing new architecture.

## Safety
- Avoid destructive commands unless explicitly requested.
- Flag risky changes before making them (migrations, large dependency additions, rewrites).

## Validation
- Run relevant project checks when available.
- If checks are unavailable, provide exact commands that should be run later.

## Output Expectations
Include:
1. Summary of file changes
2. Validation results
3. Remaining risks or TODOs

## Optional Slash Commands
- `/.claude/commands/plan.md`
- `/.claude/commands/review.md`
