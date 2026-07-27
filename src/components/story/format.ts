// Shared Ukrainian number/duration formatting for the story sections, so
// the same value never appears in two different shapes across screens.

export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('uk-UA')
}

/**
 * A fractional number in Ukrainian form — "6,4", never "6.4".
 *
 * `toFixed` always emits a dot, which put two different decimal separators in
 * one rendered string ("0,2 дня · 5.0 год") since every other figure here goes
 * through toLocaleString. Reader-facing decimals go through this; a dot is
 * still correct for coordinates, cache keys and CSS colour values, so those
 * deliberately keep toFixed.
 */
export function formatDecimal(value: number, digits = 1): string {
  return value.toLocaleString('uk-UA', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

/** Ukrainian plural forms: 1 день / 2 дні / 5 днів. */
function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

/**
 * Human-readable duration. Long stays are expressed in days + hours, which
 * is how a year of evenings at home actually reads to a person; short ones
 * stay in hours or minutes so a 20-minute stop doesn't render as "0 днів".
 */
export function formatDuration(seconds: number): string {
  const totalHours = seconds / 3600

  if (totalHours >= 48) {
    const days = Math.floor(totalHours / 24)
    const hours = Math.round(totalHours % 24)
    const dayWord = plural(days, 'день', 'дні', 'днів')
    return hours > 0 ? `${days} ${dayWord} ${hours} год` : `${days} ${dayWord}`
  }
  if (totalHours >= 1) {
    return `${formatDecimal(totalHours, totalHours < 10 ? 1 : 0)} год`
  }
  return `${Math.max(1, Math.round(seconds / 60))} хв`
}

/**
 * One unit — days — for every row of a COMPARISON list.
 *
 * `formatDuration` picks whichever unit fits each value best, which is right
 * for a lone figure and wrong for a column: a list reading "94 дні",
 * "46 год", "2 дні" forces the reader to convert in their head before they
 * can tell which row is bigger, and the bar beside it says one thing while
 * the number says another. Fixing the unit makes the column scannable; the
 * precise, mixed-unit value stays available as secondary text.
 */
/**
 * Where the days column stops showing a decimal and rounds to whole days.
 * Shared with exactDurationIfDifferent, which keys its whole decision on it —
 * if the two ever drifted apart, the secondary line would reappear exactly
 * where it is noise.
 */
const WHOLE_DAYS_FROM = 10

export function formatDaysUniform(seconds: number): string {
  const days = seconds / 86400

  if (days >= WHOLE_DAYS_FROM) {
    const rounded = Math.round(days)
    return `${formatNumber(rounded)} ${plural(rounded, 'день', 'дні', 'днів')}`
  }
  // Below ten days a whole number throws away the distinction between half a
  // day and nine hours, so one decimal stays. After a decimal Ukrainian takes
  // the genitive singular — "2,4 дня", never "2,4 дні".
  const value = days.toLocaleString('uk-UA', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  return `${value} дня`
}

/**
 * The precise value — but only when it actually adds something.
 *
 * The uniform-days column already reads "1,9 дня"; pairing that with "46 год"
 * is genuinely useful, whereas pairing "278 днів" with "278 днів" is just the
 * same string twice.
 *
 * The rule is the reader's, not the number's: a secondary line has to say
 * something the column CAN'T. Below ten days the column shows a decimal of a
 * unit nobody feels — "0,8 дня" means nothing until it reads "20 год" — so the
 * exact value earns its place. At ten days and up the column rounds to whole
 * days, and at that scale a whole day IS the honest granularity: appending
 * hours there is noise ("213 днів · 213 днів 10 год"), and where the rounding
 * went up it looks like the two disagree ("89 днів" beside "88 днів 12 год").
 *
 * Uses formatDuration rather than a single dominant unit, which above 48 hours
 * would be a whole number of days — strictly COARSER than the decimal the
 * column already shows, and so either redundant ("3 дні" beside "3,4 дня") or
 * contradictory ("10 днів" beside "9,6 дня", rounded past its own headline).
 */
export function exactDurationIfDifferent(seconds: number): string | null {
  if (seconds / 86400 >= WHOLE_DAYS_FROM) return null
  const exact = formatDuration(seconds)
  return exact === formatDaysUniform(seconds) ? null : exact
}

export function formatVisits(count: number): string {
  return `${formatNumber(count)} ${visitsWord(count)}`
}

/** Just the noun, for when the number itself is rendered separately (an
 * animated counter can't be baked into a formatted string). */
export function visitsWord(count: number): string {
  return plural(count, 'візит', 'візити', 'візитів')
}

export function placesWord(count: number): string {
  return plural(count, 'місце', 'місця', 'місць')
}

export function formatDaysSpan(days: number): string {
  const rounded = Math.round(days)
  return `${formatNumber(rounded)} ${plural(rounded, 'день', 'дні', 'днів')}`
}

export function formatDate(dateISO: string): string {
  return new Date(`${dateISO}T00:00:00Z`).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
