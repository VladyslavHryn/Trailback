import { motion, useReducedMotion } from 'framer-motion'
import { StorySection } from './StorySection'
import { Reveal } from './Reveal'
import { formatDaysUniform, formatDuration, visitsWord } from './format'
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

/**
 * "Where you spent the longest."
 *
 * HIERARCHY: the top place gets a full-width panel with its duration set
 * enormous; the runners-up become a dense two-column list of thin rows. That
 * asymmetry is the content's own shape — in every real history the first place
 * dwarfs the rest, usually by multiples — so six identically-sized cards
 * actively misrepresented the data while also looking like a template.
 */
export function TopPlacesSection({ places, spanDays }: TopPlacesSectionProps) {
  const prefersReducedMotion = useReducedMotion()
  const shown = places.slice(0, MAX_PLACES)
  if (shown.length === 0) return null

  const [leader, ...rest] = shown
  const leaderHoursPerDay = spanDays > 0 ? leader.totalDurationSec / 3600 / spanDays : 0

  return (
    <StorySection
      eyebrow="Місця твого життя"
      index="03"
      title="Де ти був найдовше"
      subtitle="Кожне з цих місць твій телефон бачив сотні разів. Разом вони — майже весь твій час."
    >
      <Reveal>
        <SpotlightCard className="border-trail-500/25" glow="rgba(245, 158, 11, 0.16)">
          <BorderBeam duration={9} />

          <div className="grid gap-8 p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:p-8">
            <div className="min-w-0">
              <p className="text-label-micro text-trail-400">
                01 · Головне місце
              </p>
              <h3 className="mt-3 font-display text-3xl font-semibold leading-[1.05] tracking-tight text-ink-50 md:text-5xl">
                {leader.displayName}
              </h3>
              <p className="mt-4 font-mono text-xs text-ink-400">
                <NumberTicker value={leader.visitCount} /> {visitsWord(leader.visitCount)}
                {leader.category && ` · ${leader.category}`}
                {leader.district && ` · ${leader.district}`}
              </p>
            </div>

            {/* The one number this screen exists to deliver, at a size
                nothing else on the card competes with. */}
            <div className="md:text-right">
              <p className="text-label-micro text-ink-400">
                Годин на день
              </p>
              <p className="numeral-display text-trail-300">
                <NumberTicker value={leaderHoursPerDay} decimals={1} />
              </p>
              <p className="mt-2 font-mono text-xs text-ink-400">
                усього {formatDuration(leader.totalDurationSec)}
              </p>
            </div>
          </div>
        </SpotlightCard>
      </Reveal>

      {rest.length > 0 && (
        <ol className="mt-4 grid gap-x-10 sm:grid-cols-2">
          {rest.map((place, i) => {
            const index = i + 1
            const hoursPerDay = spanDays > 0 ? place.totalDurationSec / 3600 / spanDays : 0
            const share = place.totalDurationSec / (leader.totalDurationSec || 1)

            return (
              <Reveal key={place.clusterId} index={i}>
                <li className="group border-b border-ink-800 py-5">
                  <div className="flex items-baseline gap-4">
                    <span className="w-6 shrink-0 font-mono text-xs text-ink-600 transition-colors duration-300 group-hover:text-signal-400">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <h3 className="min-w-0 flex-1 truncate font-display text-lg font-medium text-ink-50 md:text-xl">
                      {place.displayName}
                    </h3>
                    <span className="shrink-0 font-mono text-xs text-ink-200">
                      {formatDaysUniform(place.totalDurationSec)}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-4 pl-10">
                    <div className="h-px flex-1 overflow-hidden bg-ink-800">
                      <motion.div
                        className="h-full bg-signal-500/80"
                        initial={prefersReducedMotion ? false : { width: 0 }}
                        whileInView={{ width: `${Math.max(share * 100, 2)}%` }}
                        viewport={{ once: true, amount: 0.5 }}
                        transition={{
                          duration: 1,
                          delay: prefersReducedMotion ? 0 : i * 0.07,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                      />
                    </div>
                    <span
                      className={cn(
                        'shrink-0 font-mono text-[10px] text-ink-400',
                        hoursPerDay < 0.1 && 'invisible',
                      )}
                    >
                      {hoursPerDay.toFixed(1)} год/день
                    </span>
                  </div>
                </li>
              </Reveal>
            )
          })}
        </ol>
      )}
    </StorySection>
  )
}
