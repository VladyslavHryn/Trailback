import type { ParsedPoints } from '../parsing/types'

// Turns raw GPS pings into weighted heatmap points via spatial grid binning.
//
// WHY aggregate instead of just feeding the heat layer every raw point:
// a multi-year export can hold millions of pings (we've tested up to 2.5M).
// Leaflet.heat draws one blurred blob PER POINT onto an offscreen canvas —
// millions of draw calls on every pan/zoom would stall the browser. Simply
// downsampling (like the Step 2 dot view does) would throw away exactly the
// information a heatmap exists to show: HOW OFTEN a place was visited. If we
// keep a random 5% of pings, a place visited constantly still looks about as
// "hot" as one visited rarely, just with fewer dots.
//
// Grid binning instead collapses nearby pings into one weighted point per
// cell, where the weight is how many pings fell in that cell. This bounds
// the number of points handed to the renderer (bounded by grid cell count,
// not raw ping count) while PRESERVING density information — a cell with
// 10,000 pings still outweighs one with 10, it just costs one draw call
// instead of ten thousand.

export type HeatPoint = [lat: number, lng: number, intensity: number]

export interface HeatmapAggregation {
  points: HeatPoint[]
  /** Highest per-cell intensity, useful as the heat layer's `max` option. */
  maxIntensity: number
  /**
   * Side of one grid cell, in degrees of latitude.
   *
   * The renderer needs this, not just the points: leaflet.heat's radius is
   * in SCREEN PIXELS while this spacing is fixed in degrees, so the ratio
   * between them — how much neighbouring blobs overlap — changes with every
   * zoom level. Left unmanaged, that ratio is what turns a heatmap into a
   * solid stroke (see the radius calculation in MapView).
   */
  cellSizeDeg: number
}

// The grid resolution adapts to how much ground the history actually covers
// (a single neighborhood vs. an entire country) by aiming for roughly this
// many cells along the longer side of the data's bounding box, rather than
// using a fixed degree size that would be too coarse for a small area or
// too fine (too many cells) for a large one.
const TARGET_GRID_CELLS_ACROSS = 300

// Hard ceiling on emitted heat points regardless of grid resolution, so a
// history spread thin across a huge area (lots of populated cells, each
// visited once) can't still overwhelm the renderer. Only the least-visited
// (least visually important) cells are dropped to stay under this.
const MAX_HEAT_POINTS = 50_000

export function aggregateHeatmapPoints(points: ParsedPoints): HeatmapAggregation {
  const count = points.lat.length
  if (count === 0) return { points: [], maxIntensity: 0, cellSizeDeg: 0 }

  let minLat = Infinity
  let maxLat = -Infinity
  let minLng = Infinity
  let maxLng = -Infinity
  for (let i = 0; i < count; i++) {
    const lat = points.lat[i]
    const lng = points.lng[i]
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
  }

  const span = Math.max(maxLat - minLat, maxLng - minLng, 1e-6)
  const cellSize = span / TARGET_GRID_CELLS_ACROSS

  // Bin key -> running sum, so a cell's plotted position is the average of
  // the pings inside it rather than the cell's corner (looks less "gridded").
  const bins = new Map<string, { latSum: number; lngSum: number; pingCount: number }>()

  for (let i = 0; i < count; i++) {
    const lat = points.lat[i]
    const lng = points.lng[i]
    const cellX = Math.floor(lat / cellSize)
    const cellY = Math.floor(lng / cellSize)
    const key = `${cellX}:${cellY}`

    let bin = bins.get(key)
    if (!bin) {
      bin = { latSum: 0, lngSum: 0, pingCount: 0 }
      bins.set(key, bin)
    }
    bin.latSum += lat
    bin.lngSum += lng
    bin.pingCount++
  }

  // Raw ping counts as intensity would let an always-visited place (home,
  // during sleep) completely wash out everywhere else on the color scale.
  // A square-root compresses that range so secondary places you visit
  // occasionally still show up instead of being invisible next to home.
  let heatPoints: HeatPoint[] = []
  for (const bin of bins.values()) {
    const intensity = Math.sqrt(bin.pingCount)
    heatPoints.push([bin.latSum / bin.pingCount, bin.lngSum / bin.pingCount, intensity])
  }

  if (heatPoints.length > MAX_HEAT_POINTS) {
    heatPoints.sort((a, b) => b[2] - a[2])
    heatPoints = heatPoints.slice(0, MAX_HEAT_POINTS)
  }

  let maxIntensity = 0
  for (const [, , intensity] of heatPoints) {
    if (intensity > maxIntensity) maxIntensity = intensity
  }

  return { points: heatPoints, maxIntensity, cellSizeDeg: cellSize }
}
