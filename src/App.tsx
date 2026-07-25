import { useEffect, useMemo, useState } from 'react'
import { Route } from 'lucide-react'
import { LandingPage } from './components/LandingPage'
import { MapView } from './components/MapView'
import { ParsingScreen } from './components/ParsingScreen'
import { InsightsDashboard } from './components/InsightsDashboard'
import { useLocationParser } from './hooks/useLocationParser'
import { useAnalytics } from './hooks/useAnalytics'
import { useGeocoding } from './hooks/useGeocoding'
import { buildDisplayPlaces } from './analytics/placeInsights'

function App() {
  const { state, parseFile, reset } = useLocationParser()
  const analytics = useAnalytics()
  const geocoding = useGeocoding()
  const [showDemoMap, setShowDemoMap] = useState(false)

  const showMap = state.status === 'done' || showDemoMap

  // Kick off the analytics engine as soon as real points are parsed — it
  // runs in its own worker, so this doesn't block the heatmap from showing
  // immediately while clustering/distance stats are still computing.
  useEffect(() => {
    if (state.status === 'done') {
      analytics.run(state.points)
    }
    // analytics.run is stable (useCallback with no deps); only re-run when
    // a genuinely new parsed result arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

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
  }

  if (state.status === 'parsing') {
    return <ParsingScreen progress={state.progress} onCancel={reset} />
  }

  if (showMap) {
    const points = state.status === 'done' ? state.points : undefined

    return (
      <div className="flex h-svh flex-col bg-ink-950">
        <header className="flex items-center justify-between border-b border-ink-800 bg-ink-900 px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 font-display text-lg font-semibold text-ink-50">
              <Route className="h-5 w-5 text-trail-400" strokeWidth={2.2} />
              Trailback
            </div>
            {points && (
              <span className="font-mono text-xs text-ink-400">
                {points.lat.length.toLocaleString('uk-UA')} точок
                {points.recordsSkipped > 0 &&
                  ` · пропущено ${points.recordsSkipped.toLocaleString('uk-UA')}`}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleBack}
            className="text-sm text-ink-400 transition hover:text-trail-300"
          >
            ← Завантажити інший файл
          </button>
        </header>
        <main className="relative flex flex-1 flex-col overflow-hidden md:flex-row">
          <div className="relative min-h-[45vh] flex-1">
            <MapView points={points} places={displayPlaces} />
          </div>
          {points && (
            <aside className="w-full shrink-0 overflow-y-auto border-t border-ink-800 bg-ink-900/60 md:w-[380px] md:border-l md:border-t-0">
              <InsightsDashboard
                analytics={analytics.state}
                geocoding={geocoding.state}
                displayPlaces={displayPlaces}
              />
            </aside>
          )}
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
