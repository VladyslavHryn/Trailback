import { createArrayElementExtractor, createObjectCapture } from './jsonArrayStream'
import { FORMAT_KEYS, normalizeRecord, parseLatLng, type FormatKey } from './googleLocationFormats'
import {
  LocationParseError,
  type ActivityRecord,
  type FrequentPlace,
  type ParseProgress,
  type ParsedPoints,
  type TripRecord,
} from './types'

// Give up looking for a recognizable array key after this many bytes —
// a well-formed export always has one of FORMAT_KEYS very close to the
// start of the file, so if we haven't found it by here the file just isn't
// a Google location-history export.
const SEEK_LIMIT_BYTES = 4 * 1024 * 1024

// The one top-level object worth reading besides the segments themselves.
// `rawSignals`, the other sibling, is deliberately never touched: thousands
// of low-level activity samples with confidence scores, too noisy to drive
// any figure this product shows.
const PROFILE_KEY = 'userLocationProfile'

/** Pulls the HOME/WORK-labelled places out of a captured profile object. */
function readFrequentPlaces(profileJson: string): FrequentPlace[] {
  let profile: any
  try {
    profile = JSON.parse(profileJson)
  } catch {
    // A profile we can't read costs labels, not the parse.
    return []
  }

  const raw = profile?.frequentPlaces
  if (!Array.isArray(raw)) return []

  const places: FrequentPlace[] = []
  for (const entry of raw) {
    const coords = parseLatLng(entry?.placeLocation?.latLng ?? entry?.placeLocation)
    if (!coords) continue
    const label = typeof entry?.label === 'string' && entry.label.trim() !== ''
      ? entry.label.trim().toUpperCase()
      : null
    places.push({ ...coords, label })
  }
  return places
}

export async function parseLocationFile(
  file: File,
  onProgress: (progress: ParseProgress) => void,
): Promise<ParsedPoints> {
  // Parallel primitive arrays ("structure of arrays") instead of an array of
  // {lat, lng, timestampSec} objects. For a multi-hundred-MB export with
  // millions of points, one JS object per point costs far more memory than
  // flat numeric buffers.
  const lats: number[] = []
  const lngs: number[] = []
  const timesSec: number[] = []
  const sources: number[] = []
  const semanticLabels: (string | null)[] = []

  // Whole records rather than points — see ActivityRecord for why the
  // distance must come from Google's own figure.
  const activities: ActivityRecord[] = []
  const trips: TripRecord[] = []

  let recordsSeen = 0
  let recordsSkipped = 0

  // `onElement` fires synchronously from inside extractor.push() — often for
  // hundreds of records within the very first call, the moment the array key
  // is found. Reading `extractor.matchedKey` directly (rather than a local
  // variable only updated after push() returns) is what makes the key
  // available to every record from the first one, not just ones processed
  // in later chunks.
  const extractor = createArrayElementExtractor(FORMAT_KEYS, (rawJson) => {
    recordsSeen++

    let parsed: unknown
    try {
      parsed = JSON.parse(rawJson)
    } catch {
      recordsSkipped++
      return
    }

    const record = normalizeRecord(extractor.matchedKey as FormatKey, parsed)

    if (record.activity) activities.push(record.activity)
    if (record.trip) trips.push(record.trip)

    if (record.points.length === 0) {
      // A segment can legitimately carry no coordinates at all (a memory is
      // the clearest case) and still have contributed above, so it only
      // counts as skipped when it yielded nothing whatsoever.
      if (!record.activity && !record.trip) recordsSkipped++
      return
    }

    for (const point of record.points) {
      lats.push(point.lat)
      lngs.push(point.lng)
      timesSec.push(point.timestampSec)
      sources.push(point.source)
      semanticLabels.push(point.semanticLabel ?? null)
    }
  })

  const profileCapture = createObjectCapture(PROFILE_KEY)

  const totalBytes = file.size
  let bytesRead = 0

  const reader = file.stream().getReader()
  // `{ stream: true }` lets the decoder hold back a partial multi-byte
  // character at a chunk boundary instead of emitting a replacement char.
  const decoder = new TextDecoder('utf-8')

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break

      bytesRead += value.byteLength
      const text = decoder.decode(value, { stream: true })
      extractor.push(text)

      // Only the Timeline export has a profile, and only it is worth reading
      // past the end of the segments for. A legacy Records.json has no
      // profile, so it still stops the moment its array closes rather than
      // streaming through hundreds of megabytes for nothing.
      const wantsProfile = extractor.matchedKey === 'semanticSegments'
      if (wantsProfile) profileCapture.push(text)

      if (!extractor.matchedKey && bytesRead > SEEK_LIMIT_BYTES) {
        throw new LocationParseError(
          'unrecognized-format',
          'Не вдалося розпізнати формат файлу. Переконайся, що це Records.json або Timeline JSON з Google Takeout.',
        )
      }

      onProgress({
        bytesRead,
        totalBytes,
        recordsSeen,
        recordsSkipped,
        pointsFound: lats.length,
      })

      if (extractor.isDone && (!wantsProfile || profileCapture.isDone)) break
    }

    const tail = decoder.decode() // flush any trailing buffered bytes
    if (tail) {
      extractor.push(tail)
      if (extractor.matchedKey === 'semanticSegments') profileCapture.push(tail)
    }
  } finally {
    reader.releaseLock()
  }

  if (!extractor.matchedKey) {
    throw new LocationParseError(
      'unrecognized-format',
      'Не вдалося розпізнати формат файлу. Переконайся, що це Records.json або Timeline JSON з Google Takeout.',
    )
  }

  if (lats.length === 0) {
    throw new LocationParseError(
      'no-points-found',
      'У файлі не знайдено жодної точки з координатами. Спробуй інший експорт.',
    )
  }

  return {
    lat: Float64Array.from(lats),
    lng: Float64Array.from(lngs),
    // Seconds (not ms) since epoch, fits Uint32 until year 2106 — halves the
    // memory of a timestamp column compared to storing milliseconds as
    // float64, which adds up across millions of points.
    timestampSec: Uint32Array.from(timesSec),
    sources: Uint8Array.from(sources),
    semanticLabels,
    activities,
    trips,
    frequentPlaces: profileCapture.captured
      ? readFrequentPlaces(profileCapture.captured)
      : [],
    format: extractor.matchedKey,
    recordsSeen,
    recordsSkipped,
  }
}
