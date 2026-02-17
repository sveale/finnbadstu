# Sauna Finder (Astro)

Static-first Astro web app that renders native HTML/CSS/JS and displays nearby saunas on a map.

## Features
- Static build output via Astro (`output: static`)
- HTML, CSS, and JS split into separate files
- Browser-side live sauna refresh from Google Maps near the user
- Geolocation-aware behavior with graceful fallback when permission is denied
- No local sauna dataset caching; results are fetched directly in the browser

## Requirements
- Node.js 18.17+ (Node 20+ recommended)
- Google Maps Platform browser key for runtime map + places lookup

## Setup
1. Install dependencies:

```bash
npm install
```

2. Create `.env` from the example and add your keys:

```bash
cp .env.example .env
```

3. Start development server:

```bash
npm run dev
```

4. Build static production output:

```bash
npm run build
```

## Key Files
- `src/pages/index.astro`: page markup
- `src/styles/app.css`: app styling
- `src/scripts/app.js`: map + sauna loading logic

## Google Places Data Handling
- Place names, addresses, coordinates, and maps links are fetched at runtime in the browser.
- The app does not store local static sauna catalogs.

## Performance Notes
- Minimal initial HTML with progressive enhancement for map features
- Deferred third-party script loading (Google Maps only when needed)

## Deploy to GitHub Pages
- Workflow file: `.github/workflows/deploy-pages.yml`
- Trigger: push to `main` (or manual run via Actions tab)
- Required secret: `PUBLIC_GOOGLE_MAPS_API_KEY`

### One-time GitHub setup
1. Open repository `Settings` > `Pages`.
2. Set `Source` to `GitHub Actions`.
3. Add repository secret `PUBLIC_GOOGLE_MAPS_API_KEY` under `Settings` > `Secrets and variables` > `Actions`.
