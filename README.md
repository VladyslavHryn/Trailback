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

## Development

```bash
npm install
npm run dev
```

## Status

Built incrementally, step by step. Parsing, the analytics engine, the map
layers and the scrolling story are in place, driven by a time-range filter
with in-session caching per period.
