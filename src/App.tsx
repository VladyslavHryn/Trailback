import { useEffect, useMemo, useState } from 'react'
import { Route } from 'lucide-react'
import { LandingPage } from './components/LandingPage'
import { MapView } from './components/MapView'
import { ParsingScreen } from './components/ParsingScreen'
import { ResultsStory } from './components/ResultsStory'
import { useLocationParser } from './hooks/useLocationParser'
import { useAnalytics } from './hooks/useAnalytics'
import { useGeocoding } from './hooks/useGeocoding'
import { buildDisplayPlaces } from './analytics/placeInsights'
import {
  ALL_TIME,
  filterPointsByRange,
  listAvailablePeriods,
  rangeKey,
  type RangeSelection,
} from './analytics/timeRange'

function App() {
  const { state, parseFile, reset } = useLocationParser()
  const analytics = useAnalytics()
  const geocoding = useGeocoding()
  const [showDemoMap, setShowDemoMap] = useState(false)
  const [range, setRange] = useState<RangeSelection>(ALL_TIME)

  const parsedPoints = state.status === 'done' ? state.points : undefined

  // Run the engine for the selected period — on first parse, and again on
  // every range change. The hook caches by range, so going back to a period
  // already viewed resolves synchronously with no worker round-trip.
  useEffect(() => {
    if (!parsedPoints) return
    analytics.run(parsedPoints, range)
    // `analytics.run` is stable; `rangeKey` collapses the selection object to
    // the value that actually decides whether a re-run is needed, so
    // re-selecting the same period doesn't recompute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedPoints, rangeKey(range)])

  // A new file has no relationship to the period chosen for the previous
  // one, and leaving a stale month selected would silently show a filtered
  // view of data the reader just loaded.
  useEffect(() => {
    if (state.status === 'idle' || state.status === 'error') setRange(ALL_TIME)
  }, [state.status])

  const periods = useMemo(
    () => (parsedPoints ? listAvailablePeriods(parsedPoints) : null),
    [parsedPoints],
  )

  // The map draws the same slice the stats describe.
  const visiblePoints = useMemo(
    () => (parsedPoints ? filterPointsByRange(parsedPoints, range) : undefined),
    [parsedPoints, range],
  )

  // Reverse-geocoding needs the place list from analytics, so it starts
  // once clustering has actually finished — on the main thread (see
  // useGeocoding.ts), not blocking anything else, since it's rate-limited
  // network I/O rather than compute.
  useEffect(() => {
    if (analytics.state.status === 'done') {
      geocoding.run(analytics.state.result.places)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analytics.state])

  const geocodedResults = geocoding.state.status === 'done' ? geocoding.state.results : undefined

  const displayPlaces = useMemo(() => {
    if (analytics.state.status !== 'done') return undefined
    return buildDisplayPlaces(analytics.state.result.places, geocodedResults ?? new Map())
  }, [analytics.state, geocodedResults])

  const handleBack = () => {
    setShowDemoMap(false)
    reset()
    analytics.reset()
    geocoding.reset()
    setRange(ALL_TIME)
    window.scrollTo({ top: 0 })
  }

  if (state.status === 'parsing') {
    return <ParsingScreen progress={state.progress} onCancel={reset} />
  }

  if (state.status === 'done' && visiblePoints && periods) {
    return (
      <ResultsStory
        points={visiblePoints}
        analytics={analytics.state}
        geocoding={geocoding.state}
        displayPlaces={displayPlaces}
        periods={periods}
        range={range}
        onRangeChange={setRange}
        onLoadAnother={handleBack}
      />
    )
  }

  // The landing page's "Переглянути демо-карту" shortcut — a bare map with
  // the placeholder route, with no history to build a story out of.
  if (showDemoMap) {
    return (
      <div className="flex h-svh flex-col bg-ink-950">
        <header className="flex items-center justify-between border-b border-ink-800 bg-ink-900 px-6 py-3">
          <div className="flex items-center gap-2 font-display text-lg font-semibold text-ink-50">
            <Route className="h-5 w-5 text-trail-400" strokeWidth={2.2} />
            Trailback
          </div>
          <button
            type="button"
            onClick={handleBack}
            className="text-sm text-ink-400 transition hover:text-trail-300"
          >
            ← Завантажити файл
          </button>
        </header>
        <main className="relative flex-1">
          <MapView />
        </main>
      </div>
    )
  }

  return (
    <LandingPage
      onFileSelected={parseFile}
      onDemo={() => setShowDemoMap(true)}
      errorMessage={state.status === 'error' ? state.message : undefined}
    />
  )
}

export default App
