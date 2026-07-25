// "How much of the area you're active in have you actually set foot in?"
//
// This deliberately does NOT resolve to real administrative district names
// — doing that would need a reverse-geocoding lookup, which means sending
// the user's coordinates to a third-party service, breaking the "never
// leaves this device" privacy guarantee this whole app is built around. A
// grid over the data's own bounding box is the privacy-safe equivalent:
// computed entirely from data already in the browser, with the same
// adaptive-resolution idea as the Step 3 heatmap aggregation (aim for a
// fixed number of cells across the longer side, so resolution adapts to
// whether someone's whole history fits in one city or spans a country).

import type { ParsedPoints } from '../parsing/types'

export interface CoverageStats {
  visitedCells: number
  totalCells: number
  coverageRatio: number
  gridCols: number
  gridRows: number
  /** Row-major, gridRows * gridCols long — enough to render a small on-screen grid. */
  visited: boolean[]
}

const TARGET_CELLS_ACROSS = 18

export function computeCoverage(points: ParsedPoints): CoverageStats {
  const n = points.lat.length
  if (n === 0) {
    return {
      visitedCells: 0,
      totalCells: 0,
      coverageRatio: 0,
      gridCols: 0,
      gridRows: 0,
      visited: [],
    }
  }

  let minLat = Infinity
  let maxLat = -Infinity
  let minLng = Infinity
  let maxLng = -Infinity
  for (let i = 0; i < n; i++) {
    const lat = points.lat[i]
    const lng = points.lng[i]
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
  }

  const latSpan = Math.max(maxLat - minLat, 1e-6)
  const lngSpan = Math.max(maxLng - minLng, 1e-6)
  const cellSize = Math.max(latSpan, lngSpan) / TARGET_CELLS_ACROSS

  const gridCols = Math.max(1, Math.ceil(lngSpan / cellSize))
  const gridRows = Math.max(1, Math.ceil(latSpan / cellSize))

  const visited = new Array<boolean>(gridRows * gridCols).fill(false)

  for (let i = 0; i < n; i++) {
    let col = Math.floor((points.lng[i] - minLng) / cellSize)
    let row = Math.floor((points.lat[i] - minLat) / cellSize)
    if (col >= gridCols) col = gridCols - 1
    if (row >= gridRows) row = gridRows - 1
    visited[row * gridCols + col] = true
  }

  const totalCells = gridRows * gridCols
  const visitedCells = visited.reduce((sum, v) => sum + (v ? 1 : 0), 0)

  return {
    visitedCells,
    totalCells,
    coverageRatio: totalCells > 0 ? visitedCells / totalCells : 0,
    gridCols,
    gridRows,
    visited,
  }
}
