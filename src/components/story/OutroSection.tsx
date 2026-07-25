import { ArrowUp, RotateCcw } from 'lucide-react'
import { StorySection } from './StorySection'
import { Reveal } from './Reveal'
import { formatDate, formatDuration, formatNumber } from './format'
import type { DistanceStats } from '../../analytics/distanceStats'

type OutroSectionProps = {
  distance: DistanceStats
  onLoadAnother: () => void
}

function StatCard({
  label,
  value,
  meta,
}: {
  label: string
  value: string
  meta?: string
}) {
  return (
    <div className="rounded-2xl border border-ink-800 bg-ink-900/50 p-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">{label}</p>
      <p className="mt-3 font-display text-2xl font-semibold text-ink-50 md:text-3xl">{value}</p>
      {meta && <p className="mt-1.5 text-xs text-ink-400">{meta}</p>}
    </div>
  )
}

export function OutroSection({ distance, onLoadAnother }: OutroSectionProps) {
  const totalKm =
    distance.totalKmByMode.walk + distance.totalKmByMode.transit + distance.totalKmByMode.drive

  return (
    <StorySection
      eyebrow="Підсумок"
      title={
        <>
          Разом ти подолав
          <br />
          <span className="text-trail-400">{formatNumber(totalKm)} км</span>
        </>
      }
      subtitle="Це вся дистанція, яку зафіксував твій телефон за весь час історії."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Reveal index={0}>
          <StatCard label="Пішки" value={`${formatNumber(distance.totalKmByMode.walk)} км`} />
        </Reveal>
        <Reveal index={1}>
          <StatCard
            label="Транспортом"
            value={`${formatNumber(distance.totalKmByMode.transit)} км`}
          />
        </Reveal>
        <Reveal index={2}>
          <StatCard label="За кермом" value={`${formatNumber(distance.totalKmByMode.drive)} км`} />
        </Reveal>

        {distance.farthestDay && (
          <Reveal index={3}>
            <StatCard
              label="Найактивніший день"
              value={`${formatNumber(distance.farthestDay.km)} км`}
              meta={formatDate(distance.farthestDay.dateISO)}
            />
          </Reveal>
        )}

        {distance.longestJourney && (
          <Reveal index={4}>
            <StatCard
              label="Найдовша подорож"
              value={`${formatNumber(distance.longestJourney.km)} км`}
              meta={`за ${formatDuration(distance.longestJourney.durationSec)}`}
            />
          </Reveal>
        )}
      </div>

      <Reveal index={5}>
        <div className="mt-14 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onLoadAnother}
            className="inline-flex items-center gap-2 rounded-xl bg-trail-500 px-6 py-3 text-sm font-medium text-ink-950 transition hover:bg-trail-400"
          >
            <RotateCcw className="h-4 w-4" />
            Завантажити інший файл
          </button>

          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="inline-flex items-center gap-2 rounded-xl border border-ink-700 px-6 py-3 text-sm text-ink-200 transition hover:border-ink-600 hover:text-ink-50"
          >
            <ArrowUp className="h-4 w-4" />
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
