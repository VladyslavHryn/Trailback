// Time-range selection: which slice of the history everything else is
// computed over. Kept in the analytics module rather than in a component
// because "what counts as the current period" is a data question, and both
// the worker and the map have to agree on the answer.

import type { ParsedPoints } from '../parsing/types'

export type RangeSelection =
  | { kind: 'all' }
  | { kind: 'year'; year: number }
  | { kind: 'month'; year: number; month: number } // month is 1-12

export const ALL_TIME: RangeSelection = { kind: 'all' }

/**
 * Stable string identity for a selection — the key an in-session cache is
 * stored under, so re-selecting a period the reader already looked at is a
 * map lookup rather than another clustering pass.
 */
export function rangeKey(selection: RangeSelection): string {
  switch (selection.kind) {
    case 'all':
      return 'all'
    case 'year':
      return `y${selection.year}`
    case 'month':
      return `y${selection.year}m${String(selection.month).padStart(2, '0')}`
  }
}

const MONTH_NAMES = [
  'січень',
  'лютий',
  'березень',
  'квітень',
  'травень',
  'червень',
  'липень',
  'серпень',
  'вересень',
  'жовтень',
  'листопад',
  'грудень',
]

export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? String(month)
}

export function describeRange(selection: RangeSelection): string {
  switch (selection.kind) {
    case 'all':
      return 'За весь час'
    case 'year':
      return `${selection.year} рік`
    case 'month':
      return `${monthName(selection.month)} ${selection.year}`
  }
}

/**
 * Which periods the data actually contains, so the filter can only ever
 * offer a range that has something in it. Offering every month of every year
 * and letting most of them come back empty would make the control look
 * broken on a history with gaps.
 *
 * Buckets by LOCAL time to match the time-of-day charts, which also read in
 * the viewer's timezone — a point can otherwise land in December in the
 * filter and January in the charts.
 */
export interface AvailablePeriods {
  years: number[]
  monthsByYear: Map<number, number[]>
}

export function listAvailablePeriods(points: ParsedPoints): AvailablePeriods {
  const monthsByYear = new Map<number, Set<number>>()

  for (let i = 0; i < points.timestampSec.length; i++) {
    const d = new Date(points.timestampSec[i] * 1000)
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    let months = monthsByYear.get(year)
    if (!months) {
      months = new Set()
      monthsByYear.set(year, months)
    }
    months.add(month)
  }

  const years = Array.from(monthsByYear.keys()).sort((a, b) => a - b)
  const sorted = new Map<number, number[]>()
  for (const year of years) {
    sorted.set(year, Array.from(monthsByYear.get(year)!).sort((a, b) => a - b))
  }

  return { years, monthsByYear: sorted }
}

/** Inclusive-start, exclusive-end epoch seconds for a selection. */
export function selectionBounds(
  selection: RangeSelection,
): { startSec: number; endSec: number } | null {
  if (selection.kind === 'all') return null

  if (selection.kind === 'year') {
    return {
      startSec: new Date(selection.year, 0, 1).getTime() / 1000,
      endSec: new Date(selection.year + 1, 0, 1).getTime() / 1000,
    }
  }

  const { year, month } = selection
  return {
    startSec: new Date(year, month - 1, 1).getTime() / 1000,
    endSec: new Date(year, month, 1).getTime() / 1000,
  }
}

/**
 * The subset of points inside a selection.
 *
 * Two passes (count, then fill) rather than pushing into growable arrays:
 * the result has to be typed arrays anyway, and counting first means each is
 * allocated exactly once at its final size instead of being repeatedly
 * grown and copied — which matters when this runs on every filter change
 * over a multi-million-point history.
 *
 * Returns the ORIGINAL object untouched for "all time", so the common case
 * costs nothing and the caller's identity checks still work.
 */
export function filterPointsByRange(
  points: ParsedPoints,
  selection: RangeSelection,
): ParsedPoints {
  const bounds = selectionBounds(selection)
  if (!bounds) return points

  const { startSec, endSec } = bounds
  const total = points.timestampSec.length

  let kept = 0
  for (let i = 0; i < total; i++) {
    const t = points.timestampSec[i]
    if (t >= startSec && t < endSec) kept++
  }

  const lat = new Float64Array(kept)
  const lng = new Float64Array(kept)
  const timestampSec = new Uint32Array(kept)
  const sources = new Uint8Array(kept)
  const semanticLabels = new Array<string | null>(kept)

  let out = 0
  for (let i = 0; i < total; i++) {
    const t = points.timestampSec[i]
    if (t < startSec || t >= endSec) continue
    lat[out] = points.lat[i]
    lng[out] = points.lng[i]
    timestampSec[out] = t
    sources[out] = points.sources[i]
    semanticLabels[out] = points.semanticLabels[i]
    out++
  }

  return {
    ...points,
    lat,
    lng,
    timestampSec,
    sources,
    semanticLabels,
    // Activities and trips carry their own spans and must be narrowed too,
    // or a single month would report the whole history's kilometres. Keyed
    // on where each one STARTED, so a segment straddling a boundary lands in
    // exactly one period rather than being counted twice or split.
    activities: points.activities.filter(
      (a) => a.startSec >= startSec && a.startSec < endSec,
    ),
    trips: points.trips.filter((t) => t.startSec >= startSec && t.startSec < endSec),
  }
}
