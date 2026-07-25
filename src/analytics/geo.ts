// Low-level geographic primitive shared by everything else in this module —
// clustering's neighbor queries, per-segment distances, day/journey
// aggregation all funnel through this one function. Isolating it here means
// there's exactly one place to point at in an interview and say "this is
// where distance is computed, everything above just calls it".

const EARTH_RADIUS_METERS = 6_371_000

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180
}

/**
 * Haversine great-circle distance between two lat/lng points, in meters.
 * Treats Earth as a sphere rather than the true oblate ellipsoid — the
 * resulting ~0.3% error is irrelevant at human travel scale (a few meters
 * of error per 100km), and it's dramatically simpler than an ellipsoidal
 * (Vincenty) formula for a difference that never matters here.
 */
export function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRadians(lat2 - lat1)
  const dLng = toRadians(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_METERS * c
}
