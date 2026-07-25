import { StorySection } from './StorySection'
import { Reveal } from './Reveal'
import { BreakdownBars, type BreakdownRow } from './StoryCharts'
import { formatDurationShort } from './format'
import { assignDistrictColors, type DistrictBreakdown } from '../../analytics/placeInsights'

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
  const colors = assignDistrictColors(shown.map((d) => d.district))

  const rows: BreakdownRow[] = shown.map((d) => ({
    key: d.district,
    label: d.district,
    value: formatDurationShort(d.totalDurationSec),
    ratio: d.shareOfKnownTime,
    color: colors.get(d.district),
  }))

  const top = shown[0]

  return (
    <StorySection
      eyebrow="Твої райони"
      title={
        top ? (
          // Phrased as a label rather than a sentence on purpose: OSM
          // district names already carry their own noun ("Дніпровський
          // район"), so any prepositional phrasing would either double the
          // word or need Ukrainian case declension of arbitrary input.
          <>
            Більшість життя минула тут:
            <br />
            <span className="text-trail-400">{top.district}</span>
          </>
        ) : (
          'Твої райони'
        )
      }
      subtitle="Як твій час розподілився між районами міста."
    >
      {rows.length > 0 ? (
        <>
          <BreakdownBars rows={rows} showPercent />
          <Reveal index={rows.length}>
            <p className="mt-10 text-xs leading-relaxed text-ink-400">
              Відсотки рахуються серед топ-місць, для яких вдалося визначити
              район через OpenStreetMap.
            </p>
          </Reveal>
        </>
      ) : (
        <p className="text-base text-ink-400">Визначаємо райони твоїх місць…</p>
      )}
    </StorySection>
  )
}
