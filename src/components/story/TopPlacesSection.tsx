import { StorySection } from './StorySection'
import { Reveal } from './Reveal'
import { formatDuration, formatVisits } from './format'
import type { DisplayPlace } from '../../analytics/placeInsights'

type TopPlacesSectionProps = {
  places: DisplayPlace[]
  /** Total span of the history, used to express a place as hours-per-day. */
  spanDays: number
}

const MAX_PLACES = 6

export function TopPlacesSection({ places, spanDays }: TopPlacesSectionProps) {
  const shown = places.slice(0, MAX_PLACES)
  if (shown.length === 0) return null

  return (
    <StorySection
      eyebrow="Місця твого життя"
      title="Де ти був найдовше"
      subtitle="Кожне з цих місць твій телефон бачив сотні разів. Разом вони — майже весь твій час."
    >
      <ol className="flex flex-col">
        {shown.map((place, index) => {
          const hoursPerDay = spanDays > 0 ? place.totalDurationSec / 3600 / spanDays : 0

          return (
            <Reveal key={place.clusterId} index={index}>
              <li className="flex items-start gap-5 border-t border-ink-800 py-6 md:gap-8 md:py-7">
                <span className="mt-1 w-8 shrink-0 font-mono text-sm text-ink-600 md:text-base">
                  {String(index + 1).padStart(2, '0')}
                </span>

                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-xl font-semibold leading-tight text-ink-50 md:text-3xl">
                    {place.displayName}
                  </h3>
                  <p className="mt-1.5 text-sm text-ink-400">
                    {formatVisits(place.visitCount)}
                    {place.category && ` · ${place.category}`}
                    {place.district && ` · ${place.district}`}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="font-display text-lg font-semibold text-trail-300 md:text-2xl">
                    {formatDuration(place.totalDurationSec)}
                  </p>
                  {/* The raw total ("338 днів") is easy to misread as a
                      single continuous stay; the per-day average makes the
                      same number immediately sensible. */}
                  {hoursPerDay >= 0.1 && (
                    <p className="mt-1 font-mono text-xs text-ink-400">
                      ≈ {hoursPerDay.toFixed(1)} год/день
                    </p>
                  )}
                </div>
              </li>
            </Reveal>
          )
        })}
      </ol>
    </StorySection>
  )
}
