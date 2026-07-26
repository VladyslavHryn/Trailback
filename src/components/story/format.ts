// Shared Ukrainian number/duration formatting for the story sections, so
// the same value never appears in two different shapes across screens.

export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('uk-UA')
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
    return `${totalHours.toFixed(totalHours < 10 ? 1 : 0)} год`
  }
  return `${Math.max(1, Math.round(seconds / 60))} хв`
}

/**
 * One unit — days — for every row of a COMPARISON list.
 *
 * `formatDurationShort` picks whichever unit fits each value best, which is
 * right for a lone figure and wrong for a column: a list reading "94 дні",
 * "46 год", "2 дні" forces the reader to convert in their head before they
 * can tell which row is bigger, and the bar beside it says one thing while
 * the number says another. Fixing the unit makes the column scannable; the
 * precise, mixed-unit value stays available as secondary text.
 */
export function formatDaysUniform(seconds: number): string {
  const days = seconds / 86400

  if (days >= 10) {
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
 * The precise, best-unit value — but only when it actually adds something.
 *
 * The uniform-days column already reads "1,9 дня"; pairing that with "46 год"
 * is genuinely useful, whereas pairing "278 днів" with "278 днів" is just the
 * same string twice. Returns null when the two agree so the caller can omit
 * the secondary line rather than print a duplicate.
 */
export function exactDurationIfDifferent(seconds: number): string | null {
  const exact = formatDurationShort(seconds)
  return exact === formatDaysUniform(seconds) ? null : exact
}

/** Compact form for tight spots — just the dominant unit. */
export function formatDurationShort(seconds: number): string {
  const totalHours = seconds / 3600
  if (totalHours >= 48) {
    const days = Math.round(totalHours / 24)
    return `${days} ${plural(days, 'день', 'дні', 'днів')}`
  }
  if (totalHours >= 1) return `${Math.round(totalHours)} год`
  return `${Math.max(1, Math.round(seconds / 60))} хв`
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
