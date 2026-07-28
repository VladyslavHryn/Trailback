// The HTTP shape of /api/place, as a Web-standard Request -> Response function.
//
// Framework-free for the same reason placeLookup is: this exact function serves
// both the deployed serverless entry and the Vite dev middleware, so local and
// production cannot drift apart.

import { lookupPlace, type PlaceLookupResult } from './placeLookup.js'

/** Coordinates are rounded to ~11 m before they are used or forwarded.
 *
 * Two reasons, and the second is the one that matters. It matches the client's
 * cache key, so the same place asked twice is one upstream call. And it is the
 * privacy floor the product promises: a cluster centre is already an average of
 * many pings, and this makes sure nothing sharper than a street corner is
 * forwarded to Foursquare even if a caller sends full precision. */
const COORD_DECIMALS = 4

export interface PlaceResponseBody {
  /** `null` means "no useful answer, use the free fallback" — never an error. */
  place: PlaceLookupResult | null
}

function json(body: PlaceResponseBody, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // A result for a rounded coordinate is stable, and this is a paid call:
      // let any CDN in front of the function absorb repeats.
      'Cache-Control': 'public, max-age=86400, s-maxage=604800',
    },
  })
}

function parseCoord(raw: string | null, limit: number): number | null {
  if (raw === null) return null
  const value = Number(raw)
  if (!Number.isFinite(value) || Math.abs(value) > limit) return null
  return Number(value.toFixed(COORD_DECIMALS))
}

/**
 * Handles one lookup.
 *
 * NOTE ON FAILURE MODES. Everything that is not a malformed request answers
 * `{ place: null }` with a 200, including "no API key configured" and "Foursquare
 * refused us". The browser's correct reaction is identical in all of them —
 * fall back to Nominatim — and an endpoint that reported the difference would
 * be telling anyone who asks whether a key exists and whether billing is live.
 */
export async function handlePlaceRequest(
  request: Request,
  env: { FOURSQUARE_API_KEY?: string },
): Promise<Response> {
  if (request.method !== 'GET') {
    return json({ place: null }, 405)
  }

  const url = new URL(request.url)
  const lat = parseCoord(url.searchParams.get('lat'), 90)
  const lng = parseCoord(url.searchParams.get('lng'), 180)

  // A bad request IS distinguishable, because it is the caller's own bug rather
  // than anything about our configuration.
  if (lat === null || lng === null) {
    return json({ place: null }, 400)
  }

  const place = await lookupPlace(lat, lng, env.FOURSQUARE_API_KEY)
  return json({ place })
}
