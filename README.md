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
  heavily-commented module — see `src/analytics/` once Step 4 lands.

## Development

```bash
npm install
npm run dev
```

## Status

Built incrementally, step by step. Current: app shell, landing page, and
map view with placeholder points. Google Takeout parsing lands next.
