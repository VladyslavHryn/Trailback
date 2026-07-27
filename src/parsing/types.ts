// Shared types for the Google location-history parsing pipeline. Kept
// dependency-free (no DOM/worker globals) so this file type-checks the same
// way on both the main thread and inside the worker.

// Points are stored as three parallel typed arrays (a "structure of arrays"
// layout) instead of an array of {lat, lng, timestampSec} objects. For a
// multi-hundred-MB export with millions of points, one JS object per point
// costs far more memory than three flat numeric buffers, and the typed
// arrays can be transferred to/from the worker instantly (zero-copy) instead
// of being structured-cloned.
/**
 * Where a point came from, which decides what it may be used for.
 *
 * A modern Timeline export describes two genuinely different things, and
 * conflating them makes both readings wrong: `timelinePath`/`activity` say
 * you MOVED THROUGH somewhere, `visit` says you STAYED somewhere. The
 * heatmap and the route layer want the first; stay detection and the place
 * ranking want the second. Kept as a per-point tag rather than as separate
 * arrays so the sort in sortPointsByTime keeps one timeline, not two.
 */
export const POINT_SOURCE = {
  /** A GPS waypoint or an activity endpoint — evidence of movement. */
  movement: 0,
  /** Sampled from a visit's span — evidence of presence, not of a track. */
  visit: 1,
} as const

export type PointSource = (typeof POINT_SOURCE)[keyof typeof POINT_SOURCE]

/** How a stretch of movement was covered, as Google itself labelled it. */
export type TravelMode = 'walk' | 'transit' | 'drive' | 'other'

/**
 * One `activity` segment, kept whole rather than reduced to points.
 *
 * `distanceMeters` is Google's own figure for the stretch and is strictly
 * better than re-deriving it: an activity records only its START and END
 * coordinates, so measuring the straight line between them would report the
 * crow-flies distance of every bus ride and every walk around a corner.
 */
export interface ActivityRecord {
  startSec: number
  endSec: number
  distanceMeters: number
  mode: TravelMode
  /** Google's raw type string ("WALKING", "IN_SUBWAY", ...), kept for debugging. */
  rawType: string
}

/** A `timelineMemory.trip` — Google's own notion of "you went somewhere far". */
export interface TripRecord {
  startSec: number
  endSec: number
  distanceFromOriginKm: number
}

/** An entry of `userLocationProfile.frequentPlaces`. */
export interface FrequentPlace {
  lat: number
  lng: number
  /** "HOME" / "WORK", or null where Google wasn't confident enough to say. */
  label: string | null
}

// Points are stored as three parallel typed arrays (a "structure of arrays"
// layout) instead of an array of {lat, lng, timestampSec} objects. For a
// multi-hundred-MB export with millions of points, one JS object per point
// costs far more memory than three flat numeric buffers, and the typed
// arrays can be transferred to/from the worker instantly (zero-copy) instead
// of being structured-cloned.
export interface ParsedPoints {
  lat: Float64Array
  lng: Float64Array
  timestampSec: Uint32Array
  /** Per-point POINT_SOURCE tag — see the constant for why this matters. */
  sources: Uint8Array
  /** Google's own place label for this ping (e.g. "HOME"), when the
   * semantic-segments export provided one — null for the vast majority of
   * points (raw pings never carry one; most visits don't either). Kept as
   * a plain array (not a typed array) since it's mostly-null strings, not
   * a dense numeric column. */
  semanticLabels: (string | null)[]
  /** Activity segments with Google's own distances. Empty for the legacy
   * `locations` export, which carries no activity labels at all. */
  activities: ActivityRecord[]
  /** Long trips Google itself flagged. Usually a handful, often none. */
  trips: TripRecord[]
  /** From `userLocationProfile`, when the export includes one. */
  frequentPlaces: FrequentPlace[]
  /** Which Google export shape was detected — shown to the user for context. */
  format: string
  /** Total array elements the parser walked through (valid + invalid). */
  recordsSeen: number
  /** Elements that were missing coordinates/timestamps or failed to parse. */
  recordsSkipped: number
}

export interface ParseProgress {
  bytesRead: number
  totalBytes: number
  recordsSeen: number
  recordsSkipped: number
  pointsFound: number
}

export type ParseErrorCode = 'unrecognized-format' | 'no-points-found'

export class LocationParseError extends Error {
  code: ParseErrorCode

  constructor(code: ParseErrorCode, message: string) {
    super(message)
    this.name = 'LocationParseError'
    this.code = code
  }
}
