import type { ParsedPoints } from '../parsing/types'

// Google's export is USUALLY already chronological, but nothing guarantees
// it — the newer semantic-segments format in particular interleaves visit /
// activity / timelinePath records that aren't obviously ordered against
// each other once normalized into flat points. Every distance/journey
// computation below assumes strictly increasing timestamps, so this sorts
// once up front rather than have each computation quietly assume it.
export function sortPointsByTime(points: ParsedPoints): ParsedPoints {
  const n = points.lat.length
  const order = Array.from({ length: n }, (_, i) => i)
  order.sort((a, b) => points.timestampSec[a] - points.timestampSec[b])

  const lat = new Float64Array(n)
  const lng = new Float64Array(n)
  const timestampSec = new Uint32Array(n)
  const sources = new Uint8Array(n)
  const semanticLabels = new Array<string | null>(n)
  for (let i = 0; i < n; i++) {
    const src = order[i]
    lat[i] = points.lat[src]
    lng[i] = points.lng[src]
    timestampSec[i] = points.timestampSec[src]
    sources[i] = points.sources[src]
    semanticLabels[i] = points.semanticLabels[src]
  }

  return { ...points, lat, lng, timestampSec, sources, semanticLabels }
}
