# Trailback

Personal location-history analyzer. Turns a Google Takeout location history
export into an interactive map plus life insights — clustering, distances,
and time patterns Google's own Timeline never surfaces.

Portfolio project: the focus is a real client-side data pipeline and
analytics engine, not a map viewer. Everything is processed in-session in
the browser — no uploaded file is ever sent to a server.

## Stack

- React + TypeScript + Vite
- Tailwind CSS v4
- Leaflet + OpenStreetMap tiles (heatmap via a Leaflet heat plugin)
- Analytics engine (clustering, distance, aggregation) as an isolated,
  heavily-commented module — see `src/analytics/`.
- Parsing and analytics each run in their own Web Worker, so a
  multi-hundred-megabyte export never blocks the UI.

## Supported exports

Both real-world shapes Google has shipped, detected automatically from the
file's contents rather than its name:

- **`Records.json`** — the classic cloud Timeline export: raw GPS pings as
  `latitudeE7`/`longitudeE7` integers.
- **`Timeline.json`** — the on-device export that replaced it in 2024/2025
  (Settings › Location › Timeline › Export). Its `semanticSegments` carry
  visits, activities, waypoint paths and Google's own trip distances, with
  coordinates as `"50.4501°, 30.5234°"` strings.

A visit in that second format is a time *span*, not a moment, so it is
resampled across its duration — without that, stay detection sees zero-length
stays and finds essentially no places at all. See `expandVisit` in
`src/parsing/googleLocationFormats.ts` for why that is reporting the data
rather than inventing it.

## Place names

Clustering proves a place exists; it can't say what it's called. Cluster
centres are resolved in two tiers:

1. **Foursquare Places**, via this repo's own `/api/place` endpoint.
   A venue database is the reason this tier exists — OpenStreetMap usually
   answers a bank branch with the street and house number it stands on.
2. **Nominatim (OpenStreetMap)**, called straight from the browser. Free, no
   key, and the fallback for anything Foursquare can't name.

The Foursquare API key is **server-side only**. The browser calls our own
same-origin endpoint with a rounded coordinate; the endpoint attaches the key
and calls Foursquare. The key is never sent to the client, and is deliberately
not named `VITE_*` — Vite inlines those into the bundle at build time.

The provider is swappable without the client changing: the browser only ever
knows `/api/place`. Google Places was the first implementation and was replaced
by Foursquare here without touching a line of client fetch code.

Tier 1 is optional. With no key set, `/api/place` answers "no result" and
everything falls back to Nominatim, which is exactly how the app behaved before
the endpoint existed.

Only rounded coordinates of your top place centres leave the browser — dozens
of points, never the file. See `src/analytics/geocoding.ts`.

### Setup

```bash
cp .env.example .env   # then fill in FOURSQUARE_API_KEY
```

At [foursquare.com/developers](https://foursquare.com/developers): create a
project and generate a **Service Key**. The free tier needs no card.

Set the same variable in your host's environment for deploys.

## Development

```bash
npm install
npm run dev
```

`npm run dev` serves `/api/place` through the same handler the deployed
function uses (see the plugin in `vite.config.ts`), so the venue-lookup path is
exercised locally and not only in production.

## Deploying

`api/place.ts` is a zero-config Vercel function. All its logic is in
`server/handler.ts` as a Web-standard `Request -> Response` function, so moving
to Netlify, Cloudflare Workers or Deno Deploy means re-exporting it from that
platform's entry file — nothing platform-specific lives outside `api/`.

## Status

Built incrementally, step by step. Parsing, the analytics engine, the map
layers and the scrolling story are in place, driven by a time-range filter
with in-session caching per period.
