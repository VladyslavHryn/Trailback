// Turns DBSCAN's raw cluster labels into ranked "places" — the actual "top
// places of your life" list. Spatial clustering alone only tells you WHERE
// pings piled up; it says nothing about visit count or time spent, because
// a single cluster covers every ping ever recorded there, from a hundred
// separate visits spread across years. Splitting those visits back apart
// needs a second pass over time, per cluster.

import type { ParsedPoints } from '../parsing/types'
import { NOISE } from './dbscan'

export interface Place {
  clusterId: number
  lat: number
  lng: number
  pointCount: number
  visitCount: number
  totalDurationSec: number
  firstSeenSec: number
  lastSeenSec: number
}

// Same idea as JOURNEY_GAP_SEC in distanceStats.ts, applied per-place
// instead of globally: a gap this long between two pings AT THE SAME PLACE
// means you left and came back later — a new visit, not a continuation.
const VISIT_GAP_SEC = 30 * 60

// A visit built from a single ping has zero measured duration, which
// understates it — you were there for SOME amount of time, we just don't
// have a second ping to prove how long. This is a floor, not an estimate.
const MIN_VISIT_SEC = 5 * 60

/** Precondition: `points` is sorted by timestampSec ascending. */
export function buildPlaces(points: ParsedPoints, labels: Int32Array): Place[] {
  // Group point indices by cluster, skipping noise (-1) — those pings
  // aren't part of any recurring place.
  const byCluster = new Map<number, number[]>()
  for (let i = 0; i < labels.length; i++) {
    const id = labels[i]
    if (id === NOISE) continue
    let indices = byCluster.get(id)
    if (!indices) {
      indices = []
      byCluster.set(id, indices)
    }
    indices.push(i)
  }

  const places: Place[] = []

  for (const [clusterId, indices] of byCluster) {
    // Points were already time-sorted globally, so indices collected in
    // ascending order are already chronological within this cluster too —
    // no need to re-sort.
    let latSum = 0
    let lngSum = 0
    let visitCount = 0
    let totalDurationSec = 0

    let sessionStart = points.timestampSec[indices[0]]
    let sessionEnd = sessionStart

    for (let k = 0; k < indices.length; k++) {
      const idx = indices[k]
      latSum += points.lat[idx]
      lngSum += points.lng[idx]
      const t = points.timestampSec[idx]

      if (k > 0 && t - sessionEnd > VISIT_GAP_SEC) {
        visitCount++
        totalDurationSec += Math.max(sessionEnd - sessionStart, MIN_VISIT_SEC)
        sessionStart = t
      }
      sessionEnd = t
    }
    // Close out whichever visit was still in progress at the end.
    visitCount++
    totalDurationSec += Math.max(sessionEnd - sessionStart, MIN_VISIT_SEC)

    places.push({
      clusterId,
      lat: latSum / indices.length,
      lng: lngSum / indices.length,
      pointCount: indices.length,
      visitCount,
      totalDurationSec,
      firstSeenSec: points.timestampSec[indices[0]],
      lastSeenSec: points.timestampSec[indices[indices.length - 1]],
    })
  }

  // "Top places of your life" — ranked by time spent, since a place you
  // sleep at every night matters more than one you passed through often
  // but briefly.
  places.sort((a, b) => b.totalDurationSec - a.totalDurationSec)
  return places
}
