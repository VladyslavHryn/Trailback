import type { ParsedPoints } from '../parsing/types'

/**
 * The rectangle the map should OPEN on: where the history actually happened,
 * not the full extent of every coordinate in it.
 *
 * WHY THIS IS NOT min/max. The obvious extent is the true bounding box, and
 * it is the wrong frame for a first view, because a bounding box is decided
 * entirely by its most extreme members. Measured on a 27,000-point Kyiv
 * history with THREE points added abroad — 0.011% of the data — the opening
 * view went from zoom 14 over Kyiv to zoom 5 spanning Ireland to Russia. At
 * that scale the heatmap covered 0.18% of the canvas instead of 8.4%, so the
 * map read as empty; the route became a hairline crossing a continent. One
 * flight, one bad GPS fix, or one holiday is enough to do this, and every
 * real export has at least one.
 *
 * A percentile box asks a different question — "where is nearly all of it?" —
 * which is what a reader wants to see first. The outliers are still ON the
 * map and still reachable by zooming out; they simply stop dictating the
 * frame.
 *
 * The percentiles are deliberately gentle. At 2%/98% a genuine second home,
 * or a city someone spent a month in, still pulls the frame open, because
 * that is thousands of points rather than three.
 */
const LOW_PERCENTILE = 0.02
const HIGH_PERCENTILE = 0.98

// Percentiles need sorted values, and sorting several million coordinates on
// every load is a cost with no payoff: a percentile estimated from a large
// even sample lands in the same place. Striding also keeps the sample
// chronologically spread, so it can't over-represent one dense period.
const MAX_SAMPLE = 200_000

export interface LatLngBounds {
  minLat: number
  minLng: number
  maxLat: number
  maxLng: number
}

function percentileRange(values: Float64Array, count: number): [number, number] {
  const stride = Math.max(1, Math.ceil(count / MAX_SAMPLE))
  const sampleSize = Math.ceil(count / stride)
  const sample = new Float64Array(sampleSize)
  for (let i = 0, out = 0; i < count && out < sampleSize; i += stride, out++) {
    sample[out] = values[i]
  }
  sample.sort()

  const low = sample[Math.floor((sampleSize - 1) * LOW_PERCENTILE)]
  const high = sample[Math.ceil((sampleSize - 1) * HIGH_PERCENTILE)]
  return [low, high]
}

/**
 * Falls back to the true extent when the percentile box would be degenerate —
 * a history confined to one building, or a handful of points, where 2% and
 * 98% land on the same coordinate and `fitBounds` would be asked to frame a
 * zero-size rectangle.
 */
export function robustBounds(points: ParsedPoints): LatLngBounds | null {
  const count = points.lat.length
  if (count === 0) return null

  const [minLat, maxLat] = percentileRange(points.lat, count)
  const [minLng, maxLng] = percentileRange(points.lng, count)

  const MIN_SPAN_DEG = 0.002 // ~200 m, below which a map has nothing to frame
  if (maxLat - minLat < MIN_SPAN_DEG || maxLng - minLng < MIN_SPAN_DEG) {
    let loLat = Infinity
    let hiLat = -Infinity
    let loLng = Infinity
    let hiLng = -Infinity
    for (let i = 0; i < count; i++) {
      const lat = points.lat[i]
      const lng = points.lng[i]
      if (lat < loLat) loLat = lat
      if (lat > hiLat) hiLat = lat
      if (lng < loLng) loLng = lng
      if (lng > hiLng) hiLng = lng
    }
    // Still degenerate (one single location) — give it a small window so the
    // map opens at street level rather than at whole-world default zoom.
    if (hiLat - loLat < MIN_SPAN_DEG) {
      loLat -= MIN_SPAN_DEG / 2
      hiLat += MIN_SPAN_DEG / 2
    }
    if (hiLng - loLng < MIN_SPAN_DEG) {
      loLng -= MIN_SPAN_DEG / 2
      hiLng += MIN_SPAN_DEG / 2
    }
    return { minLat: loLat, minLng: loLng, maxLat: hiLat, maxLng: hiLng }
  }

  return { minLat, minLng, maxLat, maxLng }
}
