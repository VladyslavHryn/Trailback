// Builds the polylines behind the map's "routes" layer — the actual paths
// travelled, rather than the density cloud the heatmap shows.
//
// A location history is not one continuous line. Joining every consecutive
// ping would draw a straight edge from wherever you were on Tuesday evening
// to wherever you woke up on Wednesday, and across every gap where the phone
// was off — producing long false strokes across the map that look like
// journeys that never happened. So the sequence is cut into segments
// wherever the record stops being continuous.

import { haversineDistanceMeters } from '../analytics/geo'
import type { ParsedPoints } from '../parsing/types'

export type RouteSegment = Array<[lat: number, lng: number]>

// Longer than this between consecutive pings and we can't claim to know what
// happened in between, so the line stops. Matches the journey-splitting
// threshold the distance stats use, so the map and the numbers describe the
// same trips.
const SEGMENT_GAP_SEC = 25 * 60

// A jump implying a speed no ground travel reaches is a bad GPS fix (or an
// untracked flight); drawing it would put a stroke straight across the map.
const MAX_PLAUSIBLE_KMH = 200

// Vertices are what cost the renderer, so the whole layer is capped.
// Modern Leaflet Canvas renderer easily handles over 150k vertices with zero lag,
// especially with its own screen-space pixel simplification (smoothFactor).
// A higher limit ensures raw GPS tracks retain detail instead of looking like straight lines.
const MAX_TOTAL_VERTICES = 150_000

// Below this, a "segment" is a handful of jittery pings while standing
// still, which draws as a scribble rather than a path.
const MIN_SEGMENT_POINTS = 3

export function buildRoutes(points: ParsedPoints): RouteSegment[] {
  const n = points.lat.length
  if (n < 2) return []

  // The engine sorts its own copy; the map gets the array as parsed, so
  // order can't be assumed. Sorting indices avoids copying the coordinates.
  const order = Array.from({ length: n }, (_, i) => i)
  order.sort((a, b) => points.timestampSec[a] - points.timestampSec[b])

  const segments: RouteSegment[] = []
  let current: RouteSegment = []

  const flush = () => {
    if (current.length >= MIN_SEGMENT_POINTS) segments.push(current)
    current = []
  }

  for (let k = 0; k < n; k++) {
    const i = order[k]
    const lat = points.lat[i]
    const lng = points.lng[i]

    if (k === 0) {
      current.push([lat, lng])
      continue
    }

    const prev = order[k - 1]
    const dtSec = points.timestampSec[i] - points.timestampSec[prev]

    if (dtSec <= 0) continue // duplicate timestamp, nothing to draw

    if (dtSec > SEGMENT_GAP_SEC) {
      flush()
      current.push([lat, lng])
      continue
    }

    const km =
      haversineDistanceMeters(points.lat[prev], points.lng[prev], lat, lng) / 1000
    if (km / (dtSec / 3600) > MAX_PLAUSIBLE_KMH) {
      flush()
      current.push([lat, lng])
      continue
    }

    current.push([lat, lng])
  }
  flush()

  return capVertices(segments)
}

/**
 * Thins every segment by the same stride until the whole layer fits the
 * vertex budget. Thinning uniformly (rather than dropping whole segments)
 * keeps the SHAPE of the network — every trip still appears, just with
 * fewer intermediate points.
 * Short segments are excluded from thinning to prevent them from collapsing
 * into straight lines.
 */
function capVertices(segments: RouteSegment[]): RouteSegment[] {
  const total = segments.reduce((sum, s) => sum + s.length, 0)
  if (total <= MAX_TOTAL_VERTICES) return segments

  const stride = Math.ceil(total / MAX_TOTAL_VERTICES)

  const thinned: RouteSegment[] = []
  for (const segment of segments) {
    if (segment.length < 8) {
      thinned.push(segment)
      continue
    }
    const out: RouteSegment = []
    for (let i = 0; i < segment.length; i += stride) out.push(segment[i])
    // Always keep the true end point so a trip doesn't visibly stop short.
    const last = segment[segment.length - 1]
    if (out[out.length - 1] !== last) out.push(last)
    if (out.length >= 2) thinned.push(out)
  }
  return thinned
}
