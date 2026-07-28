// Merges a Place list with (optional, partial, arrives async) geocoding
// results into what the UI actually displays, and aggregates time-by-
// category and time-by-district from whatever's been geocoded so far.
// Kept separate from geocoding.ts (the network client) and places.ts (pure
// clustering output) — this file is pure data-shaping, no network, no
// clustering, easy to reason about and test on its own.

import type { Place } from './places'
import { translateSemanticLabel, type GeocodedPlace } from './geocoding'
import { accentShade } from '../map/accent'

export interface DisplayPlace extends Place {
  displayName: string
  category: string | null
  district: string | null
  /**
   * Google's own label for this place ("Дім", "Робота (ймовірно)"), when the
   * cluster carries one. Kept as a SECONDARY tag rather than the primary name:
   * "Дім (ймовірно)" says less than the actual street address Foursquare or
   * Nominatim give, so the geocoded name wins and this badge supplements it.
   */
  semanticBadge: string | null
}

export function buildDisplayPlaces(
  places: Place[],
  geocoded: Map<number, GeocodedPlace>,
): DisplayPlace[] {
  return places.map((place) => {
    const g = geocoded.get(place.clusterId)

    // Geocoded name (Foursquare → Nominatim) is the primary display name:
    // it gives a real address or venue name. Google's semantic label (HOME,
    // INFERRED_WORK, …) is precise about WHOSE place this is, but not about
    // WHAT the place is — "Дім (ймовірно)" is less informative than
    // "вул. Хрещатик, 1" or "ПриватБанк". The label is preserved as a
    // secondary badge the UI can render alongside the name.
    const displayName =
      g?.name ?? `${place.lat.toFixed(3)}, ${place.lng.toFixed(3)}`

    const semanticBadge = place.semanticLabel
      ? translateSemanticLabel(place.semanticLabel)
      : null

    return {
      ...place,
      displayName,
      category: g?.category ?? null,
      district: g?.district ?? null,
      semanticBadge,
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
// A SEQUENTIAL scale on one hue, replacing the categorical rainbow this used
// to be.
//
// The old version handed each district the next colour off a rotating list —
// mint, periwinkle, rose, amber. That encoded nothing: the colours carried no
// order, so the reader had to consult a legend to learn that pink meant
// "Podil", and even then pink told them nothing about Podil. It also made
// every screen it touched look like a chart template.
//
// Time spent is a MAGNITUDE, so it wants a magnitude scale: one hue, ramped
// from deep and desaturated to bright and light. Reading it needs no legend —
// brighter is more of your life — and the map pins and the districts list can
// share the exact same function, so the two views finally agree instead of
// each inventing its own colours.
// Lightness in percent, chroma in OKLCH's own units. Chroma is kept under
// ~0.13 because that's roughly the sRGB gamut boundary for this hue at these
// lightnesses — asking for more just gets silently clamped by the browser,
// which flattens the top of the ramp instead of extending it.
/**
 * Colour for a district/place given its share of the top entry's time (0..1).
 *
 * DELEGATES to the product accent rather than owning a ramp. It used to carry
 * its own OKLCH stops at hue 172 — jade — which is why the place pins on the
 * map shared no colour with the routes drawn beside them and the heatmap under
 * them. The scale itself (perceptually uniform, square-rooted so the crowded
 * low end gets more of the range) now lives in one place for every layer that
 * needs it; see src/map/accent.ts.
 *
 * The name stays because every call site means the same thing by it — shade a
 * magnitude against the largest one — and renaming it would touch four files to
 * say nothing new.
 */
export function districtShade(share: number): string {
  return accentShade(share)
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
