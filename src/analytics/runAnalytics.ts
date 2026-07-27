// Public entry point of the analytics engine — the only function anything
// outside this folder needs to call. Ties the individual, independently
// explainable pieces together: sort → distance/journey stats → stay-point
// detection → spatial clustering of those stays → per-place aggregation.

import type { FrequentPlace, ParsedPoints } from '../parsing/types'
import { haversineDistanceMeters } from './geo'
import { sortPointsByTime } from './sortPointsByTime'
import { computeDistanceStats, type DistanceStats } from './distanceStats'
import { detectStayPoints } from './stayPoints'
import { dbscan } from './dbscan'
import { buildPlaces, type Place } from './places'
import { computeFootprintByMonth, type MonthlyFootprint } from './footprintOverTime'
import { classifyPlaceLifecycle, type PlaceLifecycle } from './placeLifecycle'
import { computeCoverage, type CoverageStats } from './coverage'
import { computeTimePatterns, type TimePatterns } from './timePatterns'

export interface AnalyticsResult {
  distance: DistanceStats
  places: Place[]
  pointCount: number
  footprintByMonth: MonthlyFootprint[]
  placeLifecycle: PlaceLifecycle
  coverage: CoverageStats
  timePatterns: TimePatterns
}

// DBSCAN's two hyperparameters. Note what they now apply to: STAY POINTS
// (one per visit), not raw pings — see stayPoints.ts for why that change
// was necessary. Both values follow from that:
//   - eps: wide enough to absorb the scatter between separate visits to the
//     same spot (each stay centroid is already an average of its own pings,
//     so most of the GPS noise is gone by this point), narrow enough that
//     two genuinely separate neighbouring places don't merge into one.
//   - minPts: how many separate visits a spot needs before it counts as a
//     recurring place rather than somewhere you happened to stop once.
//     Measured in VISITS now, which is why it's small — the old value of 15
//     counted individual pings, of which a single evening at home produces
//     dozens.
const CLUSTER_EPS_METERS = 120
const CLUSTER_MIN_PTS = 4

// How close a clustered place has to be to one of Google's own frequent
// places before it inherits its label. Matches the clustering radius: any
// further apart and they are, by this engine's own definition, not the same
// place.
const FREQUENT_PLACE_MATCH_METERS = 120

/**
 * Adopts the HOME/WORK labels Google publishes in `userLocationProfile`.
 *
 * The profile is a second, independent source of the same fact that a
 * visit's `semanticType` carries, and it fills the gaps that one leaves:
 * a place can be plainly your home while every individual visit to it came
 * back UNKNOWN. Existing labels win — a per-visit semanticType is evidence
 * about the visits that actually built this cluster, whereas the profile is
 * a statement about the account as a whole.
 */
function applyFrequentPlaceLabels(
  places: Place[],
  frequentPlaces: FrequentPlace[],
): Place[] {
  if (frequentPlaces.length === 0) return places

  return places.map((place) => {
    if (place.semanticLabel) return place

    let best: { label: string; meters: number } | null = null
    for (const frequent of frequentPlaces) {
      if (!frequent.label) continue
      const meters = haversineDistanceMeters(place.lat, place.lng, frequent.lat, frequent.lng)
      if (meters > FREQUENT_PLACE_MATCH_METERS) continue
      if (!best || meters < best.meters) best = { label: frequent.label, meters }
    }

    return best ? { ...place, semanticLabel: best.label } : place
  })
}

export function runAnalytics(rawPoints: ParsedPoints): AnalyticsResult {
  const points = sortPointsByTime(rawPoints)

  const distance = computeDistanceStats(points)

  // Places are derived in two independent stages, deliberately in this
  // order (see stayPoints.ts for the full reasoning):
  //   1. WHEN — collapse the ping stream into discrete stays, each with a
  //      measured start and end. This is also what removes transit pings:
  //      you can't linger in one spot while walking through it, so commute
  //      trails never become stays and can no longer bridge two unrelated
  //      places into a single sprawling cluster.
  //   2. WHERE — cluster those stay centroids so repeat visits to the same
  //      spot collapse onto one place.
  // Clustering a few thousand stays instead of millions of raw pings also
  // removes the need for the old pre-aggregation step entirely.
  const stays = detectStayPoints(points)

  const stayLat = Float64Array.from(stays, (s) => s.lat)
  const stayLng = Float64Array.from(stays, (s) => s.lng)
  const stayLabels = dbscan(stayLat, stayLng, null, {
    epsMeters: CLUSTER_EPS_METERS,
    minPts: CLUSTER_MIN_PTS,
  })

  const places = applyFrequentPlaceLabels(
    buildPlaces(stays, stayLabels),
    points.frequentPlaces,
  )

  const footprintByMonth = computeFootprintByMonth(points)
  const datasetStartSec = points.timestampSec[0]
  const datasetEndSec = points.timestampSec[points.lat.length - 1]
  const placeLifecycle = classifyPlaceLifecycle(places, datasetStartSec, datasetEndSec)
  const coverage = computeCoverage(points)
  const timePatterns = computeTimePatterns(points)

  return {
    distance,
    places,
    pointCount: points.lat.length,
    footprintByMonth,
    placeLifecycle,
    coverage,
    timePatterns,
  }
}
