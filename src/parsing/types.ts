// Shared types for the Google location-history parsing pipeline. Kept
// dependency-free (no DOM/worker globals) so this file type-checks the same
// way on both the main thread and inside the worker.

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
  /** Google's own place label for this ping (e.g. "Home", "Work"), when the
   * semantic-segments export provided one — null for the vast majority of
   * points (raw pings never carry one; most visits don't either). Kept as
   * a plain array (not a typed array) since it's mostly-null strings, not
   * a dense numeric column. */
  semanticLabels: (string | null)[]
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
