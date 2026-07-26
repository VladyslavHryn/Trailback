import { StorySection } from './StorySection'
import { Reveal } from './Reveal'
import { BreakdownBars, type BreakdownRow } from './StoryCharts'
import { exactDurationIfDifferent, formatDaysUniform } from './format'
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
    value: formatDaysUniform(d.totalDurationSec),
    meta: exactDurationIfDifferent(d.totalDurationSec) ?? undefined,
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
                    className="numeral-hero"
                    style={{ color: districtShade(1) }}
                  >
                    <NumberTicker value={top.shareOfKnownTime * 100} suffix="%" />
                  </p>
                  <div className="pb-2">
                    <p className="text-label-micro text-ink-400">
                      Найбільший район
                    </p>
                    <p className="mt-1.5 font-display text-xl font-semibold text-ink-50 md:text-2xl">
                      {top.district}
                    </p>
                    <p className="mt-1 font-mono text-xs text-ink-400">
                      {formatDaysUniform(top.totalDurationSec)}
                      {exactDurationIfDifferent(top.totalDurationSec) && (
                        <span className="text-ink-600">
                          {' · '}
                          {exactDurationIfDifferent(top.totalDurationSec)}
                        </span>
                      )}
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

          {/* Says outright that a district is a SUM of places. Without this
              the screens look like they disagree: a place shows 275 days
              while its district shows 278, and the natural reading is a
              counting bug rather than "the district also contains everywhere
              else you went in it". */}
          <Reveal index={rows.length}>
            <p className="mt-10 max-w-[52ch] text-xs leading-relaxed text-ink-400">
              Район — це сума всіх твоїх місць у ньому, тому його час завжди
              більший за час окремого місця з попереднього екрана. Що яскравіший
              відтінок — то більше часу там пройшло. Відсотки рахуються серед
              топ-місць, для яких вдалося визначити район через OpenStreetMap.
            </p>
          </Reveal>
        </>
      ) : (
        <p className="text-base text-ink-400">Визначаємо райони твоїх місць…</p>
      )}
    </StorySection>
  )
}
