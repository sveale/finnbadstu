# AGENTS.md

Repository-wide instructions for coding agents (especially Codex).

## Project Status
- This is a new repository with no fixed stack yet.
- Prefer incremental setup and avoid heavy assumptions.

## First Steps
1. Read `AI_CONTEXT.md` for project-specific details.
2. If key details are missing, proceed with safe defaults and document assumptions.
3. Keep changes small, focused, and easy to review.

## Working Rules
- Search with `rg`/`rg --files` when available.
- Do not modify unrelated files.
- Do not use destructive Git commands unless explicitly asked.
- Ask before introducing major dependencies, generators, or large refactors.
- Prefer clear, boring implementations over clever abstractions.

## Quality Bar
- Add or update tests for behavior changes and bug fixes.
- Run relevant checks when available (test, lint, typecheck, build).
- If checks cannot run, state what was skipped and why.

## Response Format
When reporting work, include:
1. What changed
2. Validation performed
3. Risks, assumptions, or follow-ups

## File Ownership Conventions
- Put architecture/decision notes in `docs/` (create if needed).
- Keep environment variables documented in `.env.example`.
- Keep `AI_CONTEXT.md` current as tooling and commands evolve.
