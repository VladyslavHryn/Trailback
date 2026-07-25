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
  return `${formatNumber(count)} ${plural(count, 'візит', 'візити', 'візитів')}`
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
