// Public entry point of the analytics engine — the only function anything
// outside this folder needs to call. Ties the individual, independently
// explainable pieces together: sort → distance/journey stats → stay-point
// detection → spatial clustering of those stays → per-place aggregation.

import type { ParsedPoints } from '../parsing/types'
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

  const places = buildPlaces(stays, stayLabels)

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
