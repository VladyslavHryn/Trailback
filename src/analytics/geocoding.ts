// Reverse-geocodes DBSCAN cluster CENTERS (not raw points) via Nominatim,
// OpenStreetMap's free geocoding service, to answer "what IS this place"
// (a name, a category) and "which district is it in" — spatial clustering
// alone only proves a place exists, it has no idea what it's called.
//
// This is the one place in the whole app that sends anything to a third
// party. Everything else (parsing, clustering, every other computation)
// stays entirely in the browser. What leaves the device here is a small,
// ROUNDED set of coordinates — the center of each of your top places
// (dozens, never the underlying raw pings) — sent one at a time, at
// Nominatim's own required pace of roughly one request per second, with
// every result cached so the same place is never looked up twice.

export interface GeocodedPlace {
  name: string
  /** Human-readable Ukrainian category label ("кафе", "парк", ...), or the
   * raw OSM type string if we don't have a translation for it. */
  category: string | null
  district: string | null
}

const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/reverse'
// Nominatim's usage policy caps the public instance at ~1 request/second;
// this pads it slightly rather than riding the limit exactly.
const MIN_REQUEST_INTERVAL_MS = 1100

// Maps common OSM amenity/leisure/shop types to a short Ukrainian label.
// Deliberately NOT exhaustive — see labelForCategory below for why an
// unrecognized type shows no category at all rather than a raw OSM string.
const CATEGORY_LABELS: Record<string, string> = {
  cafe: 'кафе',
  bar: 'бар',
  pub: 'паб',
  restaurant: 'ресторан',
  fast_food: 'фастфуд',
  university: 'університет',
  college: 'коледж',
  school: 'школа',
  kindergarten: 'дитсадок',
  park: 'парк',
  garden: 'парк',
  pitch: 'спортивний майданчик',
  stadium: 'стадіон',
  playground: 'дитячий майданчик',
  supermarket: 'супермаркет',
  convenience: 'магазин',
  mall: 'торговий центр',
  department_store: 'торговий центр',
  gym: 'спортзал',
  fitness_centre: 'спортзал',
  place_of_worship: 'місце поклоніння',
  hospital: 'лікарня',
  clinic: 'клініка',
  pharmacy: 'аптека',
  cinema: 'кінотеатр',
  theatre: 'театр',
  library: 'бібліотека',
  hotel: 'готель',
  office: 'офіс',
  bank: 'банк',
  hairdresser: 'перукарня',
  apartments: 'житловий будинок',
  house: 'житловий будинок',
}

// Only ever returns a CURATED label, never Nominatim's raw OSM type string.
// A point's nearest tagged feature is often something that isn't a
// meaningful "place category" at all — a road classification ("tertiary"),
// a stray bit of street furniture ("waste_basket") — showing that verbatim
// reads as OSM jargon, not an insight. No recognized match just means no
// category shown, which is more honest than making one up.
function labelForCategory(type: unknown): string | null {
  if (typeof type !== 'string' || type === '') return null
  return CATEGORY_LABELS[type] ?? null
}

function districtFromAddress(address: Record<string, string> | undefined): string | null {
  if (!address) return null
  return (
    address.city_district ??
    address.borough ??
    address.suburb ??
    address.neighbourhood ??
    address.quarter ??
    null
  )
}

// Cached by coordinate rounded to ~11m — re-running analytics on the same
// (or a barely-shifted) file never re-queries a place already looked up
// this session.
const cache = new Map<string, GeocodedPlace | null>()

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)}:${lng.toFixed(4)}`
}

async function reverseGeocodeOne(lat: number, lng: number): Promise<GeocodedPlace | null> {
  const key = cacheKey(lat, lng)
  if (cache.has(key)) return cache.get(key) ?? null

  const url =
    `${NOMINATIM_ENDPOINT}?format=jsonv2&lat=${lat}&lon=${lng}` +
    '&zoom=18&addressdetails=1&accept-language=uk'

  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!response.ok) {
      cache.set(key, null)
      return null
    }
    const data = await response.json()

    const roadName = [data.address?.road, data.address?.house_number].filter(Boolean).join(' ')
    const name: string =
      data.name || roadName || data.display_name?.split(',')[0] || 'Невідоме місце'

    const result: GeocodedPlace = {
      name,
      category: labelForCategory(data.type),
      district: districtFromAddress(data.address),
    }
    cache.set(key, result)
    return result
  } catch {
    cache.set(key, null)
    return null
  }
}

export interface GeocodeProgress {
  completed: number
  total: number
}

export interface GeocodeTarget {
  clusterId: number
  lat: number
  lng: number
}

/**
 * Reverse-geocodes the given cluster centers one at a time, respecting
 * Nominatim's rate limit. Places that fail or have no resolvable address
 * are simply omitted from the returned map (not included as null entries).
 */
export async function geocodePlaceCenters(
  targets: GeocodeTarget[],
  onProgress?: (progress: GeocodeProgress) => void,
): Promise<Map<number, GeocodedPlace>> {
  const results = new Map<number, GeocodedPlace>()

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i]
    const geocoded = await reverseGeocodeOne(target.lat, target.lng)
    if (geocoded) results.set(target.clusterId, geocoded)
    onProgress?.({ completed: i + 1, total: targets.length })

    if (i < targets.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS))
    }
  }

  return results
}

// Google's own semantic label (see parsing/googleLocationFormats.ts) is
// preferred over a geocoded name when present — it's free, instant (no
// network round-trip), and Google already knows it's specifically YOUR
// home/work, which Nominatim has no way to know.
// Keys are Google's values as a CURRENT export writes them: SCREAMING_SNAKE
// (HOME, INFERRED_WORK). This map used to be keyed on title case ("Home",
// "Inferred Work"), which matched nothing at all in a real file — on the
// reference export that silently cost every one of its 63 HOME and 11
// INFERRED_WORK labels, and the places they belonged to fell back to a
// reverse-geocoded street name.
const SEMANTIC_LABEL_UK: Record<string, string> = {
  HOME: 'Дім',
  WORK: 'Робота',
  INFERRED_HOME: 'Дім (ймовірно)',
  INFERRED_WORK: 'Робота (ймовірно)',
  SCHOOL: 'Навчання',
  INFERRED_SCHOOL: 'Навчання (ймовірно)',
}

/**
 * Returns null for anything unrecognised rather than the raw string. A
 * leaked `SEARCHED_ADDRESS` on a screen headed "your places" reads as a bug,
 * and the caller already has a better fallback: the geocoded name.
 */
export function translateSemanticLabel(label: string): string | null {
  return SEMANTIC_LABEL_UK[label.toUpperCase()] ?? null
}
