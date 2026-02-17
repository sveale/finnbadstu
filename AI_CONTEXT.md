# AI_CONTEXT.md

Shared project context for AI coding agents.

## Project Identity
- Name: `finnbadstu`
- Purpose: Fast sauna locator web app with static + live Google Maps sauna results.
- Primary users: End users looking for nearby saunas.

## Technical Stack
- Language(s): JavaScript, Astro templates, CSS
- Framework(s): Astro (static output)
- Runtime(s): Node.js (build), browser (client map logic)
- Package manager: npm
- Database/infra: No backend DB; static JSON dataset + Google Maps/Places APIs

## Common Commands
- Install: `npm install`
- Dev/start: `npm run dev`
- Test: Not configured yet
- Lint: Not configured yet
- Typecheck: `npx astro check`
- Build static sauna dataset: `npm run build:saunas`
- Build: `npm run build`
- Full build (dataset + site): `npm run build:all`

## Repository Layout
- Source root: `src/`
- Test location: Not configured yet
- Docs location: `README.md`, `AI_SETUP.md`, `AGENTS.md`, `CLAUDE.md`
- Config location: `package.json`, `astro.config.mjs`, `tsconfig.json`, `.env.example`
- Static/public assets: `public/`
- Build scripts: `scripts/`

## Engineering Constraints
- Performance constraints:
  - Keep initial payload small; map script loads progressively.
  - Cache live sauna lookups in browser to reduce repeated API calls.
- Security/privacy constraints:
  - Browser API key must be referrer-restricted.
  - Geolocation is optional and should only be used when granted/requested.
- Compatibility targets (OS/browser/runtime):
  - Node.js 18.17+ for builds.
  - Modern evergreen browsers for runtime map features.
- Non-goals:
  - No backend service or auth system in this version.

## Decision Notes
- 2026-02-17: Initial AI setup files added.
- 2026-02-17: Astro static sauna finder scaffold added with Google Maps static + live data flow.
