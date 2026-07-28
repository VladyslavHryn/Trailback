// Server-side Foursquare Places lookup. THE ONLY PLACE THE API KEY EXISTS.
//
// It is deliberately a plain function over Web-standard fetch, with no
// framework and no platform imports, so the same code backs both the
// serverless entry (api/place.ts) and the Vite dev middleware. A handler that
// only runs in production means `npm run dev` silently exercises a different
// code path than the deployed one, which is how "works locally" bugs are born.
//
// WHY THIS TIER EXISTS AT ALL. Nominatim answers "what is at this coordinate"
// from OpenStreetMap, which is excellent at streets and thin on businesses: a
// bank branch usually comes back as the street and house number it sits on.
// A venue database is the thing that names the branch, so it goes first and
// Nominatim stays as the free fallback.
//
// ENDPOINT AND AUTH WERE CONFIRMED BY PROBING, not from memory:
//   places-api.foursquare.com/places/search  with no version -> 400
//     {"message":"Please provide a valid version."}
//   ...with X-Places-Api-Version: 2025-06-17 and a bogus token -> 401
//     {"message":"Invalid request token."}      (so the scheme is Bearer)
//   ...2024-08-01 and 2025-01-01 are rejected, so the version is a specific
//   published date rather than any date.
// The older api.foursquare.com/v3/places/search still answers 401, i.e. it is
// alive but legacy; this uses the current host.

/** What the browser is allowed to learn. Note what is NOT here: the key. */
export interface PlaceLookupResult {
  /** Venue name as Foursquare knows it, e.g. "ПриватБанк". */
  name: string
  /**
   * A normalised category token ("bank", "coffee_shop"). Passed through as a
   * TOKEN and translated on the client, which already owns the mapping from
   * this vocabulary to Ukrainian labels for OpenStreetMap. Two tables would
   * drift, and the client's is the one the categories screen already reads.
   */
  type: string | null
  /** District, when Foursquare's location carries a neighbourhood. */
  district: string | null
}

const ENDPOINT = 'https://places-api.foursquare.com/places/search'

// Pinned, not "latest". Foursquare dates its API and rejects unknown values, so
// an unpinned request would start failing the day they retire this one — a
// silent fall back to Nominatim rather than an error anybody notices.
const API_VERSION = '2025-06-17'

// Cluster centres are already the mean of many pings, so the venue is
// essentially under the point. Slightly wider than the tightest useful value
// so city-block offsets in GPS (common in urban canyons) don't miss the
// building the cluster is clearly inside. Any wider and the nearest café
// starts beating the office building: radius is the primary quality lever.
const SEARCH_RADIUS_M = 80

// Only what is rendered. Asking for photos, hours or tips would pull payloads
// nothing displays.
const FIELDS = ['name', 'categories', 'distance', 'location'].join(',')

/**
 * Category tokens that describe geography rather than a venue. Foursquare is a
 * venue database so these are rare, but its taxonomy does contain entries like
 * neighbourhoods and roads, and returning one as a place name would be strictly
 * worse than Nominatim — which at least gives a street WITH a house number.
 * So they count as "nothing useful" and the caller falls through to the free
 * tier.
 */
const NON_VENUE_TYPES = new Set([
  'neighborhood',
  'neighbourhood',
  'city',
  'town',
  'village',
  'state',
  'country',
  'road',
  'street',
  'intersection',
  'postal_code',
  'region',
  'administrative_division',
])

/**
 * Foursquare names its categories for humans ("Coffee Shop", "Café"), while the
 * client's label table is keyed on machine tokens ("coffee_shop", "cafe") in
 * OpenStreetMap's vocabulary. This is the bridge: lowercase, strip diacritics
 * so "Café" and "Cafe" agree, and collapse everything else to underscores.
 */
function normaliseCategory(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const token = raw
    .normalize('NFD')
    // Combining marks, written as escapes: the literal range is invisible in a
    // diff and trivially corrupted by an editor or a codemod.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return token === '' ? null : token
}

interface FoursquareLocation {
  neighborhood?: string[] | string
}

/**
 * District from the venue's neighbourhood ONLY.
 *
 * Deliberately not `locality`, `region` or `admin_region`: for Kyiv those are
 * the city and the oblast, and feeding one of those into the districts screen
 * would collapse every place into a single bucket labelled "Kyiv" — which looks
 * like a working feature and is worse than no answer. When Foursquare has no
 * neighbourhood, this returns null and the caller fills the gap from Nominatim,
 * which is free and already knows Ukrainian district names.
 */
function districtFrom(location: FoursquareLocation | undefined): string | null {
  if (!location) return null
  const hood = location.neighborhood
  const value = Array.isArray(hood) ? hood[0] : hood
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

/**
 * Asks Foursquare what venue sits at this coordinate.
 *
 * Returns null for every "no useful answer" case — no key configured, network
 * or quota failure, no result, or a result that is only geography. The caller
 * cannot tell these apart on purpose: from the browser's point of view they all
 * mean the same thing, which is "use Nominatim instead". Distinguishing them
 * would leak whether a key is configured and whether it is working.
 */
export async function lookupPlace(
  lat: number,
  lng: number,
  apiKey: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<PlaceLookupResult | null> {
  if (!apiKey) return null

  const url =
    `${ENDPOINT}?ll=${encodeURIComponent(`${lat},${lng}`)}` +
    `&radius=${SEARCH_RADIUS_M}&limit=1&sort=DISTANCE&fields=${encodeURIComponent(FIELDS)}`

  let response: Response
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'X-Places-Api-Version': API_VERSION,
        'Accept-Language': 'uk',
      },
    })
  } catch {
    return null
  }

  if (!response.ok) return null

  let data: { results?: Array<Record<string, any>>; places?: Array<Record<string, any>> }
  try {
    data = (await response.json()) as typeof data
  } catch {
    return null
  }

  // `results` is what the current API returns; `places` is accepted too so a
  // rename upstream degrades to the fallback instead of throwing.
  const place = data.results?.[0] ?? data.places?.[0]
  if (!place) return null

  const name: unknown = place.name
  if (typeof name !== 'string' || name.trim() === '') return null

  const categories: Array<Record<string, any>> = Array.isArray(place.categories)
    ? place.categories
    : []

  // short_name first ("Coffee Shop" -> "Coffee Shop", but "Gym / Fitness
  // Center" is shorter and cleaner), falling back to the full name.
  const tokens = categories
    .map((c) => normaliseCategory(c?.short_name) ?? normaliseCategory(c?.name))
    .filter((t): t is string => t !== null)

  const venueToken = tokens.find((t) => !NON_VENUE_TYPES.has(t)) ?? null

  // Every category being geography is Foursquare telling us it matched an area,
  // not a business — exactly the case Nominatim already covers better.
  if (tokens.length > 0 && venueToken === null) return null

  return {
    name: name.trim(),
    type: venueToken,
    district: districtFrom(place.location),
  }
}
