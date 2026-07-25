// Tracks how someone's geographic footprint changed month by month — did
// their radius of activity expand, shrink, or shift to a new center
// entirely (moving to a different city, say)? Bucketed by calendar month:
// coarse enough to smooth out day-to-day noise while still showing real
// multi-month trends, which is exactly the kind of insight Google's
// day-at-a-time Timeline has no way to surface.

import { haversineDistanceMeters } from './geo'
import type { ParsedPoints } from '../parsing/types'

export interface MonthlyFootprint {
  /** "YYYY-MM", UTC — month boundaries are coarse enough that timezone
   * doesn't meaningfully shift which points land in which month. */
  month: string
  centroidLat: number
  centroidLng: number
  /** Root-mean-square distance from THIS MONTH's own centroid, in km — a
   * standard human-mobility metric ("radius of gyration"): how far-ranging
   * that month was, independent of where it happened to be centered. */
  radiusOfGyrationKm: number
  /** Distance from this month's centroid to the ALL-TIME centroid, in km.
   * Radius of gyration alone can't distinguish "ranged further from the
   * same home base" from "the whole home base moved" — this can: a house
   * move shows up as a sustained jump in this series, not the other one. */
  shiftFromOverallCentroidKm: number
  pointCount: number
}

export function computeFootprintByMonth(points: ParsedPoints): MonthlyFootprint[] {
  const n = points.lat.length
  if (n === 0) return []

  let overallLatSum = 0
  let overallLngSum = 0
  for (let i = 0; i < n; i++) {
    overallLatSum += points.lat[i]
    overallLngSum += points.lng[i]
  }
  const overallCentroidLat = overallLatSum / n
  const overallCentroidLng = overallLngSum / n

  const byMonth = new Map<string, { latSum: number; lngSum: number; indices: number[] }>()
  for (let i = 0; i < n; i++) {
    const month = new Date(points.timestampSec[i] * 1000).toISOString().slice(0, 7)
    let bucket = byMonth.get(month)
    if (!bucket) {
      bucket = { latSum: 0, lngSum: 0, indices: [] }
      byMonth.set(month, bucket)
    }
    bucket.latSum += points.lat[i]
    bucket.lngSum += points.lng[i]
    bucket.indices.push(i)
  }

  const result: MonthlyFootprint[] = []
  for (const [month, bucket] of byMonth) {
    const centroidLat = bucket.latSum / bucket.indices.length
    const centroidLng = bucket.lngSum / bucket.indices.length

    let squaredSum = 0
    for (const idx of bucket.indices) {
      const d = haversineDistanceMeters(points.lat[idx], points.lng[idx], centroidLat, centroidLng)
      squaredSum += d * d
    }
    const radiusOfGyrationKm = Math.sqrt(squaredSum / bucket.indices.length) / 1000

    const shiftFromOverallCentroidKm =
      haversineDistanceMeters(centroidLat, centroidLng, overallCentroidLat, overallCentroidLng) /
      1000

    result.push({
      month,
      centroidLat,
      centroidLng,
      radiusOfGyrationKm,
      shiftFromOverallCentroidKm,
      pointCount: bucket.indices.length,
    })
  }

  result.sort((a, b) => a.month.localeCompare(b.month))
  return result
}
