import { motion, useReducedMotion } from 'framer-motion'
import { NumberTicker } from '../ui/NumberTicker'
import { cn } from '../../lib/cn'

// Story-scale chart primitives — deliberately larger and plainer than a
// dashboard widget: one series, thin marks, recessive axes, and the value
// itself carried by direct labels rather than a legend, since each of these
// only ever shows a single measure at a time.

/**
 * Which accent a chart speaks in. Charts don't get to pick a colour for
 * looks — the accent says what KIND of quantity is on screen, so the reader
 * builds one mapping and keeps it across the whole story: amber means
 * density/magnitude, jade means places, periwinkle means time.
 */
export type ChartAccent = 'heat' | 'place' | 'time'

const ACCENT_TOKENS: Record<ChartAccent, { bar: string; text: string; glow: string }> = {
  heat: {
    bar: 'var(--color-trail-400)',
    text: 'text-trail-300',
    glow: '0 0 26px rgba(245, 158, 11, 0.5)',
  },
  place: {
    bar: 'var(--color-signal-500)',
    text: 'text-signal-300',
    glow: '0 0 26px rgba(37, 199, 156, 0.45)',
  },
  time: {
    bar: 'var(--color-dusk-500)',
    text: 'text-dusk-400',
    glow: '0 0 26px rgba(124, 131, 240, 0.5)',
  },
}

type ColumnChartProps = {
  values: number[]
  labels: string[]
  highlightIndex: number
  /** Render only every Nth label, so 24 hour ticks don't collide. */
  labelStep?: number
  ariaLabel: string
  accent?: ChartAccent
}

/**
 * Vertical columns that grow into place as the chart scrolls into view.
 * Bars are anchored to the baseline and rounded only at the data end, so
 * the rounding reads as the value's cap rather than as a floating pill.
 *
 * Hovering a column lifts it out of the series. That's a readability
 * affordance rather than decoration: with 24 thin bars sharing a baseline,
 * picking out which one the eye is on is genuinely hard, and the highlight
 * answers it without needing a tooltip layer.
 */
export function ColumnChart({
  values,
  labels,
  highlightIndex,
  labelStep = 1,
  ariaLabel,
  accent = 'time',
}: ColumnChartProps) {
  const prefersReducedMotion = useReducedMotion()
  const max = Math.max(...values, 1)
  const tokens = ACCENT_TOKENS[accent]

  return (
    <div role="img" aria-label={ariaLabel}>
      <div className="group/chart flex h-48 items-end gap-[3px] md:h-64 md:gap-1.5">
        {values.map((value, i) => {
          const heightPct = (value / max) * 100
          const isPeak = i === highlightIndex
          return (
            <div key={i} className="flex h-full flex-1 items-end">
              <motion.div
                className={cn(
                  'w-full rounded-t-[4px] origin-bottom',
                  // Dim the rest of the series while any bar is hovered, so
                  // the hovered one reads as selected rather than just
                  // slightly brighter than its neighbours.
                  'transition-[filter,background-color] duration-300',
                  'group-hover/chart:brightness-[0.65] hover:!brightness-125',
                )}
                style={{
                  background: isPeak ? tokens.bar : 'var(--color-ink-700)',
                  boxShadow: isPeak ? tokens.glow : undefined,
                }}
                initial={prefersReducedMotion ? false : { height: 0 }}
                whileInView={{ height: `${Math.max(heightPct, 1.5)}%` }}
                viewport={{ once: true, amount: 0.4 }}
                whileHover={prefersReducedMotion ? undefined : { scaleY: 1.04 }}
                transition={{
                  duration: 0.8,
                  delay: prefersReducedMotion ? 0 : i * 0.015,
                  ease: [0.22, 1, 0.36, 1],
                }}
              />
            </div>
          )
        })}
      </div>

      <div className="mt-3 flex gap-[3px] md:gap-1.5">
        {labels.map((label, i) => (
          <div key={i} className="flex-1 text-center">
            <span
              className={cn(
                'font-mono text-[10px] md:text-xs',
                i === highlightIndex ? tokens.text : 'text-ink-400',
              )}
            >
              {i % labelStep === 0 || i === highlightIndex ? label : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export type BreakdownRow = {
  key: string
  label: string
  /** Right-aligned secondary text (a duration, a count). */
  value: string
  /** 0..1 — drives the bar width. */
  ratio: number
  color?: string
  /** Optional third line under the label. */
  meta?: string
}

type BreakdownBarsProps = {
  rows: BreakdownRow[]
  /** Shown at the right of each row above the bar, e.g. a percentage. */
  showPercent?: boolean
  accent?: ChartAccent
}

/**
 * Horizontal breakdown — a label, its value, and a proportional bar. Used
 * for districts and categories, which are both "share of a whole" reads
 * where the row label needs full-width room for a real place name.
 */
export function BreakdownBars({
  rows,
  showPercent = false,
  accent = 'place',
}: BreakdownBarsProps) {
  const prefersReducedMotion = useReducedMotion()
  const tokens = ACCENT_TOKENS[accent]

  return (
    <ul className="flex flex-col gap-6">
      {rows.map((row, i) => {
        // A row's own colour wins when it has one — the district rows carry
        // the same per-district hue as their map pins, which is the whole
        // point of that palette. The accent is the fallback.
        const color = row.color ?? tokens.bar
        return (
          <li key={row.key} className="group">
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-display text-lg font-medium text-ink-50 transition-colors duration-300 group-hover:text-ink-200 md:text-2xl">
                {row.label}
              </span>
              <span className="shrink-0 text-right">
                {showPercent && (
                  <span
                    className="font-display text-xl font-semibold md:text-3xl"
                    style={{ color }}
                  >
                    <NumberTicker
                      value={row.ratio * 100}
                      suffix="%"
                      delay={i * 0.07}
                    />
                  </span>
                )}
                <span className="ml-3 font-mono text-xs text-ink-400 md:text-sm">
                  {row.value}
                </span>
              </span>
            </div>

            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-ink-800">
              <motion.div
                className="h-full rounded-full transition-[box-shadow] duration-300"
                style={{ background: color }}
                initial={prefersReducedMotion ? false : { width: 0 }}
                whileInView={{ width: `${Math.max(row.ratio * 100, 1)}%` }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{
                  duration: 0.9,
                  delay: prefersReducedMotion ? 0 : i * 0.08,
                  ease: [0.22, 1, 0.36, 1],
                }}
              />
            </div>

            {row.meta && <p className="mt-2 text-xs text-ink-400">{row.meta}</p>}
          </li>
        )
      })}
    </ul>
  )
}
