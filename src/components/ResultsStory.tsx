import { useMemo, useRef, useState } from 'react'
import { CalendarX, Loader2, Route } from 'lucide-react'
import type { ParsedPoints } from '../parsing/types'
import type { AnalyticsState } from '../hooks/useAnalytics'
import type { AnalyticsResult } from '../analytics/runAnalytics'
import type { GeocodingState } from '../hooks/useGeocoding'
import type { DisplayPlace } from '../analytics/placeInsights'
import type { Place } from '../analytics/places'
import { summarizeCategories, summarizeDistricts } from '../analytics/placeInsights'
import type { GeocodedPlace } from '../analytics/geocoding'
import { HeroSection } from './story/HeroSection'
import { MapSection } from './story/MapSection'
import { TopPlacesSection } from './story/TopPlacesSection'
import { DistrictsSection } from './story/DistrictsSection'
import { TimePatternsSection } from './story/TimePatternsSection'
import { CategoriesSection } from './story/CategoriesSection'
import { OutroSection } from './story/OutroSection'
import { TimeRangeFilter } from './story/TimeRangeFilter'
import { describeRange, type AvailablePeriods, type RangeSelection } from '../analytics/timeRange'
import type { MapLayer } from './MapView'
import { cn } from '../lib/cn'

// Below this, a "place" is somewhere you passed through rather than stayed.
const MIN_MEANINGFUL_STAY_SEC = 15 * 60

// Module-level constant so the "no places yet" case keeps a stable identity
// across renders instead of handing the memos a new array each time.
const EMPTY_PLACES: Place[] = []

type ResultsStoryProps = {
  points: ParsedPoints
  analytics: AnalyticsState
  geocoding: GeocodingState
  displayPlaces?: DisplayPlace[]
  periods: AvailablePeriods
  range: RangeSelection
  onRangeChange: (range: RangeSelection) => void
  onLoadAnother: () => void
}

/**
 * The results view: a full-screen vertical scroll where each screen reveals
 * exactly one insight, rather than a dashboard competing for one viewport.
 *
 * Deliberately no CSS scroll-snap. With sections that can exceed the
 * viewport on a short screen (the places list), mandatory snapping fights
 * the reader for control and can strand content between snap points; plain
 * smooth scrolling degrades far more gracefully.
 */
export function ResultsStory({
  points,
  analytics,
  geocoding,
  displayPlaces,
  periods,
  range,
  onRangeChange,
  onLoadAnother,
}: ResultsStoryProps) {
  const [mapLayer, setMapLayer] = useState<MapLayer>('heat')

  // The last result that finished, kept so a range change doesn't blank the
  // screen. Without it, every uncached period replaces the whole story with
  // a full-page spinner and then rebuilds it — the reader loses their scroll
  // position and the page appears to reload on what should feel like a
  // filter. Holding the previous numbers and dimming them instead keeps the
  // change legible as an update to something already on screen.
  const lastResultRef = useRef<AnalyticsResult | null>(null)
  if (analytics.status === 'done') lastResultRef.current = analytics.result
  const result = analytics.status === 'done' ? analytics.result : lastResultRef.current
  const recomputing = analytics.status === 'running' && result !== null

  // The engine works on its own time-sorted copy, so the span is derived
  // here from the raw parsed points instead of assuming input order.
  const spanDays = useMemo(() => {
    const n = points.timestampSec.length
    if (n === 0) return 0
    let min = Infinity
    let max = -Infinity
    for (let i = 0; i < n; i++) {
      const t = points.timestampSec[i]
      if (t < min) min = t
      if (t > max) max = t
    }
    return (max - min) / 86400
  }, [points])

  // Both of these feed the memos below, so they have to be stable
  // references themselves — a fresh `new Map()`/`[]` each render would make
  // every downstream useMemo recompute on every render and memoize nothing.
  const geocodedMap: Map<number, GeocodedPlace> = useMemo(
    () => (geocoding.status === 'done' ? geocoding.results : new Map()),
    [geocoding],
  )

  const allPlaces = useMemo(
    () => result?.places ?? EMPTY_PLACES,
    [result],
  )

  // Clustering legitimately finds spots you only ever passed through — a
  // corner seen 35 times but never for more than a ping. Those are real,
  // but they don't belong on screens headed "where you spent the longest",
  // where they'd read as broken ("35 візитів · 2 хв"). Filtering is done
  // here, at the presentation layer, rather than in the engine: the numbers
  // aren't wrong, they're just not what these particular screens are about.
  const places = useMemo(() => {
    const significant = allPlaces.filter((p) => p.totalDurationSec >= MIN_MEANINGFUL_STAY_SEC)
    // Sparse histories can leave nothing above the bar; showing the real
    // ranking beats showing an empty story.
    return significant.length > 0 ? significant : allPlaces
  }, [allPlaces])

  const categories = useMemo(
    () => summarizeCategories(places, geocodedMap),
    [places, geocodedMap],
  )
  const districts = useMemo(
    () => summarizeDistricts(places, geocodedMap),
    [places, geocodedMap],
  )

  const significantDisplayPlaces = useMemo(() => {
    if (!displayPlaces) return undefined
    const keep = new Set(places.map((p) => p.clusterId))
    return displayPlaces.filter((p) => keep.has(p.clusterId))
  }, [displayPlaces, places])

  // The chrome is identical in every state, so it's built once here rather
  // than repeated in each early return. Crucially the FILTER lives in it:
  // if a period fails or is still computing, the reader has to be able to
  // pick a different one without reloading the file.
  const chrome = (
    <header className="fixed inset-x-0 top-0 z-[1000] border-b border-ink-800/60 bg-ink-950/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-6 py-4 md:px-10">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 font-display text-lg font-semibold tracking-tight text-ink-50">
            <Route className="h-5 w-5 text-trail-400" strokeWidth={2.2} />
            Trailback
          </div>

          <div className="flex items-center gap-3">
            {recomputing && (
              <span className="flex items-center gap-2 font-mono text-[10px] text-ink-400">
                <Loader2 className="h-3 w-3 animate-spin text-trail-400" />
                Перераховуємо
              </span>
            )}
            {geocoding.status === 'running' && (
              <span className="flex items-center gap-2 rounded-full border border-ink-800 bg-ink-900/80 px-3 py-1.5 font-mono text-[10px] text-ink-400">
                <Loader2 className="h-3 w-3 animate-spin text-trail-400" />
                Розпізнаємо назви {geocoding.progress.completed}/{geocoding.progress.total}
              </span>
            )}
          </div>
        </div>

        <TimeRangeFilter
          periods={periods}
          selection={range}
          onChange={onRangeChange}
          busy={recomputing}
        />
      </div>
    </header>
  )

  if (analytics.status === 'error') {
    return (
      <div className="relative min-h-svh bg-ink-950">
        {chrome}
        <div className="flex min-h-svh items-center justify-center px-6 text-center">
          <p className="max-w-md text-sm text-red-200">{analytics.message}</p>
        </div>
      </div>
    )
  }

  // Only on the very first run, when there is genuinely nothing to show yet.
  if (!result) {
    return (
      <div className="relative min-h-svh bg-ink-950">
        {chrome}
        <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-trail-400" />
          <p className="text-sm text-ink-200">Збираємо історію твого життя…</p>
        </div>
      </div>
    )
  }

  // A period can be listed (it has pings) yet hold nothing the engine can
  // describe — a couple of stray points with no recurring place. Saying so
  // beats rendering a story of zeroes.
  if (result.pointCount === 0) {
    return (
      <div className="relative min-h-svh bg-ink-950">
        {chrome}
        <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
          <CalendarX className="h-6 w-6 text-ink-400" />
          <p className="max-w-sm text-sm text-ink-200">
            За період «{describeRange(range)}» немає даних. Обери інший період
            угорі.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative bg-ink-950">
      {chrome}

      {/* Dimming the whole story while a new period is computed keeps the
          numbers on screen but marks them as stale, so nobody reads an old
          figure as the answer for the period they just picked. */}
      <main
        className={cn(
          'transition-opacity duration-300',
          recomputing && 'pointer-events-none opacity-40',
        )}
      >
        <HeroSection
          pointCount={result.pointCount}
          spanDays={spanDays}
          placeCount={places.length}
          rangeLabel={describeRange(range)}
          isFullHistory={range.kind === 'all'}
        />

        <MapSection
          points={points}
          places={significantDisplayPlaces}
          layer={mapLayer}
          onLayerChange={setMapLayer}
        />

        {significantDisplayPlaces && (
          <TopPlacesSection places={significantDisplayPlaces} spanDays={spanDays} />
        )}

        <DistrictsSection
          districts={districts}
          geocodingPending={geocoding.status === 'running'}
        />

        <TimePatternsSection timePatterns={result.timePatterns} />

        <CategoriesSection categories={categories} />

        <OutroSection distance={result.distance} onLoadAnother={onLoadAnother} />
      </main>
    </div>
  )
}
