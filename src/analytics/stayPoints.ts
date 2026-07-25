// STAY-POINT DETECTION — the step that turns a stream of raw GPS pings into
// discrete "you were parked here, from this moment to that moment" episodes.
//
// WHY THIS EXISTS (and what it replaced)
//
// The engine used to cluster raw pings directly and then reconstruct time
// spent by walking the timeline and crediting the gap between two
// consecutive pings to a place whenever both ends carried the same cluster
// label. That was disjoint per interval, so it could never exceed the real
// span of the history — but it still produced absurd results in practice
// (a single place totalling 461 days out of a 486-day history, ~22.8 h/day),
// for two reasons that compounded:
//
//  1. THE CLUSTER WAS TOO BIG. Pings taken while WALKING pass the old
//     "stationary" speed filter by design (walking is ~5 km/h, well under
//     the 12 km/h cutoff). Walking pace with a ping every couple of minutes
//     lays down a trail of points ~100-170m apart — right at the 150m
//     clustering radius. DBSCAN grows clusters through chains of nearby
//     core points, so those walking trails act as bridges and weld an
//     entire city district into ONE cluster. Once "home", "work", the
//     supermarket and every street between them share a single label, most
//     consecutive ping pairs in the whole history trivially match "same
//     place at both ends", and nearly all wall-clock time gets credited to
//     it. That is exactly the reported symptom: one place named after a
//     street, holding 95% of the history, in a district reported at 97%.
//  2. ABSENCE READ AS PRESENCE. Crediting the gap between two pings assumes
//     you stayed put the whole time in between. Over a long history the
//     small gaps alone add up to a huge overcount.
//
// THE FIX: stop trying to infer time from cluster labels, and detect the
// stays FIRST — before any clustering happens. This is the classic stay-
// point formulation (Li et al., "Mining user similarity based on location
// history", 2008): scan the time-ordered points and look for a run that
// stays within a small radius for at least a minimum duration. Each run
// becomes one Stay with a real, measured start and end.
//
// What that buys, structurally rather than by tuning:
//   - Walking corridors disappear on their own. You cannot linger within
//     100m for 10 minutes while walking past, so transit pings never become
//     stay points and can no longer bridge unrelated places. Clustering
//     then runs on a few thousand well-separated stay centroids instead of
//     millions of pings.
//   - Dwell time can no longer be double counted or inflated. Stays are cut
//     from DISJOINT runs of the timeline and each one's duration is simply
//     (last ping - first ping) inside its own run. Non-overlap is a property
//     of how they are built, not something the code has to check for.
//   - "Visits" becomes a real count of arrivals rather than a heuristic:
//     one stay is one visit.

import { haversineDistanceMeters } from './geo'
import type { ParsedPoints } from '../parsing/types'

export interface Stay {
  /** Centroid of the pings that make up this stay. */
  lat: number
  lng: number
  startSec: number
  endSec: number
  /** How many raw pings fell inside this stay. */
  pointCount: number
  /** Google's own label ("Home"/"Work"), if any ping here carried one. */
  semanticLabel: string | null
}

// How far you can drift and still count as "in the same spot". Covers a
// building plus ordinary GPS scatter (commonly 20-100m, worse indoors and
// among tall buildings). Kept tight rather than generous: a stay that gets
// split in two by a wide drift is a minor cosmetic problem, whereas a
// radius large enough to span neighbouring buildings recreates the exact
// merging problem this module exists to remove.
const STAY_RADIUS_METERS = 100

// Below this, you stopped — at a light, in a queue, at a crossing — but you
// were not anywhere. Ten minutes is short enough to keep genuinely brief
// errands (a pharmacy, a coffee) and long enough to reject everything that
// merely interrupted a journey.
const MIN_STAY_SEC = 10 * 60

// Two pings can sit within the radius but hours apart, because the phone
// was off, asleep, or out of signal. Beyond this cut-off there is no
// evidence of presence in between, so the stay is ENDED at the last ping
// before the gap; whatever comes after starts a fresh stay. The gap itself
// is then credited to nobody, which is the honest reading — the alternative
// (assuming you stayed) is what inflated the old numbers.
const MAX_INTERNAL_GAP_SEC = 2 * 3600

/**
 * Extracts stay points from time-sorted points.
 *
 * Precondition: `points` is sorted by timestampSec ascending.
 *
 * Cost: effectively linear on real traces. The inner scan only runs long
 * while the trace is genuinely parked (and that whole run is then consumed
 * in one jump); while moving it breaks after a step or two.
 */
export function detectStayPoints(points: ParsedPoints): Stay[] {
  const n = points.lat.length
  const stays: Stay[] = []

  let i = 0
  while (i < n) {
    // Extend the run [i, j) for as long as every ping stays within the
    // radius OF THE ANCHOR p_i. Measuring against the fixed anchor (rather
    // than a running centroid) bounds the whole stay's diameter at
    // 2 * STAY_RADIUS_METERS, so a slow drift can't walk a "stay" down the
    // street one tolerated step at a time.
    let j = i + 1
    while (j < n) {
      if (points.timestampSec[j] - points.timestampSec[j - 1] > MAX_INTERNAL_GAP_SEC) break
      const dist = haversineDistanceMeters(
        points.lat[i],
        points.lng[i],
        points.lat[j],
        points.lng[j],
      )
      if (dist > STAY_RADIUS_METERS) break
      j++
    }

    const lastIdx = j - 1
    const durationSec = points.timestampSec[lastIdx] - points.timestampSec[i]

    if (durationSec >= MIN_STAY_SEC) {
      let latSum = 0
      let lngSum = 0
      const labelCounts = new Map<string, number>()

      for (let k = i; k <= lastIdx; k++) {
        latSum += points.lat[k]
        lngSum += points.lng[k]
        const label = points.semanticLabels[k]
        if (label) labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1)
      }

      let semanticLabel: string | null = null
      let bestCount = 0
      for (const [label, count] of labelCounts) {
        if (count > bestCount) {
          semanticLabel = label
          bestCount = count
        }
      }

      const pointCount = lastIdx - i + 1
      stays.push({
        lat: latSum / pointCount,
        lng: lngSum / pointCount,
        startSec: points.timestampSec[i],
        endSec: points.timestampSec[lastIdx],
        pointCount,
        semanticLabel,
      })

      // Consume the whole run — the next stay starts after it, which is what
      // keeps stays disjoint in time.
      i = j
    } else {
      // Not a stay: this ping was passed through. Move the anchor by one and
      // try again from there.
      i++
    }
  }

  return stays
}
