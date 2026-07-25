// Turns clustered stay points into ranked "places" — the actual "top places
// of your life" list.
//
// The split of responsibilities across the three files involved is worth
// keeping straight, because it's what makes each one explainable on its own:
//
//   stayPoints.ts  WHEN you were parked somewhere, and for how long.
//                  Works purely on the time axis. Produces disjoint
//                  episodes with measured start/end times.
//   dbscan.ts      WHICH stays happened at the same location. Works purely
//                  on the space axis, and never sees a timestamp.
//   places.ts      (this file) folds those two together: every stay sharing
//                  a cluster label is the same place, so its visit count is
//                  how many stays landed there and its total time is the
//                  sum of those stays' durations.
//
// The important consequence of doing it in that order: because stays are cut
// from non-overlapping runs of the timeline, summing their durations cannot
// double count. No place can claim a minute another place also claims, and
// the total across all places is bounded by the real length of the history
// — a guarantee that comes from the data structure rather than from a check.

import { NOISE } from './dbscan'
import type { Stay } from './stayPoints'

export interface Place {
  clusterId: number
  lat: number
  lng: number
  /** Raw pings recorded across all visits here — a rough density measure. */
  pointCount: number
  /** Number of separate stays: one arrival, one visit. */
  visitCount: number
  totalDurationSec: number
  firstSeenSec: number
  lastSeenSec: number
  /** Google's own label for this place ("Home", "Work", ...), if any of its
   * stays carried one — the most frequent non-null label among them. Free,
   * instant, and needs no reverse-geocoding lookup. */
  semanticLabel: string | null
}

interface PlaceAccumulator {
  latWeightedSum: number
  lngWeightedSum: number
  weightSum: number
  pointCount: number
  visitCount: number
  totalDurationSec: number
  firstSeenSec: number
  lastSeenSec: number
  labelCounts: Map<string, number>
}

/**
 * @param stays   stay points, in the order they were detected (chronological)
 * @param labels  cluster id per stay, from `dbscan` over the stay centroids
 */
export function buildPlaces(stays: Stay[], labels: Int32Array): Place[] {
  const accumulators = new Map<number, PlaceAccumulator>()

  for (let s = 0; s < stays.length; s++) {
    const clusterId = labels[s]
    // A stay that never clustered is somewhere you went once or twice. Real,
    // but not a recurring place, so it doesn't belong in this ranking.
    if (clusterId === NOISE) continue

    const stay = stays[s]
    const durationSec = stay.endSec - stay.startSec

    let acc = accumulators.get(clusterId)
    if (!acc) {
      acc = {
        latWeightedSum: 0,
        lngWeightedSum: 0,
        weightSum: 0,
        pointCount: 0,
        visitCount: 0,
        totalDurationSec: 0,
        firstSeenSec: stay.startSec,
        lastSeenSec: stay.endSec,
        labelCounts: new Map(),
      }
      accumulators.set(clusterId, acc)
    }

    // Centroid weighted by how many pings each stay contributed, so a long
    // overnight stay pins the location more firmly than a ten-minute one —
    // otherwise a couple of scattered brief visits at the edge of the
    // cluster would drag the marker off the building you actually live in.
    acc.latWeightedSum += stay.lat * stay.pointCount
    acc.lngWeightedSum += stay.lng * stay.pointCount
    acc.weightSum += stay.pointCount

    acc.pointCount += stay.pointCount
    acc.visitCount += 1
    acc.totalDurationSec += durationSec
    if (stay.startSec < acc.firstSeenSec) acc.firstSeenSec = stay.startSec
    if (stay.endSec > acc.lastSeenSec) acc.lastSeenSec = stay.endSec

    if (stay.semanticLabel) {
      acc.labelCounts.set(
        stay.semanticLabel,
        (acc.labelCounts.get(stay.semanticLabel) ?? 0) + 1,
      )
    }
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
      lat: acc.latWeightedSum / acc.weightSum,
      lng: acc.lngWeightedSum / acc.weightSum,
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
