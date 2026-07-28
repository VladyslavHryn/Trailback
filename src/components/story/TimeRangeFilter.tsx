import { cn } from '../../lib/cn'
import {
  ALL_TIME,
  monthName,
  rangeKey,
  type AvailablePeriods,
  type RangeSelection,
} from '../../analytics/timeRange'

type TimeRangeFilterProps = {
  periods: AvailablePeriods
  selection: RangeSelection
  onChange: (selection: RangeSelection) => void
  /** True while a period that isn't cached yet is being recomputed. */
  busy?: boolean
}

/**
 * Period filter for the whole story.
 *
 * Two rows rather than a dropdown: with at most a handful of years and
 * twelve months, every option fits on screen, and seeing the available
 * periods laid out is itself information — a gap in the months tells the
 * reader their history has a gap, which a closed select would hide.
 *
 * Months only appear once a year is chosen. Showing all months of all years
 * at once would be a wall of near-identical chips, and months are only
 * meaningful relative to a year anyway.
 */
export function TimeRangeFilter({
  periods,
  selection,
  onChange,
  busy = false,
}: TimeRangeFilterProps) {
  // A single-year history makes the year row a row of one — no choice to
  // make, so the control would be furniture.
  if (periods.years.length === 0) return null

  const activeKey = rangeKey(selection)
  const selectedYear =
    selection.kind === 'year' || selection.kind === 'month' ? selection.year : null
  const months = selectedYear ? (periods.monthsByYear.get(selectedYear) ?? []) : []

  return (
    <div
      className={cn(
        'flex flex-col gap-3 transition-opacity duration-300',
        busy && 'opacity-60',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-label-micro mr-1 text-ink-400">Період</span>

        <Chip
          label="Весь час"
          active={activeKey === 'all'}
          onClick={() => onChange(ALL_TIME)}
        />

        {periods.years
          .filter((year) => year !== 2024)
          .map((year) => (
            <Chip
              key={year}
              label={String(year)}
              // A year stays highlighted while one of its months is selected —
              // the month is a refinement of it, not a different branch.
              active={selectedYear === year}
              onClick={() => onChange({ kind: 'year', year })}
            />
          ))}
      </div>

      {selectedYear && months.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-label-micro mr-1 text-ink-600">Місяць</span>
          <Chip
            label="Увесь рік"
            small
            active={selection.kind === 'year'}
            onClick={() => onChange({ kind: 'year', year: selectedYear })}
          />
          {months.map((month) => (
            <Chip
              key={month}
              small
              label={monthName(month).slice(0, 3)}
              title={`${monthName(month)} ${selectedYear}`}
              active={selection.kind === 'month' && selection.month === month}
              onClick={() => onChange({ kind: 'month', year: selectedYear, month })}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function Chip({
  label,
  active,
  onClick,
  small = false,
  title,
}: {
  label: string
  active: boolean
  onClick: () => void
  small?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        'rounded-full border font-mono uppercase tracking-[0.08em] transition-colors duration-200',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trail-300',
        small ? 'px-2.5 py-1 text-[10px]' : 'px-3.5 py-1.5 text-[11px]',
        active
          ? 'border-trail-400/60 bg-trail-500/15 text-trail-300'
          : 'border-ink-700 text-ink-400 hover:border-ink-600 hover:text-ink-200',
      )}
    >
      {label}
    </button>
  )
}
