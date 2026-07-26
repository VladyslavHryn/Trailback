import { motion, useReducedMotion } from 'framer-motion'
import { StorySection } from './StorySection'
import { Reveal } from './Reveal'
import { formatDuration, visitsWord } from './format'
import { NumberTicker } from '../ui/NumberTicker'
import { SpotlightCard } from '../ui/SpotlightCard'
import { BorderBeam } from '../ui/BorderBeam'
import { cn } from '../../lib/cn'
import type { DisplayPlace } from '../../analytics/placeInsights'

type TopPlacesSectionProps = {
  places: DisplayPlace[]
  /** Total span of the history, used to express a place as hours-per-day. */
  spanDays: number
}

const MAX_PLACES = 6

export function TopPlacesSection({ places, spanDays }: TopPlacesSectionProps) {
  const prefersReducedMotion = useReducedMotion()
  const shown = places.slice(0, MAX_PLACES)
  if (shown.length === 0) return null

  const topDuration = shown[0].totalDurationSec || 1

  return (
    <StorySection
      eyebrow="Місця твого життя"
      title="Де ти був найдовше"
      subtitle="Кожне з цих місць твій телефон бачив сотні разів. Разом вони — майже весь твій час."
    >
      <ol className="flex flex-col gap-3">
        {shown.map((place, index) => {
          const hoursPerDay = spanDays > 0 ? place.totalDurationSec / 3600 / spanDays : 0
          const isFirst = index === 0
          // Bar width relative to the top place, so the ranking is legible
          // at a glance instead of having to compare formatted durations.
          const share = place.totalDurationSec / topDuration

          return (
            <Reveal key={place.clusterId} index={index}>
              <li>
                <SpotlightCard
                  className={cn(isFirst && 'border-trail-500/30')}
                  glow={
                    isFirst ? 'rgba(245, 158, 11, 0.16)' : 'rgba(37, 199, 156, 0.11)'
                  }
                >
                  {isFirst && <BorderBeam duration={9} />}

                  <div className="flex items-start gap-5 p-5 md:gap-8 md:p-6">
                    <span
                      className={cn(
                        'mt-1 w-8 shrink-0 font-mono text-sm transition-colors duration-300 md:text-base',
                        isFirst
                          ? 'text-trail-400'
                          : 'text-ink-600 group-hover:text-signal-400',
                      )}
                    >
                      {String(index + 1).padStart(2, '0')}
                    </span>

                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-xl font-semibold leading-tight text-ink-50 md:text-3xl">
                        {place.displayName}
                      </h3>
                      <p className="mt-1.5 text-sm text-ink-400">
                        <NumberTicker value={place.visitCount} delay={index * 0.06} />{' '}
                        {visitsWord(place.visitCount)}
                        {place.category && ` · ${place.category}`}
                        {place.district && ` · ${place.district}`}
                      </p>

                      <div className="mt-3.5 h-1 w-full overflow-hidden rounded-full bg-ink-800">
                        <motion.div
                          className={cn(
                            'h-full rounded-full',
                            isFirst ? 'bg-trail-400' : 'bg-signal-500/70',
                          )}
                          style={{
                            boxShadow: isFirst
                              ? '0 0 14px rgba(245, 158, 11, 0.5)'
                              : undefined,
                          }}
                          initial={prefersReducedMotion ? false : { width: 0 }}
                          whileInView={{ width: `${Math.max(share * 100, 2)}%` }}
                          viewport={{ once: true, amount: 0.5 }}
                          transition={{
                            duration: 1,
                            delay: prefersReducedMotion ? 0 : index * 0.07,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                        />
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p
                        className={cn(
                          'font-display text-lg font-semibold md:text-2xl',
                          isFirst ? 'text-trail-300' : 'text-ink-200',
                        )}
                      >
                        {formatDuration(place.totalDurationSec)}
                      </p>
                      {/* The raw total ("324 дні") is easy to misread as a
                          single continuous stay; the per-day average makes
                          the same number immediately sensible. */}
                      {hoursPerDay >= 0.1 && (
                        <p className="mt-1 font-mono text-xs text-ink-400">
                          ≈ <NumberTicker value={hoursPerDay} decimals={1} delay={index * 0.06} />{' '}
                          год/день
                        </p>
                      )}
                    </div>
                  </div>
                </SpotlightCard>
              </li>
            </Reveal>
          )
        })}
      </ol>
    </StorySection>
  )
}
