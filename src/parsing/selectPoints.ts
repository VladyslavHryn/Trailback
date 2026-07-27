import { POINT_SOURCE, type ParsedPoints, type PointSource } from './types'

/**
 * The subset of points carrying a given source tag.
 *
 * Exists because the map's two spatial layers must not read presence samples
 * as if they were a GPS track. A `visit` contributes many samples at ONE
 * coordinate (see expandVisit) — correct for measuring how long you stayed,
 * and actively wrong for a heatmap or a route line, where it lands as a
 * single blazing dot and as a stationary knot in the middle of a path.
 *
 * The counting pass mirrors filterPointsByRange: the result has to be typed
 * arrays anyway, so counting first means allocating each exactly once at its
 * final size instead of growing and copying.
 *
 * Activities, trips and the profile ride along untouched — they describe the
 * history rather than the points, and a caller narrowing to movement still
 * wants Google's own distances.
 */
export function selectPointsBySource(
  points: ParsedPoints,
  source: PointSource,
): ParsedPoints {
  const total = points.lat.length

  let kept = 0
  for (let i = 0; i < total; i++) if (points.sources[i] === source) kept++

  // Nothing to do, and the caller's identity checks keep working.
  if (kept === total) return points

  const lat = new Float64Array(kept)
  const lng = new Float64Array(kept)
  const timestampSec = new Uint32Array(kept)
  const sources = new Uint8Array(kept)
  const semanticLabels = new Array<string | null>(kept)

  let out = 0
  for (let i = 0; i < total; i++) {
    if (points.sources[i] !== source) continue
    lat[out] = points.lat[i]
    lng[out] = points.lng[i]
    timestampSec[out] = points.timestampSec[i]
    sources[out] = points.sources[i]
    semanticLabels[out] = points.semanticLabels[i]
    out++
  }

  return { ...points, lat, lng, timestampSec, sources, semanticLabels }
}

/**
 * Movement-only view, falling back to everything when the export has no
 * movement points at all.
 *
 * The fallback is what keeps the legacy `locations` export working: its raw
 * pings are all tagged movement, so the filter is a no-op there. But a
 * Timeline export whose segments happen to be visits only would otherwise
 * leave the map completely blank — showing the visit points is a worse
 * reading than showing a track, and far better than showing nothing.
 */
export function movementPoints(points: ParsedPoints): ParsedPoints {
  const movement = selectPointsBySource(points, POINT_SOURCE.movement)
  return movement.lat.length > 0 ? movement : points
}
