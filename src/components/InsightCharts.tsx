// Small, dependency-free chart primitives for the insights dashboard. These
// are intentionally simple (plain SVG / CSS grid, no charting library) —
// the dashboard's numbers are the point, not chart sophistication.

type MiniBarChartProps = {
  values: number[]
  labels: string[]
  highlightIndex?: number
  height?: number
  /** Show every Nth label to avoid crowding (e.g. hours: every 3rd). */
  labelStep?: number
}

export function MiniBarChart({
  values,
  labels,
  highlightIndex,
  height = 56,
  labelStep = 1,
}: MiniBarChartProps) {
  const max = Math.max(...values, 1)
  const barGap = 100 / values.length

  return (
    <div>
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="h-14 w-full"
      >
        {values.map((value, i) => {
          const barHeight = (value / max) * (height - 4)
          const isHighlight = i === highlightIndex
          return (
            <rect
              key={i}
              x={i * barGap + barGap * 0.15}
              y={height - barHeight}
              width={barGap * 0.7}
              height={Math.max(barHeight, 1)}
              rx={1}
              fill={isHighlight ? 'var(--color-trail-300)' : 'var(--color-trail-500)'}
              opacity={isHighlight ? 1 : 0.6}
            />
          )
        })}
      </svg>
      <div className="mt-1 flex justify-between font-mono text-[9px] text-ink-500">
        {labels.map((label, i) => (
          <span key={i} className="flex-1 text-center">
            {i % labelStep === 0 ? label : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

type LineSeries = {
  label: string
  color: string
  values: number[]
}

type MiniLineChartProps = {
  series: LineSeries[]
  xLabels: string[]
  height?: number
}

export function MiniLineChart({ series, xLabels, height = 72 }: MiniLineChartProps) {
  const allValues = series.flatMap((s) => s.values)
  const max = Math.max(...allValues, 1)
  const count = xLabels.length
  const stepX = count > 1 ? 100 / (count - 1) : 0

  const toPoints = (values: number[]) =>
    values
      .map((v, i) => `${(i * stepX).toFixed(2)},${(height - (v / max) * (height - 6) - 2).toFixed(2)}`)
      .join(' ')

  // Show at most ~6 x-axis labels regardless of month count, evenly spaced.
  const labelStride = Math.max(1, Math.ceil(count / 6))

  return (
    <div>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="h-18 w-full">
        {series.map((s) => (
          <polyline
            key={s.label}
            points={toPoints(s.values)}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <div className="mt-1 flex justify-between font-mono text-[9px] text-ink-500">
        {xLabels.map((label, i) => (
          <span key={i} className="flex-1 text-center">
            {i % labelStride === 0 ? label : ''}
          </span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-3">
        {series.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-[10px] text-ink-400">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: s.color }}
            />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}

type CoverageGridProps = {
  rows: number
  cols: number
  visited: boolean[]
}

export function CoverageGrid({ rows, cols, visited }: CoverageGridProps) {
  if (rows === 0 || cols === 0) return null

  return (
    <div
      className="grid w-24 shrink-0 gap-[2px]"
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
    >
      {visited.map((isVisited, i) => (
        <div
          key={i}
          className="aspect-square rounded-[1px]"
          style={{
            background: isVisited ? 'var(--color-trail-500)' : 'var(--color-ink-800)',
          }}
        />
      ))}
    </div>
  )
}
