// Total-distance computations: how far you moved in total (split by an
// inferred mode of travel), which single calendar day covered the most
// ground, and the longest unbroken journey in the whole history. Every
// number here comes from one linear pass over consecutive, time-sorted
// points — see sortPointsByTime.ts, which is a precondition callers must
// apply first.

import { haversineDistanceMeters } from './geo'
import { movementPoints } from '../parsing/selectPoints'
import type { ParsedPoints, TravelMode } from '../parsing/types'

export type { TravelMode }

export interface JourneyStat {
  km: number
  durationSec: number
  startSec: number
  endSec: number
}

export interface DistanceStats {
  totalKmByMode: Record<TravelMode, number>
  farthestDay: { dateISO: string; km: number } | null
  longestJourney: JourneyStat | null
  /** True when the mode split came from Google's own activity labels rather
   * than from the speed heuristic — the UI says so, because the two are not
   * equally trustworthy. */
  modesFromGoogle: boolean
}

// Google's raw location pings don't reliably carry its own activity-
// detection labels, so "how did you cover this stretch" is inferred from
// implied speed between consecutive pings. This is a heuristic, not ground
// truth — a bus stuck in traffic can read as "walking", GPS jitter while
// standing still can read as a few km/h of "driving" — but it's accurate
// in aggregate across a whole history, which is all these totals need.
const WALK_MAX_KMH = 7
const TRANSIT_MAX_KMH = 30

// Anything implying a faster speed than this is treated as a bad GPS fix
// (teleporting you a few km in a few seconds) or an untracked mode like a
// flight, and excluded from every total below. Under-counting a real trip
// is a smaller error than reporting a fictional 900 km/h "drive".
const MAX_PLAUSIBLE_KMH = 200

// A gap longer than this between two consecutive pings ends the current
// "journey" — long enough that you evidently stopped somewhere, so
// whatever comes after is a new trip rather than a continuation of the
// last one.
const JOURNEY_GAP_SEC = 25 * 60

// A journey ALSO ends the moment you stop actually moving, even if pings
// keep arriving on schedule — an app that pings every 10 minutes whether
// you're walking or asleep never produces a time gap while you're at home
// all night, so a gap-only rule would stitch an entire evening of standing
// still onto the end of a real trip as if it were still part of it. This
// threshold is deliberately just above GPS jitter (a stationary phone can
// drift a few meters between fixes) so genuine slow walking still counts
// as movement.
const STATIONARY_KMH = 1.5

function classifyMode(kmh: number): TravelMode {
  if (kmh <= WALK_MAX_KMH) return 'walk'
  if (kmh <= TRANSIT_MAX_KMH) return 'transit'
  return 'drive'
}

function emptyModeTotals(): Record<TravelMode, number> {
  return { walk: 0, transit: 0, drive: 0, other: 0 }
}

/**
 * Precondition: `points` is sorted by timestampSec ascending.
 *
 * THE DISTANCES AND THE JOURNEYS COME FROM DIFFERENT PLACES, on purpose.
 *
 * When the export carries `activity` segments (every modern Timeline export
 * does), the mode split is taken from them: Google states both the mode and
 * the distance it actually covered, and both are strictly better than what
 * this file can infer. The speed heuristic below cannot tell a bus in
 * traffic from a brisk walk, and on the reference export it put 100% of the
 * kilometres into "walking" — the summary screen read 4,023 km on foot and
 * zero by any other means, which is nonsense on a history full of labelled
 * subway and bus rides.
 *
 * The per-day maximum and the longest journey still come from the point
 * stream, because they are questions about the timeline's shape rather than
 * about totals, and activities alone are too sparse to answer them.
 *
 * The heuristic remains the fallback for the legacy `locations` export,
 * which carries no activity labels at all.
 */
export function computeDistanceStats(rawPoints: ParsedPoints): DistanceStats {
  // Visit samples sit at one coordinate by construction, so they contribute
  // no distance — but they DO sit between two real fixes and would break a
  // journey in half and distort the implied speed on either side of it.
  const points = movementPoints(rawPoints)

  const n = points.lat.length
  const totalKmByMode = emptyModeTotals()
  const kmByDate = new Map<string, number>()

  const activities = rawPoints.activities
  const modesFromGoogle = activities.length > 0
  if (modesFromGoogle) {
    for (const activity of activities) {
      totalKmByMode[activity.mode] += activity.distanceMeters / 1000
    }
  }

  let journeyStartSec = n > 0 ? points.timestampSec[0] : 0
  let journeyKm = 0
  let bestJourney: JourneyStat | null = null

  const closeJourney = (endSec: number) => {
    if (journeyKm > 0 && (!bestJourney || journeyKm > bestJourney.km)) {
      bestJourney = {
        km: journeyKm,
        durationSec: endSec - journeyStartSec,
        startSec: journeyStartSec,
        endSec,
      }
    }
  }

  for (let i = 1; i < n; i++) {
    const dtSec = points.timestampSec[i] - points.timestampSec[i - 1]
    if (dtSec <= 0) continue // duplicate or out-of-order timestamp, skip

    const distMeters = haversineDistanceMeters(
      points.lat[i - 1],
      points.lng[i - 1],
      points.lat[i],
      points.lng[i],
    )
    const km = distMeters / 1000
    const kmh = km / (dtSec / 3600)

    if (dtSec > JOURNEY_GAP_SEC || kmh < STATIONARY_KMH) {
      closeJourney(points.timestampSec[i - 1])
      journeyStartSec = points.timestampSec[i]
      journeyKm = 0
    }

    if (kmh > MAX_PLAUSIBLE_KMH) continue // glitch or flight — don't count it

    if (!modesFromGoogle) totalKmByMode[classifyMode(kmh)] += km
    if (kmh >= STATIONARY_KMH) journeyKm += km

    const dateISO = new Date(points.timestampSec[i] * 1000).toISOString().slice(0, 10)
    kmByDate.set(dateISO, (kmByDate.get(dateISO) ?? 0) + km)
  }
  if (n > 0) closeJourney(points.timestampSec[n - 1])

  let farthestDay: DistanceStats['farthestDay'] = null
  for (const [dateISO, km] of kmByDate) {
    if (!farthestDay || km > farthestDay.km) farthestDay = { dateISO, km }
  }

  // Google's own "you travelled far" memories beat anything reconstructed
  // from the track: a trip it flagged carries a stated distance from home,
  // whereas the journey above is only the longest unbroken run of pings,
  // which a single dropped fix can cut in half.
  let longestJourney = bestJourney as JourneyStat | null
  for (const trip of rawPoints.trips) {
    if (!longestJourney || trip.distanceFromOriginKm > longestJourney.km) {
      longestJourney = {
        km: trip.distanceFromOriginKm,
        durationSec: trip.endSec - trip.startSec,
        startSec: trip.startSec,
        endSec: trip.endSec,
      }
    }
  }

  return { totalKmByMode, farthestDay, longestJourney, modesFromGoogle }
}
