// When are you actually out and about? Bucketed by hour-of-day and day-of-
// week in the BROWSER's local timezone. The source data has no reliable
// per-point timezone — every timestamp was normalized to a plain UTC
// instant back in Step 2's parsing — so this assumes whoever is reviewing
// the history is looking at it from roughly the timezone they lived it in.
// That's the only assumption that lets "6pm" mean anything without
// per-point timezone metadata, which Google's own export doesn't reliably
// carry either.

import type { ParsedPoints } from '../parsing/types'

export interface TimePatterns {
  /** Index = hour of day, 0-23, local time. */
  byHour: number[]
  /** Index = weekday, Monday-first (0 = Monday ... 6 = Sunday) to match the UI. */
  byWeekday: number[]
  busiestHour: number
  busiestWeekdayIndex: number
}

export function computeTimePatterns(points: ParsedPoints): TimePatterns {
  const byHour = new Array(24).fill(0) as number[]
  const byWeekday = new Array(7).fill(0) as number[]

  const n = points.lat.length
  for (let i = 0; i < n; i++) {
    const date = new Date(points.timestampSec[i] * 1000)
    byHour[date.getHours()]++
    // JS getDay() is 0 = Sunday..6 = Saturday; shift so 0 = Monday.
    byWeekday[(date.getDay() + 6) % 7]++
  }

  let busiestHour = 0
  for (let h = 1; h < 24; h++) if (byHour[h] > byHour[busiestHour]) busiestHour = h

  let busiestWeekdayIndex = 0
  for (let d = 1; d < 7; d++) if (byWeekday[d] > byWeekday[busiestWeekdayIndex]) busiestWeekdayIndex = d

  return { byHour, byWeekday, busiestHour, busiestWeekdayIndex }
}
