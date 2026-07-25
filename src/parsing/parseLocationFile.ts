import { createArrayElementExtractor } from './jsonArrayStream'
import { FORMAT_KEYS, normalizeRecord, type FormatKey } from './googleLocationFormats'
import { LocationParseError, type ParseProgress, type ParsedPoints } from './types'

// Give up looking for a recognizable array key after this many bytes —
// a well-formed export always has one of FORMAT_KEYS very close to the
// start of the file, so if we haven't found it by here the file just isn't
// a Google location-history export.
const SEEK_LIMIT_BYTES = 4 * 1024 * 1024

export async function parseLocationFile(
  file: File,
  onProgress: (progress: ParseProgress) => void,
): Promise<ParsedPoints> {
  // Parallel primitive arrays ("structure of arrays") instead of an array of
  // {lat, lng, timestampSec} objects — pushing raw numbers avoids one object
  // allocation per point, which matters when a single export can contain
  // millions of raw GPS pings.
  const lats: number[] = []
  const lngs: number[] = []
  const timesSec: number[] = []
  const semanticLabels: (string | null)[] = []

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

    const points = normalizeRecord(extractor.matchedKey as FormatKey, parsed)
    if (points.length === 0) {
      recordsSkipped++
      return
    }
    for (const point of points) {
      lats.push(point.lat)
      lngs.push(point.lng)
      timesSec.push(point.timestampSec)
      semanticLabels.push(point.semanticLabel ?? null)
    }
  })

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

      if (extractor.isDone) break
    }

    const tail = decoder.decode() // flush any trailing buffered bytes
    if (tail) extractor.push(tail)
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
    semanticLabels,
    format: extractor.matchedKey,
    recordsSeen,
    recordsSkipped,
  }
}
