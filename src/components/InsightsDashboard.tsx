import {
  Compass,
  Loader2,
  MapPin,
  MapPinOff,
  MapPinPlus,
  Route,
  ShieldCheck,
  Tag,
  TrendingUp,
} from 'lucide-react'
import type { AnalyticsState } from '../hooks/useAnalytics'
import type { GeocodingState } from '../hooks/useGeocoding'
import type { DisplayPlace } from '../analytics/placeInsights'
import { summarizeCategories, summarizeDistricts } from '../analytics/placeInsights'
import type { GeocodedPlace } from '../analytics/geocoding'
import { MiniBarChart, MiniLineChart, CoverageGrid } from './InsightCharts'

type InsightsDashboardProps = {
  analytics: AnalyticsState
  geocoding: GeocodingState
  displayPlaces?: DisplayPlace[]
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

function formatMonthLabel(month: string): string {
  const date = new Date(`${month}-01T00:00:00Z`)
  return date.toLocaleDateString('uk-UA', { month: 'short', timeZone: 'UTC' })
}

const HOUR_LABELS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'))
const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-ink-700 bg-ink-950/40 p-3">
      <h3 className="mb-2.5 flex items-center gap-2 text-xs font-medium text-ink-200">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  )
}

function PlaceListItem({ place }: { place: DisplayPlace }) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-lg border border-ink-700 bg-ink-950/60 px-2.5 py-1.5 text-xs">
      <span className="text-ink-200">
        {place.displayName}
        {place.category && <span className="text-ink-500"> · {place.category}</span>}
      </span>
      <span className="shrink-0 text-right text-ink-400">
        {place.visitCount} візитів · {formatDuration(place.totalDurationSec)}
      </span>
    </li>
  )
}

export function InsightsDashboard({ analytics, geocoding, displayPlaces }: InsightsDashboardProps) {
  if (analytics.status === 'idle') return null

  if (analytics.status === 'running') {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-ink-200">
        <Loader2 className="h-4 w-4 animate-spin text-trail-400" />
        Обчислюємо аналітику всієї історії...
      </div>
    )
  }

  if (analytics.status === 'error') {
    return <div className="p-4 text-sm text-red-200">{analytics.message}</div>
  }

  const { distance, footprintByMonth, placeLifecycle, coverage, timePatterns } = analytics.result
  const places = displayPlaces ?? []
  const totalKm =
    distance.totalKmByMode.walk + distance.totalKmByMode.transit + distance.totalKmByMode.drive

  const geocodedMap: Map<number, GeocodedPlace> =
    geocoding.status === 'done' ? geocoding.results : new Map()
  const categories = summarizeCategories(analytics.result.places, geocodedMap)
  const districts = summarizeDistricts(analytics.result.places, geocodedMap)

  const displayByClusterId = new Map(places.map((p) => [p.clusterId, p]))
  const abandonedDisplay = placeLifecycle.abandoned
    .map((p) => displayByClusterId.get(p.clusterId))
    .filter((p): p is DisplayPlace => p != null)
  const newDisplay = placeLifecycle.newPlaces
    .map((p) => displayByClusterId.get(p.clusterId))
    .filter((p): p is DisplayPlace => p != null)

  return (
    <div className="flex flex-col gap-3 p-4 text-ink-50">
      <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
        <TrendingUp className="h-4 w-4 text-trail-400" />
        Аналітика твоєї геоісторії
      </h2>

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
        Разом <span className="font-medium text-ink-200">{formatKm(totalKm)} км</span> за весь
        час
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

      {footprintByMonth.length > 1 && (
        <SectionCard
          title="Географія життя у часі"
          icon={<Compass className="h-3.5 w-3.5 text-trail-400" />}
        >
          <MiniLineChart
            series={[
              {
                label: 'Розмах, км',
                color: 'var(--color-trail-500)',
                values: footprintByMonth.map((m) => m.radiusOfGyrationKm),
              },
              {
                label: 'Зсув від центру, км',
                color: 'var(--color-signal-500)',
                values: footprintByMonth.map((m) => m.shiftFromOverallCentroidKm),
              },
            ]}
            xLabels={footprintByMonth.map((m) => formatMonthLabel(m.month))}
          />
        </SectionCard>
      )}

      <SectionCard
        title="Покинуті та нові місця"
        icon={<MapPinOff className="h-3.5 w-3.5 text-trail-400" />}
      >
        <div className="grid grid-cols-1 gap-3">
          <div>
            <h4 className="mb-1.5 flex items-center gap-1.5 text-[11px] text-ink-400">
              <MapPinOff className="h-3 w-3" />
              Покинуті ({abandonedDisplay.length})
            </h4>
            {abandonedDisplay.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {abandonedDisplay.slice(0, 4).map((place) => (
                  <PlaceListItem key={place.clusterId} place={place} />
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-ink-500">Немає покинутих місць.</p>
            )}
          </div>
          <div>
            <h4 className="mb-1.5 flex items-center gap-1.5 text-[11px] text-ink-400">
              <MapPinPlus className="h-3 w-3" />
              Нові ({newDisplay.length})
            </h4>
            {newDisplay.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {newDisplay.slice(0, 4).map((place) => (
                  <PlaceListItem key={place.clusterId} place={place} />
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-ink-500">Немає нових місць.</p>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Покриття території"
        icon={<Compass className="h-3.5 w-3.5 text-trail-400" />}
      >
        <div className="flex items-center gap-3">
          <CoverageGrid
            rows={coverage.gridRows}
            cols={coverage.gridCols}
            visited={coverage.visited}
          />
          <div className="text-xs">
            <div className="font-display text-lg font-semibold text-trail-300">
              {Math.round(coverage.coverageRatio * 100)}%
            </div>
            <p className="text-ink-400">
              досліджено території навколо твоїх місць ({coverage.visitedCells} з{' '}
              {coverage.totalCells} зон)
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Коли ти найактивніший"
        icon={<TrendingUp className="h-3.5 w-3.5 text-trail-400" />}
      >
        <div className="flex flex-col gap-3">
          <div>
            <p className="mb-1 text-[11px] text-ink-400">
              За годинами · найактивніша: {String(timePatterns.busiestHour).padStart(2, '0')}:00
            </p>
            <MiniBarChart
              values={timePatterns.byHour}
              labels={HOUR_LABELS}
              highlightIndex={timePatterns.busiestHour}
              labelStep={3}
            />
          </div>
          <div>
            <p className="mb-1 text-[11px] text-ink-400">
              За днями тижня · найактивніший: {WEEKDAY_LABELS[timePatterns.busiestWeekdayIndex]}
            </p>
            <MiniBarChart
              values={timePatterns.byWeekday}
              labels={WEEKDAY_LABELS}
              highlightIndex={timePatterns.busiestWeekdayIndex}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Топ місць твого життя" icon={<MapPin className="h-3.5 w-3.5 text-trail-400" />}>
        {geocoding.status === 'running' && (
          <p className="mb-2 flex items-center gap-1.5 text-[11px] text-ink-500">
            <Loader2 className="h-3 w-3 animate-spin" />
            Розпізнаємо назви: {geocoding.progress.completed}/{geocoding.progress.total}
          </p>
        )}
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
                <span>
                  {place.displayName}
                  {place.category && <span className="text-ink-500"> · {place.category}</span>}
                </span>
              </span>
              <span className="shrink-0 text-right text-ink-400">
                {place.visitCount} візитів
                <br />
                {formatDuration(place.totalDurationSec)}
              </span>
            </li>
          ))}
        </ol>
        {places.length === 0 && <p className="text-xs text-ink-400">Не знайдено стабільних місць.</p>}

        <p className="mt-2.5 flex items-start gap-1.5 text-[10px] text-ink-500">
          <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-signal-400" />
          Назви та райони визначаються через OpenStreetMap Nominatim — надсилаються лише
          округлені координати центрів твоїх топ-місць, без прив'язки до окремих візитів.
        </p>
      </SectionCard>

      {categories.length > 0 && (
        <SectionCard title="Категорії місць" icon={<Tag className="h-3.5 w-3.5 text-trail-400" />}>
          <ul className="flex flex-col gap-1.5">
            {categories.slice(0, 6).map((c) => (
              <li key={c.category} className="flex items-center justify-between text-xs">
                <span className="text-ink-200">{c.category}</span>
                <span className="text-ink-400">{formatDuration(c.totalDurationSec)}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {districts.length > 0 && (
        <SectionCard
          title="Райони твого життя"
          icon={<MapPin className="h-3.5 w-3.5 text-trail-400" />}
        >
          <ul className="flex flex-col gap-1.5">
            {districts.slice(0, 6).map((d) => (
              <li key={d.district} className="flex flex-col gap-0.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-ink-200">{d.district}</span>
                  <span className="text-ink-400">
                    {Math.round(d.shareOfKnownTime * 100)}% · {formatDuration(d.totalDurationSec)}
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-ink-800">
                  <div
                    className="h-full rounded-full bg-trail-500"
                    style={{ width: `${Math.round(d.shareOfKnownTime * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] text-ink-500">
            Відсотки — лише серед топ-місць, для яких вдалося визначити район.
          </p>
        </SectionCard>
      )}
    </div>
  )
}
