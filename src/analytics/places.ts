// Turns DBSCAN's raw cluster labels into ranked "places" — the actual "top
// places of your life" list. Spatial clustering alone only tells you WHERE
// pings piled up; it says nothing about visit count or time spent, because
// a single cluster covers every ping ever recorded there, from a hundred
// separate visits spread across years. Splitting those visits back apart
// needs a second pass over time.

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
  /** Google's own label for this place ("Home", "Work", ...), if any of its
   * pings carried one — the most frequent non-null label among them. Free,
   * instant, and needs no reverse-geocoding lookup. */
  semanticLabel: string | null
}

// A gap this long between two consecutive pings at the same place means you
// left and came back — a new visit rather than a continuation of the last.
const VISIT_GAP_SEC = 30 * 60

// HOW TIME-AT-PLACE IS COUNTED, and why it's done this way.
//
// The obvious implementation — group each cluster's pings, find its first
// and last ping per session, sum (last - first) — is wrong in three ways
// that all inflate the totals, badly enough to produce impossible numbers
// (a single place totalling more days than a person actually had):
//
//  1. DOUBLE COUNTING. A per-cluster session only looks at that cluster's
//     own pings and is blind to everything in between. Pings at
//     home 10:00 → elsewhere 10:05 → home 10:10 make home's session span
//     the full 10:00-10:10 while the other place ALSO counts its own time.
//     The same wall-clock minute gets credited to two places at once, so
//     the totals had no upper bound at all.
//  2. GAPS COUNTED AS PRESENCE. `last - first` silently includes every
//     internal gap. Since each gap was only compared against its immediate
//     predecessor, a chain of just-under-threshold gaps stitched into one
//     enormous "continuous" stay that nobody actually sat through.
//  3. A PER-VISIT FLOOR added on top of all that — harmless once, but
//     hundreds of visits × a 5-minute floor is tens of extra hours.
//
// Instead, time is attributed INTERVAL BY INTERVAL over the globally
// time-sorted points: the gap between two consecutive pings is credited to
// a place only when BOTH ends of that gap are at that same place. Since
// consecutive intervals are disjoint and each is credited to at most one
// place, this gives a guarantee the old approach couldn't: the sum of every
// place's time can never exceed the real span of the history.
//
// Gaps longer than this cap are only credited up to the cap — beyond a few
// hours, two pings at the same place is no longer evidence of continuous
// presence (a phone can be off, or asleep, for days between them), so the
// honest move is to stop crediting rather than assume presence.
const MAX_ATTRIBUTED_GAP_SEC = 3 * 3600

interface PlaceAccumulator {
  latSum: number
  lngSum: number
  pointCount: number
  visitCount: number
  totalDurationSec: number
  firstSeenSec: number
  lastSeenSec: number
  labelCounts: Map<string, number>
}

/** Precondition: `points` is sorted by timestampSec ascending. */
export function buildPlaces(points: ParsedPoints, labels: Int32Array): Place[] {
  const n = points.lat.length
  const accumulators = new Map<number, PlaceAccumulator>()

  const accumulatorFor = (clusterId: number): PlaceAccumulator => {
    let acc = accumulators.get(clusterId)
    if (!acc) {
      acc = {
        latSum: 0,
        lngSum: 0,
        pointCount: 0,
        visitCount: 0,
        totalDurationSec: 0,
        firstSeenSec: points.timestampSec[0],
        lastSeenSec: points.timestampSec[0],
        labelCounts: new Map(),
      }
      accumulators.set(clusterId, acc)
    }
    return acc
  }

  // Pass 1: per-point aggregates (centroid, extent, Google's own labels).
  for (let i = 0; i < n; i++) {
    const clusterId = labels[i]
    if (clusterId === NOISE) continue

    const acc = accumulatorFor(clusterId)
    if (acc.pointCount === 0) acc.firstSeenSec = points.timestampSec[i]
    acc.latSum += points.lat[i]
    acc.lngSum += points.lng[i]
    acc.pointCount++
    acc.lastSeenSec = points.timestampSec[i]

    const label = points.semanticLabels[i]
    if (label) acc.labelCounts.set(label, (acc.labelCounts.get(label) ?? 0) + 1)
  }

  // Pass 2: attribute each inter-ping interval to at most one place, and
  // count visits from the same walk so both stay consistent with each other.
  for (let i = 0; i < n; i++) {
    const clusterId = labels[i]
    if (clusterId === NOISE) continue

    const acc = accumulatorFor(clusterId)
    const prevLabel = i > 0 ? labels[i - 1] : NOISE
    const gapSec = i > 0 ? points.timestampSec[i] - points.timestampSec[i - 1] : 0

    // A visit begins whenever we arrive here from somewhere else, or return
    // after a long enough gap to count as having left.
    const isContinuation = prevLabel === clusterId && gapSec > 0 && gapSec <= VISIT_GAP_SEC
    if (!isContinuation) {
      acc.visitCount++
      continue
    }

    acc.totalDurationSec += Math.min(gapSec, MAX_ATTRIBUTED_GAP_SEC)
  }

  const places: Place[] = []
  for (const [clusterId, acc] of accumulators) {
    let semanticLabel: string | null = null
    let bestCount = 0
    for (const [label, count] of acc.labelCounts) {
      if (count > bestCount) {
        semanticLabel = label
        bestCount = count
      }
    }

    places.push({
      clusterId,
      lat: acc.latSum / acc.pointCount,
      lng: acc.lngSum / acc.pointCount,
      pointCount: acc.pointCount,
      visitCount: acc.visitCount,
      totalDurationSec: acc.totalDurationSec,
      firstSeenSec: acc.firstSeenSec,
      lastSeenSec: acc.lastSeenSec,
      semanticLabel,
    })
  }

  // "Top places of your life" — ranked by time spent, since a place you
  // sleep at every night matters more than one you passed through often
  // but briefly.
  places.sort((a, b) => b.totalDurationSec - a.totalDurationSec)
  return places
}
