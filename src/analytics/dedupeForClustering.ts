// Collapses near-duplicate points (GPS jitter while stationary at one spot)
// into weighted "cells" before DBSCAN runs on them.
//
// WHY this is necessary, not just an optimization: DBSCAN's regionQuery
// cost is proportional to how many OTHER points fall within eps of a given
// point. That's fine when points are spread out, but a place you spend a
// lot of time at (home, overnight) can rack up thousands of near-identical
// pings within a few meters of each other over a long history — every one
// of them mutually within eps of nearly every other. Querying each of
// those thousands of points' neighborhoods, each of which returns almost
// the whole set, is O(size²) for that one place alone — measured at over
// two minutes for a single realistic year of data before this existed.
//
// Binning first, at a resolution MUCH finer than eps (so cluster shapes at
// the eps scale are unaffected), collapses that into a handful of weighted
// cells instead. The underlying per-ping timestamps aren't thrown away —
// each cell keeps a list of which original point indices fell into it — so
// once DBSCAN labels the (few) cells, those labels are expanded back onto
// every original point, and downstream visit/dwell-time accounting (see
// places.ts) still works from the real, individual pings.

import type { ParsedPoints } from '../parsing/types'

export interface ClusterCells {
  lat: Float64Array
  lng: Float64Array
  weight: Float64Array
  /** Original point indices that fell into each cell, same order as lat/lng/weight. */
  pointIndices: number[][]
}

// Well below the DBSCAN eps (150m) so this only removes redundant near-
// duplicate pings — it can never merge what should be two separate places.
const DEDUPE_CELL_METERS = 15
const METERS_PER_DEGREE_LAT = 111_320

export function dedupeForClustering(points: ParsedPoints): ClusterCells {
  const n = points.lat.length

  let latSum = 0
  for (let i = 0; i < n; i++) latSum += points.lat[i]
  const refLat = n > 0 ? latSum / n : 0
  const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos((refLat * Math.PI) / 180)

  const cellIndexOf = new Map<string, number>()
  const cellLatSum: number[] = []
  const cellLngSum: number[] = []
  const cellWeight: number[] = []
  const pointIndices: number[][] = []

  for (let i = 0; i < n; i++) {
    const lat = points.lat[i]
    const lng = points.lng[i]
    const cx = Math.floor((lng * metersPerDegreeLng) / DEDUPE_CELL_METERS)
    const cy = Math.floor((lat * METERS_PER_DEGREE_LAT) / DEDUPE_CELL_METERS)
    const key = `${cx}:${cy}`

    let idx = cellIndexOf.get(key)
    if (idx === undefined) {
      idx = cellLatSum.length
      cellIndexOf.set(key, idx)
      cellLatSum.push(0)
      cellLngSum.push(0)
      cellWeight.push(0)
      pointIndices.push([])
    }

    cellLatSum[idx] += lat
    cellLngSum[idx] += lng
    cellWeight[idx] += 1
    pointIndices[idx].push(i)
  }

  const cellCount = cellLatSum.length
  const lat = new Float64Array(cellCount)
  const lng = new Float64Array(cellCount)
  for (let idx = 0; idx < cellCount; idx++) {
    lat[idx] = cellLatSum[idx] / cellWeight[idx]
    lng[idx] = cellLngSum[idx] / cellWeight[idx]
  }

  return { lat, lng, weight: Float64Array.from(cellWeight), pointIndices }
}
