# Trailback

**Personal Location-History Analyzer**

[![Live Demo](https://img.shields.io/badge/Demo-Live_Preview-3fb8a8?style=for-the-badge&logo=google-chrome&logoColor=white)](https://trailback.hrynvladyslav07.workers.dev/)

Turns Google Takeout location history exports into an interactive map and life insights — all processed locally in your browser.

---

## Overview

Trailback is a personal location-history analyzer that transforms Google Takeout location exports into an interactive map with deep analytics. Clustering, distance calculations, and time patterns that Google's Timeline doesn't surface.

This is a portfolio project focused on a real client-side data pipeline and analytics engine. Everything processes in-session in the browser — your export file never touches a server.

## Tech Stack

- **React + TypeScript + Vite**
- **Tailwind CSS v4**
- **Leaflet + OpenStreetMap** tiles (heatmap via `Leaflet.heat`)
- **Analytics engine** — clustering, distance, aggregation. See `src/analytics/`
- **Web Workers** — parsing and analytics run in background threads, keeping the UI responsive even with multi-hundred-megabyte imports

## Supported Exports

Auto-detected by file contents:

### Records.json
Classic cloud Timeline export. GPS coordinates as `latitudeE7`/`longitudeE7` integers.

### Timeline.json
The on-device export (Settings › Location › Timeline › Export) that replaced the cloud version in 2024/2025. Contains `semanticSegments` with visits, activities, waypoint paths, and trip distances. Coordinates formatted as `"50.4501°, 30.5234°"` strings.

**Note:** A visit represents a time span, not a moment. The app resamples coordinates across the visit duration. Without resampling, stay detection fails. See `expandVisit()` in `src/parsing/googleLocationFormats.ts`.

## Place Names

Clustering confirms a place exists but cannot name it. Cluster centers resolve in two tiers:

1. **Foursquare Places** via `/api/place` — a dedicated venue database. OpenStreetMap often returns street addresses instead of business names.
2. **Nominatim (OpenStreetMap)** fallback — free, no key required, called directly from the browser.

The Foursquare API key stays server-side only. The browser sends rounded cluster coordinates to `/api/place`, which attaches the key and queries Foursquare. The key is never exposed to the client.

Tier 1 is optional. Without a key configured, the app falls back entirely to Nominatim.

**Privacy:** Only rounded coordinates of top cluster centers leave the browser (a few dozen points). The original export file processes entirely in-browser and never uploads. See `src/analytics/geocoding.ts`.

## Setup

1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

2. Visit [foursquare.com/developers](https://foursquare.com/developers), create a project, and generate a **Service Key** (free tier, no credit card required). Add it to `.env`:
   ```
   FOURSQUARE_API_KEY=your_key_here
   ```

3. Set the same variable in your production hosting platform.

## Development

```bash
npm install
npm run dev
```

`npm run dev` serves `/api/place` using the production handler (via Vite plugin in `vite.config.ts`), so you can test the venue-lookup flow locally.

## Deployment

`api/place.ts` is a zero-config Vercel function. Core logic in `server/handler.ts` is a platform-agnostic Web function (`Request -> Response`). Migrating to Netlify, Cloudflare Workers, or Deno Deploy requires only re-exporting this function in the target platform's entry file.

## Status

Built incrementally. Current features: parsing, analytics engine, interactive map layers, time-range filtering with in-session caching, and the scrolling travel story.
