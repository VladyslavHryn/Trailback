import { StorySection } from './StorySection'
import { Reveal } from './Reveal'
import { BreakdownBars, type BreakdownRow } from './StoryCharts'
import { formatDurationShort } from './format'
import { NumberTicker } from '../ui/NumberTicker'
import { districtShade, type DistrictBreakdown } from '../../analytics/placeInsights'

type DistrictsSectionProps = {
  districts: DistrictBreakdown[]
  geocodingPending: boolean
}

const MAX_DISTRICTS = 6

export function DistrictsSection({ districts, geocodingPending }: DistrictsSectionProps) {
  // Nothing resolved yet (or nothing resolvable) — skipping the screen
  // entirely beats showing an empty one mid-story.
  if (districts.length === 0 && !geocodingPending) return null

  const shown = districts.slice(0, MAX_DISTRICTS)
  const top = shown[0]

  // The leader gets its own oversized treatment and the remainder become a
  // compact list, rather than every district getting an identical row. One
  // dominant element per screen is the difference between a designed section
  // and a rendered table.
  const rest = shown.slice(1)

  const rows: BreakdownRow[] = rest.map((d) => ({
    key: d.district,
    label: d.district,
    value: formatDurationShort(d.totalDurationSec),
    ratio: d.shareOfKnownTime,
    // Same single-hue magnitude scale as the map pins: brighter = more of
    // your life spent there. Scaled against the leader so the ramp uses its
    // full range instead of bunching up at the bottom.
    color: districtShade(d.totalDurationSec / (top?.totalDurationSec || 1)),
  }))

  return (
    <StorySection eyebrow="Твої райони" index="04">
      {rows.length > 0 || top ? (
        <>
          {top && (
            <Reveal>
              <div className="border-b border-ink-800 pb-10">
                <p className="max-w-[34ch] font-display text-3xl font-semibold leading-[1.05] tracking-tight text-ink-50 md:text-5xl">
                  Більшість життя минула тут
                </p>

                {/* Tiny label, enormous number, small supporting line — the
                    size jump is what makes the share register before any of
                    the words do. */}
                <div className="mt-8 flex flex-wrap items-end gap-x-8 gap-y-4">
                  <p
                    className="font-display text-[clamp(4.5rem,13vw,9.5rem)] font-bold leading-[0.8] tracking-tighter"
                    style={{ color: districtShade(1) }}
                  >
                    <NumberTicker value={top.shareOfKnownTime * 100} suffix="%" />
                  </p>
                  <div className="pb-2">
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
                      Найбільший район
                    </p>
                    <p className="mt-1.5 font-display text-xl font-semibold text-ink-50 md:text-2xl">
                      {top.district}
                    </p>
                    <p className="mt-1 font-mono text-xs text-ink-400">
                      {formatDurationShort(top.totalDurationSec)}
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
          )}

          {rows.length > 0 && (
            <div className="mt-10">
              <BreakdownBars rows={rows} showPercent accent="place" />
            </div>
          )}

          <Reveal index={rows.length}>
            <p className="mt-10 max-w-[52ch] text-xs leading-relaxed text-ink-400">
              Що яскравіший відтінок — то більше часу там пройшло. Відсотки
              рахуються серед топ-місць, для яких вдалося визначити район через
              OpenStreetMap.
            </p>
          </Reveal>
        </>
      ) : (
        <p className="text-base text-ink-400">Визначаємо райони твоїх місць…</p>
      )}
    </StorySection>
  )
}
