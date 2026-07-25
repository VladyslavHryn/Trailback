// Excludes points captured WHILE MOVING (mid-commute, mid-trip) from the
// set fed into place clustering.
//
// WHY: DBSCAN merges any two dense regions connected by a chain of nearby
// core points ("density-reachability"), even if that chain is thin. A
// handful of commute pings that happen to land close together — GPS
// jitter, a slow moment in traffic — is enough to bridge two completely
// unrelated real places (home and work, say) into one giant cluster. A
// "place" should mean somewhere you STOPPED, not a corridor you passed
// through on the way there, so movement-in-progress pings are excluded
// from clustering entirely rather than trying to tune eps/minPts to
// out-guess every possible bridge.
//
// This reuses the same speed-between-consecutive-pings signal as the
// walk/transit/drive split in distanceStats.ts, just as a keep/drop
// decision instead of a 3-way bucket — distance stats still see every
// point; only clustering's input is narrowed.

import { haversineDistanceMeters } from './geo'
import type { ParsedPoints } from '../parsing/types'

// Comfortably above brisk walking pace, so "wandering around while
// basically still at one place" pings are kept as clustering candidates,
// while cycling/transit/driving pings are excluded.
const MOVING_KMH_THRESHOLD = 12

/** Precondition: `points` is sorted by timestampSec ascending. */
export function selectStationaryPointIndices(points: ParsedPoints): number[] {
  const n = points.lat.length
  const indices: number[] = []
  if (n === 0) return indices

  indices.push(0) // no previous point to judge incoming speed from

  for (let i = 1; i < n; i++) {
    const dtSec = points.timestampSec[i] - points.timestampSec[i - 1]
    if (dtSec <= 0) {
      indices.push(i) // can't judge speed on a duplicate/out-of-order timestamp; keep it
      continue
    }

    const distMeters = haversineDistanceMeters(
      points.lat[i - 1],
      points.lng[i - 1],
      points.lat[i],
      points.lng[i],
    )
    const kmh = distMeters / 1000 / (dtSec / 3600)
    if (kmh <= MOVING_KMH_THRESHOLD) indices.push(i)
  }

  return indices
}
