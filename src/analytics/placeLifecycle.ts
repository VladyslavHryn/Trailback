// Classifies each recurring place as ABANDONED (a real pattern that
// stopped) or NEW (a real pattern that only started recently), relative to
// the dataset's OWN timeline. Google's Timeline has no equivalent to this
// at all — it only ever shows you one day, with no memory of what used to
// be routine.

import type { Place } from './places'

export interface PlaceLifecycle {
  abandoned: Place[]
  newPlaces: Place[]
}

// A place needs at least this many visits to count as a real pattern —
// filters out places that just happen to sit near the start or end of the
// recorded history without ever being a genuine routine.
const MIN_VISITS_FOR_PATTERN = 4

// "Recent" scales with how much history there is (12% of the total span),
// clamped so it stays meaningful whether the export covers a few months or
// several years — a fixed 90-day window would swallow a short export
// whole, or be a meaningless sliver of a 5-year one.
const MIN_RECENT_WINDOW_SEC = 14 * 24 * 3600
const MAX_RECENT_WINDOW_SEC = 180 * 24 * 3600

export function classifyPlaceLifecycle(
  places: Place[],
  datasetStartSec: number,
  datasetEndSec: number,
): PlaceLifecycle {
  const totalSpanSec = Math.max(datasetEndSec - datasetStartSec, 1)
  const recentWindowSec = Math.min(
    Math.max(totalSpanSec * 0.12, MIN_RECENT_WINDOW_SEC),
    MAX_RECENT_WINDOW_SEC,
  )
  const recentCutoffSec = datasetEndSec - recentWindowSec
  const earlyCutoffSec = datasetStartSec + recentWindowSec

  const abandoned: Place[] = []
  const newPlaces: Place[] = []

  for (const place of places) {
    if (place.visitCount < MIN_VISITS_FOR_PATTERN) continue

    if (place.lastSeenSec < recentCutoffSec) {
      // Was a real pattern, but hasn't shown up in the recent window.
      abandoned.push(place)
    } else if (place.firstSeenSec > earlyCutoffSec) {
      // Wasn't there from the start, AND is still active near the end —
      // distinguishes "a new routine" from "a place that came and went
      // entirely in the middle of the history" (neither new nor abandoned).
      newPlaces.push(place)
    }
  }

  // Rank by how established the pattern was, not just visit count — a
  // place you spent a lot of time at mattering more than one barely used.
  abandoned.sort((a, b) => b.totalDurationSec - a.totalDurationSec)
  newPlaces.sort((a, b) => b.totalDurationSec - a.totalDurationSec)

  return { abandoned, newPlaces }
}
