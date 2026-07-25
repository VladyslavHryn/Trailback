// Normalizes the two real-world Google location-history export shapes into
// a common point format. Google has changed this format over the years:
//
// 1. "locations" — the classic Records.json export (raw GPS pings, one
//    object per fix): { latitudeE7, longitudeE7, timestamp | timestampMs }.
//    This is usually the biggest file (years of pings every few minutes).
//
// 2. "semanticSegments" — the on-device Timeline export that replaced cloud
//    Timeline in 2024/2025 (Settings > Location > Timeline > Export). Each
//    element is a time span that is either a `visit` (one place), an
//    `activity` (a trip with a start/end), or a `timelinePath` (a list of
//    waypoints) — coordinates are given as strings like "50.4501°, 30.5234°"
//    instead of E7 integers.
//
// Adding a third format later just means adding its key to FORMAT_KEYS and a
// case in normalizeRecord — the streaming extractor itself doesn't change.

export const FORMAT_KEYS = ['locations', 'semanticSegments'] as const
export type FormatKey = (typeof FORMAT_KEYS)[number]

export interface NormalizedPoint {
  lat: number
  lng: number
  timestampSec: number
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isValidCoordinate(lat: number, lng: number): boolean {
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180
}

/** Parses Google's "50.4501°, 30.5234°" style coordinate strings. */
function parseLatLngString(value: unknown): { lat: number; lng: number } | null {
  if (typeof value !== 'string') return null
  const matches = value.match(/-?\d+\.\d+/g)
  if (!matches || matches.length < 2) return null
  const lat = Number(matches[0])
  const lng = Number(matches[1])
  if (!isFiniteNumber(lat) || !isFiniteNumber(lng) || !isValidCoordinate(lat, lng)) {
    return null
  }
  return { lat, lng }
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

function normalizeLegacyLocation(raw: Record<string, unknown>): NormalizedPoint[] {
  const latE7 = raw.latitudeE7
  const lngE7 = raw.longitudeE7
  if (!isFiniteNumber(latE7) || !isFiniteNumber(lngE7)) return []

  const lat = latE7 / 1e7
  const lng = lngE7 / 1e7
  if (!isValidCoordinate(lat, lng)) return []

  const timestampSec =
    typeof raw.timestamp === 'string'
      ? toSeconds(raw.timestamp)
      : raw.timestampMs != null
        ? toSeconds(Number(raw.timestampMs))
        : null
  if (timestampSec === null) return []

  return [{ lat, lng, timestampSec }]
}

function normalizeSemanticSegment(raw: Record<string, unknown>): NormalizedPoint[] {
  const points: NormalizedPoint[] = []

  const visit = raw.visit as Record<string, any> | undefined
  const placeLocation = visit?.topCandidate?.placeLocation
  const visitCoords = parseLatLngString(placeLocation?.latLng ?? placeLocation)
  const visitTime = toSeconds(raw.startTime)
  if (visitCoords && visitTime !== null) {
    points.push({ ...visitCoords, timestampSec: visitTime })
  }

  const activity = raw.activity as Record<string, any> | undefined
  if (activity) {
    const startCoords = parseLatLngString(activity.start?.latLng)
    const startTime = toSeconds(raw.startTime)
    if (startCoords && startTime !== null) {
      points.push({ ...startCoords, timestampSec: startTime })
    }

    const endCoords = parseLatLngString(activity.end?.latLng)
    const endTime = toSeconds(raw.endTime)
    if (endCoords && endTime !== null) {
      points.push({ ...endCoords, timestampSec: endTime })
    }
  }

  const timelinePath = raw.timelinePath
  if (Array.isArray(timelinePath)) {
    for (const step of timelinePath) {
      const coords = parseLatLngString(step?.point)
      const time = toSeconds(step?.time)
      if (coords && time !== null) {
        points.push({ ...coords, timestampSec: time })
      }
    }
  }

  return points
}

export function normalizeRecord(key: FormatKey, raw: unknown): NormalizedPoint[] {
  if (typeof raw !== 'object' || raw === null) return []
  const record = raw as Record<string, unknown>
  switch (key) {
    case 'locations':
      return normalizeLegacyLocation(record)
    case 'semanticSegments':
      return normalizeSemanticSegment(record)
    default:
      return []
  }
}
