// Normalizes the real-world Google location-history export shapes into a
// common point format. Google has changed this format over the years:
//
// 1. "locations" — the classic Records.json export (raw GPS pings, one
//    object per fix): { latitudeE7, longitudeE7, timestamp | timestampMs }.
//    This is usually the biggest file (years of pings every few minutes).
//
// 2. "semanticSegments" — the on-device Timeline export that replaced cloud
//    Timeline in 2024/2025 (Settings > Location > Timeline > Export). Each
//    element is a time span carrying exactly ONE of four variant keys:
//      - `timelinePath`  a list of GPS waypoints (movement)
//      - `visit`         one place, with a start and an end (presence)
//      - `activity`      a trip with endpoints, a mode and Google's own
//                        distanceMeters
//      - `timelineMemory` a long trip Google flagged by itself
//    Coordinates are given as strings like "50.4501°, 30.5234°" instead of
//    E7 integers, everywhere, without exception.
//
// The same file also carries `rawSignals` (thousands of low-level activity
// samples with confidence scores) and `userLocationProfile`. rawSignals is
// deliberately NOT read: it is noisy debug-grade data, and every metric this
// product shows is better served by the segments above.
//
// Adding a third format later just means adding its key to FORMAT_KEYS and a
// case in normalizeRecord — the streaming extractor itself doesn't change.

import {
  POINT_SOURCE,
  type ActivityRecord,
  type PointSource,
  type TravelMode,
  type TripRecord,
} from './types'

export const FORMAT_KEYS = ['locations', 'semanticSegments'] as const
export type FormatKey = (typeof FORMAT_KEYS)[number]

export interface NormalizedPoint {
  lat: number
  lng: number
  timestampSec: number
  source: PointSource
  /** Google's own place label ("HOME", "INFERRED_WORK", ...) when the source
   * record provided a meaningful one — only ever set for `visit` records;
   * raw pings, activities and waypoints never carry one. */
  semanticLabel?: string
}

/** Everything one array element can contribute. */
export interface NormalizedRecord {
  points: NormalizedPoint[]
  activity?: ActivityRecord
  trip?: TripRecord
}

const EMPTY: NormalizedRecord = { points: [] }

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isValidCoordinate(lat: number, lng: number): boolean {
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180
}

/**
 * THE single coordinate parser for the semantic-segments format.
 *
 * Every coordinate in that export — visit locations, activity endpoints,
 * timeline waypoints, profile places — is the same string shape, so it is
 * parsed in exactly one place. Accepts the documented `"50.4501°, 30.5234°"`
 * and, without needing a separate branch, the `"geo:50.4501,30.5234"` form
 * older builds emit: the pattern reads the first two decimal numbers and
 * ignores whatever decorates them.
 */
export function parseLatLng(value: unknown): { lat: number; lng: number } | null {
  if (typeof value !== 'string') return null
  const matches = value.match(/-?\d+(?:\.\d+)?/g)
  if (!matches || matches.length < 2) return null
  const lat = Number(matches[0])
  const lng = Number(matches[1])
  if (!isFiniteNumber(lat) || !isFiniteNumber(lng) || !isValidCoordinate(lat, lng)) {
    return null
  }
  return { lat, lng }
}

/**
 * Coordinates appear either bare or wrapped in a `{ latLng }` object,
 * depending on which field you are reading. Both spellings resolve here so
 * no call site has to know which it got.
 */
function readLocation(value: any): { lat: number; lng: number } | null {
  return parseLatLng(value?.latLng ?? value)
}

function toSeconds(isoOrMs: unknown): number | null {
  if (typeof isoOrMs === 'string') {
    const ms = Date.parse(isoOrMs)
    return Number.isFinite(ms) ? Math.round(ms / 1000) : null
  }
  if (isFiniteNumber(isoOrMs)) {
    return Math.round(isoOrMs / 1000)
  }
  return null
}

// Google's semanticType, as it actually appears in a current export:
// HOME, INFERRED_WORK, UNKNOWN. Earlier builds used title case ("Home").
// "UNKNOWN" is Google saying it could not infer anything, so it is treated
// as no label at all rather than shown to the reader as if it were one —
// on the reference export that alone is 184 of 258 visits.
function normalizeSemanticType(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (trimmed === '') return undefined
  const upper = trimmed.toUpperCase()
  if (upper === 'UNKNOWN') return undefined
  return upper
}

// Grouping Google's activity types into the three the summary screen shows.
// Listed exhaustively rather than pattern-matched on "IN_": the distinction
// between riding a bus and driving a car is a real one to a reader looking
// at their own year, and a prefix rule would collapse it.
const TRAVEL_MODE_BY_TYPE: Record<string, TravelMode> = {
  WALKING: 'walk',
  RUNNING: 'walk',
  ON_FOOT: 'walk',
  HIKING: 'walk',
  IN_BUS: 'transit',
  IN_SUBWAY: 'transit',
  IN_TRAM: 'transit',
  IN_TRAIN: 'transit',
  IN_FERRY: 'transit',
  IN_PASSENGER_VEHICLE: 'drive',
  IN_VEHICLE: 'drive',
  IN_ROAD_VEHICLE: 'drive',
  MOTORCYCLING: 'drive',
}

/**
 * An unrecognised type falls back to 'other' rather than being dropped or
 * guessed into one of the three. Google's activity vocabulary is open-ended
 * (CYCLING, FLYING, SAILING, SKIING, STILL...), so a parser that only knew
 * today's list would quietly lose distance the day a new one appeared.
 */
export function travelModeForType(rawType: string): TravelMode {
  return TRAVEL_MODE_BY_TYPE[rawType.toUpperCase()] ?? 'other'
}

function normalizeLegacyLocation(raw: Record<string, unknown>): NormalizedRecord {
  const latE7 = raw.latitudeE7
  const lngE7 = raw.longitudeE7
  if (!isFiniteNumber(latE7) || !isFiniteNumber(lngE7)) return EMPTY

  const lat = latE7 / 1e7
  const lng = lngE7 / 1e7
  if (!isValidCoordinate(lat, lng)) return EMPTY

  const timestampSec =
    typeof raw.timestamp === 'string'
      ? toSeconds(raw.timestamp)
      : raw.timestampMs != null
        ? toSeconds(Number(raw.timestampMs))
        : null
  if (timestampSec === null) return EMPTY

  // A raw ping is a fix, not a declared stay: it is movement-grade evidence.
  return { points: [{ lat, lng, timestampSec, source: POINT_SOURCE.movement }] }
}

// How densely a visit's span is resampled, and the ceiling on how many
// samples any single visit may produce. Five minutes is roughly the cadence
// of a raw `locations` export, which keeps both formats feeding the engine
// comparable data; the cap stops a pathological multi-day segment from
// producing tens of thousands of points on its own (the interval simply
// stretches instead).
const VISIT_SAMPLE_INTERVAL_SEC = 5 * 60
const MAX_VISIT_SAMPLES = 288

/**
 * Turns one `visit` — which is a time SPAN, not a moment — into the stream of
 * pings the stay detector is built to read.
 *
 * WHY THIS IS NOT INVENTING DATA. A visit record is Google's own assertion
 * that you were at one place from startTime to endTime; the samples below say
 * exactly that and nothing more. Emitting a single point at startTime, which
 * is what this used to do, asserts something strictly WORSE — that you were
 * there for an instant.
 *
 * And the difference is not cosmetic. detectStayPoints recognises a stay only
 * from two or more pings at least MIN_STAY_SEC apart within one radius, so a
 * visit collapsed to a single point has duration zero and can never become
 * one. Every visit in a semantic-segments export was therefore invisible to
 * the place ranking, the district split and the time-of-day patterns — on a
 * 585-visit reference export the engine found exactly ONE place, and that one
 * came from movement waypoints rather than from any visit.
 *
 * These samples are tagged `visit`, so they feed presence-based readings
 * without ever being mistaken for a GPS track.
 */
function expandVisit(
  coords: { lat: number; lng: number },
  startSec: number,
  endSec: number | null,
  semanticLabel: string | undefined,
): NormalizedPoint[] {
  const base = { ...coords, source: POINT_SOURCE.visit, semanticLabel } as const

  // No usable end: fall back to the single instant we can actually defend.
  if (endSec === null || endSec <= startSec) {
    return [{ ...base, timestampSec: startSec }]
  }

  const spanSec = endSec - startSec
  const steps = Math.min(
    Math.max(Math.round(spanSec / VISIT_SAMPLE_INTERVAL_SEC), 1),
    MAX_VISIT_SAMPLES,
  )

  const samples: NormalizedPoint[] = []
  for (let i = 0; i <= steps; i++) {
    samples.push({ ...base, timestampSec: Math.round(startSec + (spanSec * i) / steps) })
  }
  return samples
}

/**
 * When a `timelinePath` waypoint happened.
 *
 * Two spellings exist in the wild and BOTH have to work. The current export
 * stamps each waypoint with an absolute `time`; some builds give no
 * timestamp at all, only `durationMinutesOffsetFromStartTime`, a count of
 * minutes from the enclosing segment's `startTime`.
 *
 * Reading only one of them drops every waypoint of the other's exports
 * silently: the point is skipped, and the file still parses because visits
 * and activities keep producing points.
 */
function waypointTimeSec(step: any, pathStartSec: number | null): number | null {
  const absolute = toSeconds(step?.time)
  if (absolute !== null) return absolute

  if (pathStartSec === null) return null
  const rawOffset = step?.durationMinutesOffsetFromStartTime
  // Number('') is 0, so an empty value would silently become "at the
  // segment's start" rather than "unknown".
  if (rawOffset === null || rawOffset === undefined || rawOffset === '') return null
  const offsetMinutes = Number(rawOffset)
  if (!Number.isFinite(offsetMinutes)) return null

  return Math.round(pathStartSec + offsetMinutes * 60)
}

function normalizeSemanticSegment(raw: Record<string, unknown>): NormalizedRecord {
  const points: NormalizedPoint[] = []
  let activity: ActivityRecord | undefined
  let trip: TripRecord | undefined

  const startSec = toSeconds(raw.startTime)
  const endSec = toSeconds(raw.endTime)

  // Each element carries exactly one variant key, but they are checked
  // independently rather than as an if/else chain — presence of the key is
  // the contract, and a future export carrying two would lose neither.

  const visit = raw.visit as Record<string, any> | undefined
  if (visit) {
    const coords = readLocation(visit?.topCandidate?.placeLocation)
    if (coords && startSec !== null) {
      const semanticLabel = normalizeSemanticType(visit?.topCandidate?.semanticType)
      points.push(...expandVisit(coords, startSec, endSec, semanticLabel))
    }
  }

  const rawActivity = raw.activity as Record<string, any> | undefined
  if (rawActivity) {
    const start = readLocation(rawActivity.start)
    const end = readLocation(rawActivity.end)

    // The endpoints are movement evidence and are worth keeping as points
    // even though the distance comes from Google's own figure below.
    if (start && startSec !== null) {
      points.push({ ...start, timestampSec: startSec, source: POINT_SOURCE.movement })
    }
    if (end && endSec !== null) {
      points.push({ ...end, timestampSec: endSec, source: POINT_SOURCE.movement })
    }

    const distanceMeters = rawActivity.distanceMeters
    if (isFiniteNumber(distanceMeters) && startSec !== null && endSec !== null) {
      const rawType =
        typeof rawActivity?.topCandidate?.type === 'string'
          ? rawActivity.topCandidate.type
          : 'UNKNOWN'
      activity = {
        startSec,
        endSec,
        distanceMeters,
        mode: travelModeForType(rawType),
        rawType,
      }
    }
  }

  const timelinePath = raw.timelinePath
  if (Array.isArray(timelinePath)) {
    for (const step of timelinePath) {
      const coords = parseLatLng(step?.point)
      if (!coords) continue
      const time = waypointTimeSec(step, startSec)
      if (time === null) continue
      points.push({ ...coords, timestampSec: time, source: POINT_SOURCE.movement })
    }
  }

  const memoryTrip = (raw.timelineMemory as Record<string, any> | undefined)?.trip
  if (memoryTrip && startSec !== null && endSec !== null) {
    const km = memoryTrip.distanceFromOriginKms
    if (isFiniteNumber(km) && km > 0) {
      trip = { startSec, endSec, distanceFromOriginKm: km }
    }
  }

  return { points, activity, trip }
}

export function normalizeRecord(key: FormatKey, raw: unknown): NormalizedRecord {
  if (typeof raw !== 'object' || raw === null) return EMPTY
  const record = raw as Record<string, unknown>
  switch (key) {
    case 'locations':
      return normalizeLegacyLocation(record)
    case 'semanticSegments':
      return normalizeSemanticSegment(record)
    default:
      return EMPTY
  }
}
