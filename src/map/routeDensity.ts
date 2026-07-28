// Turns route segments into a FREQUENCY map of the path network: every stretch
// of street appears once, carrying how many times it was travelled.
//
// WHY NOT JUST DRAW THE TRIPS WITH LOW ALPHA. That is the obvious answer and it
// only works for a handful of passes. Alpha compositing saturates: drawing the
// same line at opacity a, n times, gives 1 - (1 - a)^n, so at a = 0.2 a path is
// already 89% opaque after ten passes and indistinguishable from one at fifty.
// A commute walked every weekday for a year is ~250 passes. Measured on exactly
// that case, the old layer (opacity 0.5 per trip) rendered as one flat
// saturated stroke — the "spaghetti" is not that the lines are too opaque, it is
// that beyond a dozen overlaps alpha stops carrying information at all.
//
// Counting first and drawing once is what makes the range real: a street used
// 250 times and one used 3 times differ by their COUNT, which the renderer then
// maps to brightness and width. Rare paths stay faint, daily ones glow — the
// Strava-style reading — and it costs one draw per bucket instead of one per
// trip.

import type { RouteSegment } from './buildRoutes'

/** One stretch of network between two adjacent grid cells. */
export interface RouteEdge {
  a: [lat: number, lng: number]
  b: [lat: number, lng: number]
  /** How many times this stretch was travelled, both directions combined. */
  passes: number
}

// Snapping resolution. Deliberately FINER than the heatmap's ~120 m cells:
// this layer's job is the shape of the network, and at 120 m the edges between
// cell centres are long enough to read as a staircase rather than a street.
//
// It cannot go much below GPS noise either. Consumer fixes scatter by roughly
// 10-30 m, so at 40 m two walks down the same pavement still land in the same
// cell and get counted together, which is the entire point — a cell finer than
// the noise would split one habit into several faint parallel lines.
const ROUTE_CELL_METERS = 40
const METERS_PER_DEGREE = 111_320
const CELL_SIZE = ROUTE_CELL_METERS / METERS_PER_DEGREE

function cellIndex(lat: number, lng: number): string {
  return `${Math.floor(lat / CELL_SIZE)}:${Math.floor(lng / CELL_SIZE)}`
}

/**
 * Counts traversals per stretch of network.
 *
 * Direction is collapsed: a commute out and back is the same street used twice,
 * not two streets, so the key is order-normalised. Steps that begin and end in
 * the same cell are dropped — standing still is not a stretch of path, and it
 * is what the heatmap tab exists to show.
 */
export function buildRouteDensity(segments: RouteSegment[]): RouteEdge[] {
  const counts = new Map<string, RouteEdge>()

  for (const segment of segments) {
    for (let i = 1; i < segment.length; i++) {
      const [lat1, lng1] = segment[i - 1]
      const [lat2, lng2] = segment[i]

      const c1 = cellIndex(lat1, lng1)
      const c2 = cellIndex(lat2, lng2)
      if (c1 === c2) continue

      const key = c1 < c2 ? `${c1}|${c2}` : `${c2}|${c1}`
      const existing = counts.get(key)
      if (existing) {
        existing.passes++
        continue
      }
      // The GRID decides what counts as the same stretch; the drawn geometry is
      // the real fix from the first pass through it. Drawing cell centres was
      // tried and is visibly worse: with waypoints ~60 m apart on 40 m cells,
      // consecutive centres step diagonally and the busiest corridor rendered
      // as a staircase. Keeping true coordinates costs nothing here — the merge
      // already happened on the key.
      counts.set(key, { a: [lat1, lng1], b: [lat2, lng2], passes: 1 })
    }
  }

  // Ascending, so a caller drawing in order paints the busiest stretches last
  // and they are never buried under a once-walked side street.
  return Array.from(counts.values()).sort((x, y) => x.passes - y.passes)
}

/**
 * Groups edges into a few frequency levels, dim/thin → bright/thick.
 *
 * Buckets rather than a colour per edge for a blunt performance reason: a city
 * year produces thousands of edges, and thousands of Leaflet layers stutter on
 * pan. One multi-polyline per level is a handful of layers total, and at six
 * levels the steps are already finer than the eye separates on a dark map.
 *
 * Bucketed on log(passes), not on passes: traversal counts are heavy-tailed
 * (home street in the hundreds, a one-off errand at 1), so linear buckets would
 * put everything except the commute in the bottom one.
 */
export interface RouteLevel {
  /** Every edge in this level, as the 2-point lines Leaflet draws. */
  lines: Array<[[number, number], [number, number]]>
  /** 0..1 position of this level in the ramp. */
  t: number
  /** Representative pass count, for the layer's tooltip/debugging. */
  minPasses: number
  maxPasses: number
}

// Annotated as `number`, not left to infer the literal 6, so the divide-by-zero
// guard below stays a real check rather than a comparison TypeScript can prove
// is always false.
export const ROUTE_LEVELS: number = 6

export function groupRouteLevels(edges: RouteEdge[]): RouteLevel[] {
  if (edges.length === 0) return []

  const maxPasses = edges[edges.length - 1].passes
  const maxLog = Math.log1p(maxPasses)

  const buckets: RouteLevel[] = Array.from({ length: ROUTE_LEVELS }, (_, i) => ({
    lines: [],
    t: ROUTE_LEVELS === 1 ? 1 : i / (ROUTE_LEVELS - 1),
    minPasses: Infinity,
    maxPasses: 0,
  }))

  for (const edge of edges) {
    // maxLog can be 0 when every stretch was travelled exactly once, which is a
    // real case (a single day's export) and would otherwise divide by zero.
    const share = maxLog > 0 ? Math.log1p(edge.passes) / maxLog : 1
    const index = Math.min(ROUTE_LEVELS - 1, Math.floor(share * ROUTE_LEVELS))
    const bucket = buckets[index]
    bucket.lines.push([edge.a, edge.b])
    bucket.minPasses = Math.min(bucket.minPasses, edge.passes)
    bucket.maxPasses = Math.max(bucket.maxPasses, edge.passes)
  }

  return buckets.filter((b) => b.lines.length > 0)
}
