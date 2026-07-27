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
}

/**
 * The fixed frame every rendered slice is measured against: the grid it is
 * binned onto, and the two ping counts that anchor the colour ramp.
 *
 * IT IS DERIVED ONCE, FROM THE WHOLE HISTORY, and reused for every period
 * the reader selects. That is the entire point of hoisting it out of the
 * aggregation, and it fixes a bug that made the time filter look broken:
 * the scale used to be recomputed per slice, from that slice's own peak. So
 * filtering to one year lowered every intensity AND lowered the value they
 * were divided by, and the two cancelled — picking a year with 60% fewer
 * points changed the rendered heat by about 2%. The numbers on the page
 * updated, the map did not, and the control read as dead. Against a fixed
 * frame, a thinner period is genuinely dimmer.
 *
 * Holding the GRID fixed matters for the same reason: cell size is derived
 * from the bounding box, so a slice covering less ground would otherwise get
 * finer cells, and "pings per cell" would mean something different in every
 * period.
 */
export interface HeatScale {
  /** Grid resolution in degrees. */
  cellSize: number
  /** log1p of the ping count at which a cell starts being visible. */
  floorLog: number
  /** log1p of the busiest cell's ping count — the top of the ramp. */
  peakLog: number
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

// Where the bottom of the colour ramp is pinned, as a percentile of the
// populated cells' ping counts. Cells at or below it render as nothing.
//
// WHY A FLOOR EXISTS AT ALL. Ping counts per cell are extremely heavy-tailed
// — the cell holding home carries three orders of magnitude more pings than
// a street corner. `log1p` compresses that tail, which is necessary, but on
// its own it compresses too far: mapping log1p(count) onto 0..peak left a
// road walked 64 times sitting at 54% of full scale, past the gradient's
// warm stop (0.42) and nearly as loud as a home at 100%. A 36:1 difference
// in how much of someone's life a place holds came out as 1.85:1 on screen,
// and every commute corridor rendered as a saturated bar — the symptom that
// prompted this. Stretching the ramp between a floor and the peak, instead
// of between zero and the peak, spends the visible range on the part of the
// distribution that carries the meaning.
//
// MEASURED, not guessed. Sweep over the reference history (43,428 pings,
// 524 populated cells, peak 2,314), showing what survives and where three
// landmark cells land:
//
//   floor %   cells kept   PINGS kept   road (64)   visit (200)   home (peak)
//     0%         514         100.0%        49%          65%          100%
//    20%         401          98.5%        34%          55%          100%
//    35%         339          96.9%        31%          53%          100%
//    50%         250          94.0%        28%          51%          100%
//    65%         183          91.5%        26%          50%          100%
//    80%          94          87.4%        23%          47%          100%
//
// The median was tried first, on the reasoning that dropping half the cells
// costs only 6% of the pings. On the numbers that looked ideal; ON THE MAP
// it was too much. Warm areas in leaflet.heat come from OVERLAPPING blobs,
// so cell count — not just cell value — is what produces them, and removing
// half the cells removed most of the overlap: rendered coverage fell from
// 6,924 lit samples to 3,424, leaving a single hot dot on a cold field.
//
// The 35th percentile keeps rendered coverage at 6,857 samples, effectively
// the original, while still putting a road walked 64 times at 31% — inside
// the cool band, well below the warm stop at 0.42. Verified on the rendered
// canvas: the hot pixels form two clusters, at the two places where time
// actually accumulated, with all eight bins of the corridor between them
// empty. Presence stays; transit no longer competes with it.
const QUIET_CELL_PERCENTILE = 0.35

// Gamma applied AFTER the floor-to-peak normalisation, to decide how the
// visible range is spent. Below 1 it lifts the midtones; 0 and 1 are fixed
// points, so it cannot reintroduce saturation at the top or leak anything
// back in at the bottom.
//
// WHY IT IS NEEDED. The floor above fixes what is VISIBLE; on its own it
// also drags everything that survives toward the bottom of the ramp, since
// the floor cell maps to exactly 0 and the bulk of the distribution sits
// just above it. Measured on the rendered canvas, a linear ramp left most
// surviving cells in the bottom two alpha buckets. The gamma moves them into
// the middle, where the gradation is actually legible: on the reference
// history it roughly doubled the two mid buckets (579 -> 1,059 and 370 ->
// 790 samples) and lifted total lit coverage from 4,875 to 5,891.
//
// Raising ACCUMULATION_HEADROOM was tried first and does almost nothing here
// (0.1% saturated / 3.0% warm at 1.15, unchanged at 1.0): it moves the very
// top of the scale, and what was missing came from the MIDDLE.
const INTENSITY_GAMMA = 0.7

// A hard ceiling on how coarse one cell may get, whatever the extent.
//
// Deriving cell size from the bounding box alone breaks the moment a history
// covers more than one city, which most do. Measured on a real six-month
// export: the longitudes run from 23.99° to 30.68° — one region in the west,
// daily life in Kyiv — so 300 cells across the span makes each cell 2.5 KM
// WIDE, and the entire city where 99% of the history happened collapsed into
// 102 cells. Trimming the extent to its 1st-99th percentile does not help,
// because the far-away points are not outliers; they are a real second
// cluster, and the p1-p99 span still came to 6.65°.
//
// So the ceiling is expressed as what a cell MEANS rather than as a fraction
// of anything: past roughly a city block, a heat cell stops separating "this
// building" from "this neighbourhood", which is the whole reading. Below the
// ceiling the adaptive size still wins, so a history confined to one district
// is still drawn finely.
//
// Cell count stays bounded by MAX_HEAT_POINTS regardless.
//
// Approximate in longitude: a degree of longitude is shorter than a degree of
// latitude away from the equator (~72 km at 50°N), so cells come out slightly
// wider than tall. That asymmetry predates this constant and is invisible at
// the sizes involved.
const MAX_CELL_METERS = 120
const METERS_PER_DEGREE = 111_320

function gridCellSize(points: ParsedPoints): number {
  const count = points.lat.length
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
  return Math.min(span / TARGET_GRID_CELLS_ACROSS, MAX_CELL_METERS / METERS_PER_DEGREE)
}

function cellKey(lat: number, lng: number, cellSize: number): string {
  return `${Math.floor(lat / cellSize)}:${Math.floor(lng / cellSize)}`
}

/**
 * Derives the reference frame from a full history. Call this once per parsed
 * file and hand the result to every `aggregateHeatmapPoints` call, whatever
 * period is being drawn.
 */
export function computeHeatScale(points: ParsedPoints): HeatScale {
  const count = points.lat.length
  if (count === 0) return { cellSize: 1e-6, floorLog: 0, peakLog: 1 }

  const cellSize = gridCellSize(points)

  const counts = new Map<string, number>()
  for (let i = 0; i < count; i++) {
    const key = cellKey(points.lat[i], points.lng[i], cellSize)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const sorted = Array.from(counts.values()).sort((a, b) => a - b)
  const floorCount = sorted[Math.floor((sorted.length - 1) * QUIET_CELL_PERCENTILE)]
  const peakCount = sorted[sorted.length - 1]

  const rawFloorLog = Math.log1p(floorCount)
  const rawPeakLog = Math.log1p(peakCount)

  // A percentile floor assumes a heavy tail, and collapses without one. When
  // every cell holds roughly the same count — one commute walked the same way
  // every day is the realistic case, not a contrived one — the 35th
  // percentile sits just under the peak, so almost every cell normalises to
  // zero and the map renders as a single dot. Verified on a deliberately
  // uniform fixture: 8 populated cells, 1 emitted.
  //
  // Keeping the floor at or below half the peak guarantees the ramp always
  // has real range to spend. On data with the expected tail it changes
  // nothing at all — on the reference export the floor is 0.69 against a peak
  // of 7.12, nowhere near the cap.
  const floorLog = Math.min(rawFloorLog, rawPeakLog * 0.5)

  // Still guards the degenerate single-cell history, where both are zero.
  const peakLog = Math.max(rawPeakLog, floorLog + 1e-6)

  return { cellSize, floorLog, peakLog }
}

/**
 * Bins one slice of history onto the reference grid and normalises each
 * cell to 0..1 against the reference ramp. Cells at or below the floor are
 * dropped rather than emitted at zero — leaflet.heat still paints a point
 * of zero value at `minOpacity`, so keeping them would lay a faint wash back
 * over the map and undo the floor.
 */
export function aggregateHeatmapPoints(
  points: ParsedPoints,
  scale: HeatScale,
): HeatmapAggregation {
  const count = points.lat.length
  if (count === 0) return { points: [] }

  const { cellSize, floorLog, peakLog } = scale
  const range = peakLog - floorLog

  // Bin key -> running sum, so a cell's plotted position is the average of
  // the pings inside it rather than the cell's corner (looks less "gridded").
  const bins = new Map<string, { latSum: number; lngSum: number; pingCount: number }>()

  for (let i = 0; i < count; i++) {
    const lat = points.lat[i]
    const lng = points.lng[i]
    const key = cellKey(lat, lng, cellSize)

    let bin = bins.get(key)
    if (!bin) {
      bin = { latSum: 0, lngSum: 0, pingCount: 0 }
      bins.set(key, bin)
    }
    bin.latSum += lat
    bin.lngSum += lng
    bin.pingCount++
  }

  let heatPoints: HeatPoint[] = []
  for (const bin of bins.values()) {
    const linear = (Math.log1p(bin.pingCount) - floorLog) / range
    if (linear <= 0) continue
    // Clamped before the gamma so the curve only ever sees 0..1. A slice
    // cannot out-densify the whole-history peak it was measured against, but
    // clamping costs nothing and keeps the contract true by construction.
    const intensity = Math.pow(Math.min(linear, 1), INTENSITY_GAMMA)
    heatPoints.push([bin.latSum / bin.pingCount, bin.lngSum / bin.pingCount, intensity])
  }

  if (heatPoints.length > MAX_HEAT_POINTS) {
    heatPoints.sort((a, b) => b[2] - a[2])
    heatPoints = heatPoints.slice(0, MAX_HEAT_POINTS)
  }

  return { points: heatPoints }
}
