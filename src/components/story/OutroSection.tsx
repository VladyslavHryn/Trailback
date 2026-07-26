import { ArrowUp, Car, Footprints, Mountain, RotateCcw, Route, TramFront } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { StorySection } from './StorySection'
import { Reveal } from './Reveal'
import { formatDate, formatDuration } from './format'
import { NumberTicker } from '../ui/NumberTicker'
import { SpotlightCard } from '../ui/SpotlightCard'
import { BorderBeam } from '../ui/BorderBeam'
import { cn } from '../../lib/cn'
import type { DistanceStats } from '../../analytics/distanceStats'

type OutroSectionProps = {
  distance: DistanceStats
  onLoadAnother: () => void
}

type StatCardProps = {
  label: string
  value: number
  suffix?: string
  meta?: string
  icon: LucideIcon
  className?: string
  /** Only the one card that carries the section's headline insight. */
  featured?: boolean
  /** Stagger position, shared with the ticker so both land together. */
  index?: number
}

function StatCard({
  label,
  value,
  suffix = '',
  meta,
  icon: Icon,
  className,
  featured = false,
  index = 0,
}: StatCardProps) {
  return (
    <SpotlightCard
      className={cn('h-full', className)}
      glow={featured ? 'rgba(245, 158, 11, 0.18)' : 'rgba(37, 199, 156, 0.12)'}
    >
      {featured && <BorderBeam duration={8} />}

      <div className="flex h-full flex-col p-6">
        <div className="flex items-center gap-2.5">
          <Icon
            className={cn(
              'h-4 w-4 transition-colors duration-300',
              featured ? 'text-trail-400' : 'text-ink-400 group-hover:text-signal-400',
            )}
            strokeWidth={2}
          />
          <p className="text-label-micro text-ink-400">
            {label}
          </p>
        </div>

        <p
          className={cn(
            'mt-auto pt-6 font-display font-semibold tracking-tight',
            featured
              ? 'text-3xl text-trail-300 md:text-5xl'
              : 'text-2xl text-ink-50 md:text-3xl',
          )}
        >
          <NumberTicker value={value} suffix={suffix} delay={index * 0.08} />
        </p>
        {meta && <p className="mt-1.5 text-xs text-ink-400">{meta}</p>}
      </div>
    </SpotlightCard>
  )
}

export function OutroSection({ distance, onLoadAnother }: OutroSectionProps) {
  const totalKm =
    distance.totalKmByMode.walk + distance.totalKmByMode.transit + distance.totalKmByMode.drive

  return (
    <StorySection eyebrow="Підсумок" index="07">
      {/* The headline number is pulled out of StorySection's title slot and
          given its own block, so it can be set far larger than a headline
          would allow and sit on the same left axis as everything else. */}
      <Reveal>
        <div className="border-b border-ink-800 pb-10">
          <p className="text-label-micro text-ink-400">
            Разом ти подолав
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-2">
            <p className="numeral-hero text-trail-400">
              <NumberTicker value={totalKm} />
            </p>
            <p className="pb-3 font-mono text-xs uppercase tracking-[0.18em] text-ink-400 md:text-sm">
              кілометрів
            </p>
          </div>
          <p className="mt-6 max-w-[46ch] text-sm leading-relaxed text-ink-400 md:text-base">
            Це вся дистанція, яку зафіксував твій телефон за весь час історії.
          </p>
        </div>
      </Reveal>

      <div className="mt-12">
      {/* Bento rather than a uniform grid: the three transport modes are
          peers and read fine as small tiles, while the two "single most
          extreme moment" stats are the memorable ones and get the wide
          slots. Equal-sized cards would flatten that difference away. */}
      <div className="grid gap-4 md:grid-cols-6">
        <Reveal index={0} className="md:col-span-2">
          <StatCard
            label="Пішки"
            value={distance.totalKmByMode.walk}
            suffix=" км"
            icon={Footprints}
            index={0}
          />
        </Reveal>
        <Reveal index={1} className="md:col-span-2">
          <StatCard
            label="Транспортом"
            value={distance.totalKmByMode.transit}
            suffix=" км"
            icon={TramFront}
            index={1}
          />
        </Reveal>
        <Reveal index={2} className="md:col-span-2">
          <StatCard
            label="За кермом"
            value={distance.totalKmByMode.drive}
            suffix=" км"
            icon={Car}
            index={2}
          />
        </Reveal>

        {distance.farthestDay && (
          <Reveal index={3} className="md:col-span-3">
            <StatCard
              label="Найактивніший день"
              value={distance.farthestDay.km}
              suffix=" км"
              meta={formatDate(distance.farthestDay.dateISO)}
              icon={Mountain}
              featured
              index={3}
            />
          </Reveal>
        )}

        {distance.longestJourney && (
          <Reveal index={4} className="md:col-span-3">
            <StatCard
              label="Найдовша подорож"
              value={distance.longestJourney.km}
              suffix=" км"
              meta={`за ${formatDuration(distance.longestJourney.durationSec)}`}
              icon={Route}
              index={4}
            />
          </Reveal>
        )}
        </div>
      </div>

      <Reveal index={5}>
        <div className="mt-14 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onLoadAnother}
            className="group inline-flex items-center gap-2 rounded-xl bg-trail-500 px-6 py-3 text-sm font-medium text-ink-950 transition-all duration-300 hover:bg-trail-400 hover:shadow-[0_0_28px_rgba(245,158,11,0.4)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trail-400"
          >
            <RotateCcw className="h-4 w-4 transition-transform duration-500 group-hover:-rotate-180" />
            Завантажити інший файл
          </button>

          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="group inline-flex items-center gap-2 rounded-xl border border-ink-700 px-6 py-3 text-sm text-ink-200 transition-colors duration-300 hover:border-ink-600 hover:text-ink-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal-400"
          >
            <ArrowUp className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5" />
            До початку
          </button>
        </div>
      </Reveal>

      {/* No share button on purpose: everything on these screens is derived
          from someone's precise movement history, so a one-tap "share"
          would make leaking it the path of least resistance. */}
      <Reveal index={6}>
        <p className="mt-10 max-w-2xl text-xs leading-relaxed text-ink-400">
          Сам файл нікуди не надсилався — уся ця аналітика порахована просто у
          браузері. Єдиний виняток: щоб дізнатися назви й райони, до
          OpenStreetMap надсилались округлені координати центрів твоїх
          топ-місць. Онови сторінку — і від усього цього не лишиться нічого.
        </p>
      </Reveal>
    </StorySection>
  )
}
