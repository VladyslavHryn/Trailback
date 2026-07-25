import { useMemo } from 'react'
import { Loader2, Route } from 'lucide-react'
import type { ParsedPoints } from '../parsing/types'
import type { AnalyticsState } from '../hooks/useAnalytics'
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
  onLoadAnother,
}: ResultsStoryProps) {
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
    () => (analytics.status === 'done' ? analytics.result.places : EMPTY_PLACES),
    [analytics],
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

  if (analytics.status === 'error') {
    return (
      <div className="flex min-h-svh items-center justify-center px-6 text-center">
        <p className="max-w-md text-sm text-red-200">{analytics.message}</p>
      </div>
    )
  }

  if (analytics.status !== 'done') {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-trail-400" />
        <p className="text-sm text-ink-200">Збираємо історію твого життя…</p>
      </div>
    )
  }

  const result = analytics.result

  return (
    <div className="relative bg-ink-950">
      <header className="fixed inset-x-0 top-0 z-[1000] flex items-center justify-between px-6 py-5 md:px-10">
        <div className="flex items-center gap-2 font-display text-sm font-semibold text-ink-50">
          <Route className="h-4 w-4 text-trail-400" strokeWidth={2.2} />
          Trailback
        </div>
        {geocoding.status === 'running' && (
          <span className="flex items-center gap-2 rounded-full border border-ink-800 bg-ink-900/80 px-3 py-1.5 font-mono text-[10px] text-ink-400 backdrop-blur-sm">
            <Loader2 className="h-3 w-3 animate-spin text-trail-400" />
            Розпізнаємо назви {geocoding.progress.completed}/{geocoding.progress.total}
          </span>
        )}
      </header>

      <main>
        <HeroSection
          pointCount={result.pointCount}
          spanDays={spanDays}
          placeCount={places.length}
        />

        <MapSection points={points} places={significantDisplayPlaces} />

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
