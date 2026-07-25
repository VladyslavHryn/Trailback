// Public entry point of the analytics engine — the only function anything
// outside this folder needs to call. Ties the individual, independently
// explainable pieces together: sort → distance/journey stats → spatial
// clustering → per-cluster visit accounting.

import type { ParsedPoints } from '../parsing/types'
import { sortPointsByTime } from './sortPointsByTime'
import { computeDistanceStats, type DistanceStats } from './distanceStats'
import { selectStationaryPointIndices } from './stationaryFilter'
import { dedupeForClustering } from './dedupeForClustering'
import { dbscan, NOISE } from './dbscan'
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

// DBSCAN's two hyperparameters, tuned for "a place in someone's life"
// rather than any generic clustering task:
//   - eps: wide enough to absorb ordinary GPS scatter around one real
//     location (accuracy is commonly 20-100m, worse indoors or downtown
//     among tall buildings), narrow enough that two genuinely separate
//     nearby places (home and a neighbor's house) don't merge into one.
//   - minPts: how many pings a spot needs before it counts as a real
//     recurring place instead of one-off noise. A place actually lived in
//     accumulates far more than this across a whole history, so this only
//     needs to be a low bar, not a precise one.
const CLUSTER_EPS_METERS = 150
const CLUSTER_MIN_PTS = 15

export function runAnalytics(rawPoints: ParsedPoints): AnalyticsResult {
  const points = sortPointsByTime(rawPoints)

  const distance = computeDistanceStats(points)

  // Clustering only looks at pings taken while plausibly stationary (see
  // stationaryFilter.ts) — a commute corridor isn't a "place" and, worse,
  // can bridge two real places into one false cluster if left in. Those
  // pings are then deduplicated onto a coarser-than-eps grid (see
  // dedupeForClustering.ts) purely so DBSCAN isn't re-scanning thousands of
  // near-identical "still at home" pings against each other.
  const stationaryIndices = selectStationaryPointIndices(points)
  const stationaryPoints: ParsedPoints = {
    ...points,
    lat: Float64Array.from(stationaryIndices, (i) => points.lat[i]),
    lng: Float64Array.from(stationaryIndices, (i) => points.lng[i]),
    timestampSec: Uint32Array.from(stationaryIndices, (i) => points.timestampSec[i]),
  }

  const cells = dedupeForClustering(stationaryPoints)
  const cellLabels = dbscan(cells.lat, cells.lng, cells.weight, {
    epsMeters: CLUSTER_EPS_METERS,
    minPts: CLUSTER_MIN_PTS,
  })

  // Expand cell labels -> stationary-subset indices -> full original point
  // indices, so places.ts can do its per-ping visit/dwell-time accounting
  // against the real timestamps. Points excluded from clustering (in
  // transit) are left as NOISE — they were never "at a place" to begin with.
  const pointLabels = new Int32Array(points.lat.length).fill(NOISE)
  for (let c = 0; c < cellLabels.length; c++) {
    const label = cellLabels[c]
    for (const subsetIdx of cells.pointIndices[c]) {
      pointLabels[stationaryIndices[subsetIdx]] = label
    }
  }

  const places = buildPlaces(points, pointLabels)

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
