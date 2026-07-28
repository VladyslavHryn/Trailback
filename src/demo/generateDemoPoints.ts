// Synthetic Google Timeline data for the demo mode.
//
// Generates two years of Kyiv location history and feeds it to the REAL
// analytics engine — stay detection, DBSCAN, distance stats, geocoding — so
// the demo story is produced by exactly the same pipeline a real Takeout file
// goes through. Nothing here is a fixture of pre-computed answers.
//
// WHY SYNTHETIC RATHER THAN BAKED. A baked JSON fixture would have to be
// maintained whenever the ParsedPoints schema changes, and would ship a few MB
// of dead weight. A generator produces a fresh, schema-correct object at
// runtime and can be tuned without touching the analytics code.
//
// WHAT THE GENERATOR HAS TO GET RIGHT, and why each one is not cosmetic:
//
//   1. LOCAL TIME. The time-of-day and weekday charts read timestamps in the
//      viewer's timezone. Building them by adding hours to a UTC epoch — as
//      this file used to — shifted the whole day by the UTC offset, so the
//      demo's "busiest hour" measured 10:00 for a person who leaves at 08:00,
//      and the evening spilled past midnight into the next day's column. Every
//      clock time here is therefore constructed through a local `Date`, which
//      also makes the two DST changes a year handle themselves.
//
//   2. A REAL NIGHT. Time is credited to a place only while pings actually
//      arrive there (stayPoints.ts ends a stay at any gap over two hours). A
//      history that goes dark from 23:00 to 09:00 therefore never credits
//      anyone with sleeping at home — which is why the old demo ranked WORK
//      above HOME at 5.5 h/day, roughly half of a real figure.
//
//   3. MOVEMENT ALONG REAL CORRIDORS. The heatmap and the route layer are
//      drawn from movement points only (see selectPoints.ts). Straight lines
//      between two endpoints, sampled four times, gave those two layers almost
//      nothing to draw. Commutes here follow polylines traced along the actual
//      metro and rail corridors, sampled about every 75 seconds.
//
//   4. A SHAPE OVER TIME. A history where every week is identical has no story
//      in it: no place is ever new or abandoned, the monthly footprint is a
//      dead-flat line, and the longest journey of two years is a 6 km commute.
//      So this history contains a job move across the river and two holidays
//      out of the city.

import { POINT_SOURCE, type ParsedPoints, type FrequentPlace } from '../parsing/types'

// ── Places ──────────────────────────────────────────────────────────────────
//
// Real coordinates, deliberately spread across separate Kyiv districts: the
// districts screen groups places by the район reverse-geocoding reports, so a
// history confined to one district renders a single bar and says nothing.

type Spot = { lat: number; lng: number }

// Several of these are pinned to a coordinate whose nearest OpenStreetMap
// feature actually carries a TYPE (mall, restaurant, pitch), rather than to
// the geometric middle of the venue. The categories screen is built from what
// reverse geocoding reports, and in Kyiv the nearest tagged feature at zoom 18
// is very often a bench, a waste bin or an untyped building — verified by
// probing each coordinate below. Picking the typed one costs nothing and is
// the difference between that screen listing four categories and two.
const HOME       : Spot = { lat: 50.4068, lng: 30.6278 } // Позняки, Дарницький
const GYM        : Spot = { lat: 50.4051, lng: 30.6212 } // поруч із домом
const MALL       : Spot = { lat: 50.4128, lng: 30.5216 } // ТРЦ Ocean Plaza, Голосіївський
const WORK_OLD   : Spot = { lat: 50.4381, lng: 30.5192 } // Бессарабська, Печерський
const CAFE_OLD   : Spot = { lat: 50.4406, lng: 30.5229 } // обід поруч зі старою роботою
const WORK_NEW   : Spot = { lat: 50.4657, lng: 30.5158 } // Контрактова, Подільський
const CAFE_NEW   : Spot = { lat: 50.4634, lng: 30.5187 } // обід поруч із новою роботою
const PARK       : Spot = { lat: 50.4131, lng: 30.5571 } // Труханів острів, Дніпровський
const CINEMA     : Spot = { lat: 50.4469, lng: 30.5223 } // Хрещатик, Шевченківський
const FRIENDS    : Spot = { lat: 50.5088, lng: 30.5171 } // Оболонь, Оболонський
const STATION    : Spot = { lat: 50.4400, lng: 30.4890 } // вокзал, Солом'янський
const LVIV_HOTEL : Spot = { lat: 49.8412, lng: 24.0303 } // Середмістя
const LVIV_CAFE  : Spot = { lat: 49.8395, lng: 24.0301 }
const BUKOVEL    : Spot = { lat: 48.3628, lng: 24.4090 }

// ── Corridors ───────────────────────────────────────────────────────────────
//
// Waypoints traced along the routes these journeys really follow — the green
// metro line down the left bank, the blue line north to Podil, the Kyiv–Lviv
// railway. Travel is interpolated ALONG these, so the heatmap and route layer
// show the shape of the city instead of chords across it.

type Path = Spot[]

/** Позняки → центр: зелена гілка метро. */
const METRO_GREEN: Path = [
  HOME,
  { lat: 50.3963, lng: 30.6151 }, // Осокорки
  { lat: 50.3922, lng: 30.5944 }, // Славутич
  { lat: 50.4034, lng: 30.5679 }, // Видубичі
  { lat: 50.4107, lng: 30.5580 }, // Дружби народів
  { lat: 50.4270, lng: 30.5376 }, // Печерська
  { lat: 50.4367, lng: 30.5301 }, // Кловська
  { lat: 50.4384, lng: 30.5218 }, // Палац спорту
  WORK_OLD,
]

/** Позняки → Поділ: зелена до Хрещатика, далі синя на північ. */
const TO_PODIL: Path = [
  ...METRO_GREEN.slice(0, 8),
  { lat: 50.4470, lng: 30.5230 }, // Хрещатик
  { lat: 50.4500, lng: 30.5245 }, // Майдан Незалежності
  { lat: 50.4592, lng: 30.5266 }, // Поштова площа
  WORK_NEW,
]

const TO_PARK: Path = [
  HOME,
  { lat: 50.4090, lng: 30.5900 },
  { lat: 50.4140, lng: 30.5700 },
  PARK,
]

/** Позняки → Ocean Plaza: зелена гілка до Видубичів, далі на захід. */
const TO_MALL: Path = [
  HOME,
  { lat: 50.3963, lng: 30.6151 }, // Осокорки
  { lat: 50.3922, lng: 30.5944 }, // Славутич
  { lat: 50.4034, lng: 30.5679 }, // Видубичі
  { lat: 50.4126, lng: 30.5313 }, // Либідська
  MALL,
]

const TO_CINEMA: Path = [...METRO_GREEN.slice(0, 8), CINEMA]

const TO_FRIENDS: Path = [
  ...TO_PODIL,
  { lat: 50.4870, lng: 30.4980 },
  { lat: 50.5013, lng: 30.4983 }, // Оболонь
  FRIENDS,
]

const TO_STATION: Path = [
  ...METRO_GREEN.slice(0, 8),
  { lat: 50.4419, lng: 30.5030 }, // Театральна / Університет
  STATION,
]

/** Залізниця Київ → Львів. */
const RAIL_LVIV: Path = [
  STATION,
  { lat: 50.0770, lng: 29.9100 }, // Фастів
  { lat: 49.7100, lng: 28.8300 }, // Козятин
  { lat: 49.4200, lng: 26.9870 }, // Хмельницький
  { lat: 49.5535, lng: 25.5948 }, // Тернопіль
  LVIV_HOTEL,
]

/** Київ → Буковель: поїзд до Івано-Франківська, далі дорогою в гори. */
const RAIL_BUKOVEL: Path = [
  STATION,
  { lat: 50.0770, lng: 29.9100 },
  { lat: 49.7100, lng: 28.8300 },
  { lat: 49.2330, lng: 28.4680 }, // Вінниця
  { lat: 49.4200, lng: 26.9870 },
  { lat: 49.5535, lng: 25.5948 },
  { lat: 48.9226, lng: 24.7111 }, // Івано-Франківськ
  BUKOVEL,
]

// ── Sampling cadences ───────────────────────────────────────────────────────
//
// How often the imaginary phone reports. These are the numbers that decide
// whether the analytics engine sees what it is supposed to see, so each is
// pinned to a threshold in the engine rather than picked for looks:
//
//   NIGHT_PING_SEC stays under stayPoints.ts's two-hour MAX_INTERNAL_GAP_SEC,
//   so a night at home is ONE stay rather than nine unattributed fragments.
//
//   MOVE_PING_SEC is short enough to draw a continuous corridor, and long
//   enough that consecutive fixes are hundreds of metres apart — a denser
//   trail would sit inside stayPoints.ts's 100 m radius long enough to be
//   mistaken for standing still.
//
//   RAIL_PING_SEC stays under distanceStats.ts's 25-minute JOURNEY_GAP_SEC, or
//   a 550 km train ride would be chopped into dozens of separate "journeys"
//   and the longest journey of the whole history would go back to being a
//   commute.
const NIGHT_PING_SEC = 50 * 60
const REST_PING_SEC = 12 * 60
const MOVE_PING_SEC = 75
const RAIL_PING_SEC = 8 * 60

/** Before this hour and after NIGHT_ENDS_HOUR, a parked phone reports rarely. */
const NIGHT_STARTS_HOUR = 23
const NIGHT_ENDS_HOUR = 7

// ── Timeline ────────────────────────────────────────────────────────────────

const TOTAL_DAYS = 730

/** Day index on which the job — and with it the commute — moves to Podil. */
const JOB_CHANGE_DAY = 430

interface Holiday {
  startDay: number
  nights: number
  outbound: Path
  base: Spot
  /** Somewhere nearby that gets visited most days, so the trip has two places. */
  nearby: Spot
  /** Hours the outbound leg takes; the return leg mirrors it. */
  travelHours: number
}

const HOLIDAYS: Holiday[] = [
  { startDay: 210, nights: 9, outbound: RAIL_LVIV, base: LVIV_HOTEL, nearby: LVIV_CAFE, travelHours: 6.5 },
  { startDay: 575, nights: 8, outbound: RAIL_BUKOVEL, base: BUKOVEL, nearby: BUKOVEL, travelHours: 9 },
]

// ── Deterministic RNG ───────────────────────────────────────────────────────
//
// Seeded so the demo is byte-identical between runs: a story whose numbers
// changed on every reload would be impossible to talk about or screenshot.

let _seed = 0x9e3779b9

function resetRng(): void {
  _seed = 0x9e3779b9
}

/** mulberry32 — small, fast, and good enough for jitter. */
function rng(): number {
  _seed |= 0
  _seed = (_seed + 0x6d2b79f5) | 0
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

function chance(p: number): boolean {
  return rng() < p
}

function jitter(v: number, radius: number): number {
  return v + (rng() - 0.5) * 2 * radius
}

// ── Emitting points ─────────────────────────────────────────────────────────

type RawPt = { lat: number; lng: number; sec: number; source: 0 | 1; label: string | null }

/**
 * Epoch seconds for a clock time on a given local day.
 *
 * Goes through `setMinutes` on a local `Date` rather than adding hours to a
 * midnight epoch: that keeps the result correct on the two DST changeover days
 * a year, and lets `hours` run past 24 to mean "early next morning".
 */
function clockSec(day: Date, hours: number): number {
  const d = new Date(day.getFullYear(), day.getMonth(), day.getDate())
  d.setMinutes(Math.round(hours * 60))
  return Math.floor(d.getTime() / 1000)
}

function addDays(day: Date, n: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() + n)
}

/**
 * Presence pings at one spot for a span of time.
 *
 * The cadence follows the clock: a phone sitting on a nightstand reports far
 * less often than one being carried around, and the difference is what makes
 * the hour-of-day histogram look like a person's day rather than a square wave.
 */
function stay(
  out: RawPt[],
  spot: Spot,
  fromSec: number,
  toSec: number,
  label: string | null = null,
): void {
  let t = fromSec
  while (t <= toSec) {
    const hour = new Date(t * 1000).getHours()
    const asleep = hour >= NIGHT_STARTS_HOUR || hour < NIGHT_ENDS_HOUR
    out.push({
      lat: jitter(spot.lat, 0.00015),
      lng: jitter(spot.lng, 0.00015),
      sec: t,
      source: POINT_SOURCE.visit,
      label,
    })
    t += Math.round((asleep ? NIGHT_PING_SEC : REST_PING_SEC) * (0.85 + rng() * 0.3))
  }
}

/** Cumulative along-path distance, in the flat degree-space used for interpolation. */
function pathLengths(path: Path): number[] {
  const cumulative = [0]
  for (let i = 1; i < path.length; i++) {
    const dLat = path[i].lat - path[i - 1].lat
    // Longitude degrees are shorter than latitude ones; at Kyiv's latitude by
    // about a third. Without this the interpolation would crawl through
    // east–west stretches and race through north–south ones.
    const dLng = (path[i].lng - path[i - 1].lng) * 0.64
    cumulative.push(cumulative[i - 1] + Math.hypot(dLat, dLng))
  }
  return cumulative
}

/** The point `fraction` of the way along `path`, by distance. */
function alongPath(path: Path, cumulative: number[], fraction: number): Spot {
  const target = fraction * cumulative[cumulative.length - 1]
  let i = 1
  while (i < cumulative.length - 1 && cumulative[i] < target) i++
  const segment = cumulative[i] - cumulative[i - 1] || 1
  const t = (target - cumulative[i - 1]) / segment
  return {
    lat: path[i - 1].lat + t * (path[i].lat - path[i - 1].lat),
    lng: path[i - 1].lng + t * (path[i].lng - path[i - 1].lng),
  }
}

/**
 * Movement pings along a corridor at constant pace.
 *
 * `reverse` walks the same waypoints home again rather than needing a second
 * array — the trail back overlaps the trail out, which is exactly what a real
 * commute does and is what gives those corridors their weight on the heatmap.
 */
function travel(
  out: RawPt[],
  path: Path,
  fromSec: number,
  toSec: number,
  { reverse = false, cadenceSec = MOVE_PING_SEC } = {},
): void {
  const cumulative = pathLengths(path)
  const span = Math.max(toSec - fromSec, 1)
  const steps = Math.max(2, Math.round(span / cadenceSec))

  for (let s = 0; s <= steps; s++) {
    const f = s / steps
    const spot = alongPath(path, cumulative, reverse ? 1 - f : f)
    out.push({
      lat: jitter(spot.lat, 0.00035),
      lng: jitter(spot.lng, 0.00045),
      sec: fromSec + Math.round(f * span),
      source: POINT_SOURCE.movement,
      label: null,
    })
  }
}

// ── Day shapes ──────────────────────────────────────────────────────────────

/** A workday: home → office → (lunch out) → office → home, plus an optional gym. */
function emitWorkday(out: RawPt[], day: Date, dayIndex: number): void {
  const movedJobs = dayIndex >= JOB_CHANGE_DAY
  const work = movedJobs ? WORK_NEW : WORK_OLD
  const cafe = movedJobs ? CAFE_NEW : CAFE_OLD
  const commute = movedJobs ? TO_PODIL : METRO_GREEN
  // Podil is further out, so the commute genuinely got longer — visible later
  // as a change in the monthly footprint rather than stated anywhere.
  const commuteHours = movedJobs ? 0.9 : 0.75

  // Both ends of the day are drawn from a wide window rather than a narrow
  // one, because nobody leaves the house at the same minute every morning and
  // the charts read the difference. A phone reports far more often in motion
  // than at rest, so an hour containing a commute collects several times the
  // pings of an hour spent sitting still; with a fixed departure, all ~500
  // commutes landed in the same single column.
  //
  // The morning and evening peaks that remain are real and should stay: they
  // are the hours this person is genuinely most in motion, which is exactly
  // what the "твій пік" line claims.
  const leave = 7.7 + rng() * 1.1
  const leaveWork = 17.6 + rng() * 1.3

  stay(out, HOME, clockSec(day, 0), clockSec(day, leave), 'HOME')
  travel(out, commute, clockSec(day, leave), clockSec(day, leave + commuteHours))

  const arrive = leave + commuteHours
  const lunchAt = 13 + rng() * 0.5

  if (chance(0.55)) {
    stay(out, work, clockSec(day, arrive), clockSec(day, lunchAt), 'INFERRED_WORK')
    travel(out, [work, cafe], clockSec(day, lunchAt), clockSec(day, lunchAt + 0.15))
    stay(out, cafe, clockSec(day, lunchAt + 0.15), clockSec(day, lunchAt + 0.9))
    travel(out, [work, cafe], clockSec(day, lunchAt + 0.9), clockSec(day, lunchAt + 1.05), {
      reverse: true,
    })
    stay(out, work, clockSec(day, lunchAt + 1.05), clockSec(day, leaveWork), 'INFERRED_WORK')
  } else {
    stay(out, work, clockSec(day, arrive), clockSec(day, leaveWork), 'INFERRED_WORK')
  }

  travel(out, commute, clockSec(day, leaveWork), clockSec(day, leaveWork + commuteHours), {
    reverse: true,
  })

  const homeAgain = leaveWork + commuteHours

  if (chance(0.38)) {
    // Gym, two evenings a week or so. Every time below is relative to getting
    // home rather than absolute: the working day now ends anywhere in a
    // 1.3-hour window, so a fixed 19:40 departure would run BEFORE the arrival
    // it is supposed to follow on the late days.
    const out1 = homeAgain + 0.6
    stay(out, HOME, clockSec(day, homeAgain), clockSec(day, out1), 'HOME')
    travel(out, [HOME, GYM], clockSec(day, out1), clockSec(day, out1 + 0.2))
    stay(out, GYM, clockSec(day, out1 + 0.2), clockSec(day, out1 + 1.5))
    travel(out, [HOME, GYM], clockSec(day, out1 + 1.5), clockSec(day, out1 + 1.7), {
      reverse: true,
    })
    stay(out, HOME, clockSec(day, out1 + 1.7), clockSec(day, 23.9), 'HOME')
  } else if (chance(0.12)) {
    // A film in the centre — the only reason Shevchenkivskyi appears at all.
    travel(out, TO_CINEMA, clockSec(day, homeAgain), clockSec(day, homeAgain + 0.7))
    stay(out, CINEMA, clockSec(day, homeAgain + 0.7), clockSec(day, homeAgain + 3))
    travel(out, TO_CINEMA, clockSec(day, homeAgain + 3), clockSec(day, homeAgain + 3.7), {
      reverse: true,
    })
    stay(out, HOME, clockSec(day, homeAgain + 3.7), clockSec(day, 23.9), 'HOME')
  } else {
    stay(out, HOME, clockSec(day, homeAgain), clockSec(day, 23.9), 'HOME')
  }
}

/** A weekend: a lie-in, then one of a few outings, or nothing at all. */
function emitWeekend(out: RawPt[], day: Date): void {
  const wake = 9.5 + rng()
  stay(out, HOME, clockSec(day, 0), clockSec(day, wake), 'HOME')

  const roll = rng()

  if (roll < 0.26) {
    // Shopping — right across the city, so it takes most of the afternoon.
    travel(out, TO_MALL, clockSec(day, wake), clockSec(day, wake + 0.7))
    stay(out, MALL, clockSec(day, wake + 0.7), clockSec(day, wake + 2.7))
    travel(out, TO_MALL, clockSec(day, wake + 2.7), clockSec(day, wake + 3.4), { reverse: true })
    stay(out, HOME, clockSec(day, wake + 3.4), clockSec(day, 23.9), 'HOME')
  } else if (roll < 0.5) {
    // A walk on the island.
    travel(out, TO_PARK, clockSec(day, wake), clockSec(day, wake + 0.5))
    stay(out, PARK, clockSec(day, wake + 0.5), clockSec(day, wake + 2))
    travel(out, TO_PARK, clockSec(day, wake + 2), clockSec(day, wake + 2.5), { reverse: true })
    stay(out, HOME, clockSec(day, wake + 2.5), clockSec(day, 23.9), 'HOME')
  } else if (roll < 0.62) {
    // Friends in Obolon — the far side of the city, and a late trip home.
    stay(out, HOME, clockSec(day, wake), clockSec(day, 16), 'HOME')
    travel(out, TO_FRIENDS, clockSec(day, 16), clockSec(day, 17))
    stay(out, FRIENDS, clockSec(day, 17), clockSec(day, 22.5))
    travel(out, TO_FRIENDS, clockSec(day, 22.5), clockSec(day, 23.5), { reverse: true })
    stay(out, HOME, clockSec(day, 23.5), clockSec(day, 23.9), 'HOME')
  } else {
    stay(out, HOME, clockSec(day, wake), clockSec(day, 23.9), 'HOME')
  }
}

/** One day of a holiday: at the base, with an outing most days. */
function emitHolidayDay(out: RawPt[], day: Date, holiday: Holiday): void {
  const wake = 9 + rng()
  stay(out, holiday.base, clockSec(day, 0), clockSec(day, wake))

  if (holiday.nearby !== holiday.base && chance(0.75)) {
    travel(out, [holiday.base, holiday.nearby], clockSec(day, wake), clockSec(day, wake + 0.3))
    stay(out, holiday.nearby, clockSec(day, wake + 0.3), clockSec(day, wake + 3))
    travel(out, [holiday.base, holiday.nearby], clockSec(day, wake + 3), clockSec(day, wake + 3.3), {
      reverse: true,
    })
    stay(out, holiday.base, clockSec(day, wake + 3.3), clockSec(day, 23.9))
  } else {
    stay(out, holiday.base, clockSec(day, wake), clockSec(day, 23.9))
  }
}

// ── Main generator ──────────────────────────────────────────────────────────

export function generateDemoPoints(): ParsedPoints {
  resetRng()

  const out: RawPt[] = []

  // Anchored to TODAY rather than to fixed dates. A demo whose history ends
  // two years in the past reads as a stale fixture, and the "recent" window
  // that decides whether a place counts as newly picked up would be measuring
  // a period that ended long ago.
  const lastDay = addDays(new Date(), -1)
  const firstDay = addDays(lastDay, -(TOTAL_DAYS - 1))

  for (let dayIndex = 0; dayIndex < TOTAL_DAYS; dayIndex++) {
    const day = addDays(firstDay, dayIndex)

    const holiday = HOLIDAYS.find(
      (h) => dayIndex >= h.startDay && dayIndex <= h.startDay + h.nights,
    )

    if (holiday) {
      if (dayIndex === holiday.startDay) {
        // Departure: morning at home, across town to the station, then the
        // long leg out. This single journey is what makes the "longest
        // journey" figure in the outro a real trip instead of a commute.
        stay(out, HOME, clockSec(day, 0), clockSec(day, 7.5), 'HOME')
        travel(out, TO_STATION, clockSec(day, 7.5), clockSec(day, 8.4))
        stay(out, STATION, clockSec(day, 8.4), clockSec(day, 9))
        travel(out, holiday.outbound, clockSec(day, 9), clockSec(day, 9 + holiday.travelHours), {
          cadenceSec: RAIL_PING_SEC,
        })
        stay(out, holiday.base, clockSec(day, 9 + holiday.travelHours), clockSec(day, 23.9))
      } else if (dayIndex === holiday.startDay + holiday.nights) {
        // Return leg.
        stay(out, holiday.base, clockSec(day, 0), clockSec(day, 10))
        travel(out, holiday.outbound, clockSec(day, 10), clockSec(day, 10 + holiday.travelHours), {
          reverse: true,
          cadenceSec: RAIL_PING_SEC,
        })
        const back = 10 + holiday.travelHours
        stay(out, STATION, clockSec(day, back), clockSec(day, back + 0.3))
        travel(out, TO_STATION, clockSec(day, back + 0.3), clockSec(day, back + 1.2), {
          reverse: true,
        })
        stay(out, HOME, clockSec(day, back + 1.2), clockSec(day, 23.9), 'HOME')
      } else {
        emitHolidayDay(out, day, holiday)
      }
      continue
    }

    // getDay() is 0=Sunday. Read straight off the local date rather than
    // derived from the loop counter — the arithmetic version this replaced was
    // off by one, which put the demo's weekend on Friday and Saturday and left
    // Sunday looking like a full working day in the weekday chart.
    const dow = day.getDay()
    const isWeekend = dow === 0 || dow === 6

    if (isWeekend) {
      emitWeekend(out, day)
    } else if (chance(0.04)) {
      // Off sick, or a public holiday.
      emitWeekend(out, day)
    } else {
      emitWorkday(out, day, dayIndex)
    }
  }

  // Days are generated in order and each day's emitters run in clock order,
  // but the evening/gym branches interleave stays and travel legs, so a final
  // sort is what actually guarantees the precondition every analytics module
  // documents.
  out.sort((a, b) => a.sec - b.sec)

  const n = out.length
  const lat = new Float64Array(n)
  const lng = new Float64Array(n)
  const ts = new Uint32Array(n)
  const src = new Uint8Array(n)
  const labels: (string | null)[] = new Array(n)

  for (let i = 0; i < n; i++) {
    lat[i] = out[i].lat
    lng[i] = out[i].lng
    ts[i] = out[i].sec
    src[i] = out[i].source
    labels[i] = out[i].label
  }

  // Google's own profile names only the current home and workplace — the
  // previous office is not in it, which is exactly the gap this app's
  // clustering fills in.
  const frequentPlaces: FrequentPlace[] = [
    { lat: HOME.lat, lng: HOME.lng, label: 'HOME' },
    { lat: WORK_NEW.lat, lng: WORK_NEW.lng, label: 'WORK' },
  ]

  return {
    lat,
    lng,
    timestampSec: ts,
    sources: src,
    semanticLabels: labels,
    activities: [],
    trips: [],
    frequentPlaces,
    format: 'demo',
    recordsSeen: n,
    recordsSkipped: 0,
  }
}
