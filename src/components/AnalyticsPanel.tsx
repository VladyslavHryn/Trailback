import { Loader2, MapPin, Route, TrendingUp } from 'lucide-react'
import type { AnalyticsState } from '../hooks/useAnalytics'

type AnalyticsPanelProps = {
  state: AnalyticsState
}

function formatKm(km: number): string {
  return km.toLocaleString('uk-UA', { maximumFractionDigits: 0 })
}

function formatDuration(seconds: number): string {
  const hours = seconds / 3600
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    const remHours = Math.round(hours % 24)
    return `${days} дн ${remHours} год`
  }
  if (hours >= 1) return `${hours.toFixed(1)} год`
  return `${Math.round(seconds / 60)} хв`
}

function formatDate(dateISO: string): string {
  const date = new Date(`${dateISO}T00:00:00Z`)
  return date.toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function AnalyticsPanel({ state }: AnalyticsPanelProps) {
  if (state.status === 'idle') return null

  if (state.status === 'running') {
    return (
      <div className="absolute left-3 top-3 z-[500] flex items-center gap-2 rounded-xl border border-ink-700 bg-ink-900/90 px-4 py-2.5 text-sm text-ink-200 shadow-lg backdrop-blur-sm">
        <Loader2 className="h-4 w-4 animate-spin text-trail-400" />
        Обчислюємо аналітику всієї історії...
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="absolute left-3 top-3 z-[500] max-w-xs rounded-xl border border-red-500/30 bg-ink-900/90 px-4 py-2.5 text-sm text-red-200 shadow-lg backdrop-blur-sm">
        {state.message}
      </div>
    )
  }

  const { distance, places } = state.result
  const totalKm =
    distance.totalKmByMode.walk + distance.totalKmByMode.transit + distance.totalKmByMode.drive

  return (
    <div className="absolute left-3 top-3 z-[500] flex max-h-[calc(100%-1.5rem)] w-80 flex-col gap-3 overflow-y-auto rounded-2xl border border-ink-700 bg-ink-900/90 p-4 text-ink-50 shadow-2xl backdrop-blur-sm">
      <div>
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
          <TrendingUp className="h-4 w-4 text-trail-400" />
          Аналітика твоєї геоісторії
        </h2>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-ink-700 bg-ink-950/60 p-2">
          <div className="font-display text-sm font-semibold text-trail-300">
            {formatKm(distance.totalKmByMode.walk)}
          </div>
          <div className="mt-0.5 text-[10px] text-ink-400">км пішки</div>
        </div>
        <div className="rounded-lg border border-ink-700 bg-ink-950/60 p-2">
          <div className="font-display text-sm font-semibold text-trail-300">
            {formatKm(distance.totalKmByMode.transit)}
          </div>
          <div className="mt-0.5 text-[10px] text-ink-400">км транспортом</div>
        </div>
        <div className="rounded-lg border border-ink-700 bg-ink-950/60 p-2">
          <div className="font-display text-sm font-semibold text-trail-300">
            {formatKm(distance.totalKmByMode.drive)}
          </div>
          <div className="mt-0.5 text-[10px] text-ink-400">км за кермом</div>
        </div>
      </div>

      <p className="text-xs text-ink-400">
        Разом{' '}
        <span className="font-medium text-ink-200">{formatKm(totalKm)} км</span> за
        весь час
      </p>

      {distance.farthestDay && (
        <div className="flex items-start gap-2 rounded-lg border border-ink-700 bg-ink-950/60 p-2.5">
          <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-signal-400" />
          <div className="text-xs">
            <div className="text-ink-200">
              Найактивніший день: {formatKm(distance.farthestDay.km)} км
            </div>
            <div className="text-ink-400">{formatDate(distance.farthestDay.dateISO)}</div>
          </div>
        </div>
      )}

      {distance.longestJourney && (
        <div className="flex items-start gap-2 rounded-lg border border-ink-700 bg-ink-950/60 p-2.5">
          <Route className="mt-0.5 h-3.5 w-3.5 shrink-0 text-signal-400" />
          <div className="text-xs">
            <div className="text-ink-200">
              Найдовша подорож: {formatKm(distance.longestJourney.km)} км
            </div>
            <div className="text-ink-400">
              за {formatDuration(distance.longestJourney.durationSec)}
            </div>
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-2 flex items-center gap-2 text-xs font-medium text-ink-200">
          <MapPin className="h-3.5 w-3.5 text-trail-400" />
          Топ місць твого життя
        </h3>
        <ol className="flex flex-col gap-1.5">
          {places.slice(0, 8).map((place, index) => (
            <li
              key={place.clusterId}
              className="flex items-center justify-between gap-2 rounded-lg border border-ink-700 bg-ink-950/60 px-2.5 py-1.5 text-xs"
            >
              <span className="flex items-center gap-2 text-ink-200">
                <span className="font-mono text-trail-400">
                  {String(index + 1).padStart(2, '0')}
                </span>
                {place.lat.toFixed(3)}, {place.lng.toFixed(3)}
              </span>
              <span className="shrink-0 text-right text-ink-400">
                {place.visitCount} візитів
                <br />
                {formatDuration(place.totalDurationSec)}
              </span>
            </li>
          ))}
        </ol>
        {places.length === 0 && (
          <p className="text-xs text-ink-400">Не знайдено стабільних місць.</p>
        )}
      </div>
    </div>
  )
}
