// Merges a Place list with (optional, partial, arrives async) geocoding
// results into what the UI actually displays, and aggregates time-by-
// category and time-by-district from whatever's been geocoded so far.
// Kept separate from geocoding.ts (the network client) and places.ts (pure
// clustering output) — this file is pure data-shaping, no network, no
// clustering, easy to reason about and test on its own.

import type { Place } from './places'
import { translateSemanticLabel, type GeocodedPlace } from './geocoding'

export interface DisplayPlace extends Place {
  displayName: string
  category: string | null
  district: string | null
}

export function buildDisplayPlaces(
  places: Place[],
  geocoded: Map<number, GeocodedPlace>,
): DisplayPlace[] {
  return places.map((place) => {
    const g = geocoded.get(place.clusterId)
    const displayName = place.semanticLabel
      ? translateSemanticLabel(place.semanticLabel)
      : (g?.name ?? `${place.lat.toFixed(3)}, ${place.lng.toFixed(3)}`)

    return {
      ...place,
      displayName,
      category: g?.category ?? null,
      district: g?.district ?? null,
    }
  })
}

export interface CategoryBreakdown {
  category: string
  totalDurationSec: number
  placeCount: number
}

export function summarizeCategories(
  places: Place[],
  geocoded: Map<number, GeocodedPlace>,
): CategoryBreakdown[] {
  const byCategory = new Map<string, { totalDurationSec: number; placeCount: number }>()

  for (const place of places) {
    const category = geocoded.get(place.clusterId)?.category
    if (!category) continue

    let entry = byCategory.get(category)
    if (!entry) {
      entry = { totalDurationSec: 0, placeCount: 0 }
      byCategory.set(category, entry)
    }
    entry.totalDurationSec += place.totalDurationSec
    entry.placeCount += 1
  }

  return Array.from(byCategory.entries())
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.totalDurationSec - a.totalDurationSec)
}

// Fixed-order categorical palette for coloring places/markers by district —
// starts with the app's own two brand accents, then a few more hues spread
// around the wheel. Cycles if a history somehow spans more districts than
// colors; districts are a secondary visual aid here; not a data-integrity
// critical chart, so exact colorblind-safety validation wasn't run on it
// the way the Step 3 heatmap ramp was.
const DISTRICT_COLOR_PALETTE = [
  '#e8853a',
  '#3fb8a8',
  '#f2a35e',
  '#5ecdbd',
  '#a78bfa',
  '#f472b6',
  '#facc15',
  '#38bdf8',
]

/** Assigns each distinct district name a stable color, in first-seen order. */
export function assignDistrictColors(districtNamesInOrder: string[]): Map<string, string> {
  const colorByDistrict = new Map<string, string>()
  for (const name of districtNamesInOrder) {
    if (colorByDistrict.has(name)) continue
    colorByDistrict.set(
      name,
      DISTRICT_COLOR_PALETTE[colorByDistrict.size % DISTRICT_COLOR_PALETTE.length],
    )
  }
  return colorByDistrict
}

export interface DistrictBreakdown {
  district: string
  totalDurationSec: number
  placeCount: number
  /** Share of time among places that HAVE been geocoded, not all of them —
   * there's no way to know a real percentage of "life in this district"
   * until every top place has a resolved address. */
  shareOfKnownTime: number
}

export function summarizeDistricts(
  places: Place[],
  geocoded: Map<number, GeocodedPlace>,
): DistrictBreakdown[] {
  const byDistrict = new Map<string, { totalDurationSec: number; placeCount: number }>()
  let knownTotalSec = 0

  for (const place of places) {
    const district = geocoded.get(place.clusterId)?.district
    if (!district) continue

    knownTotalSec += place.totalDurationSec
    let entry = byDistrict.get(district)
    if (!entry) {
      entry = { totalDurationSec: 0, placeCount: 0 }
      byDistrict.set(district, entry)
    }
    entry.totalDurationSec += place.totalDurationSec
    entry.placeCount += 1
  }

  return Array.from(byDistrict.entries())
    .map(([district, v]) => ({
      district,
      ...v,
      shareOfKnownTime: knownTotalSec > 0 ? v.totalDurationSec / knownTotalSec : 0,
    }))
    .sort((a, b) => b.totalDurationSec - a.totalDurationSec)
}
