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

function App() {
  const { state, parseFile, reset } = useLocationParser()
  const analytics = useAnalytics()
  const geocoding = useGeocoding()
  const [showDemoMap, setShowDemoMap] = useState(false)

  // Kick off the analytics engine as soon as real points are parsed — it
  // runs in its own worker, so this doesn't block the story from rendering
  // while clustering/distance stats are still computing.
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
    window.scrollTo({ top: 0 })
  }

  if (state.status === 'parsing') {
    return <ParsingScreen progress={state.progress} onCancel={reset} />
  }

  if (state.status === 'done') {
    return (
      <ResultsStory
        points={state.points}
        analytics={analytics.state}
        geocoding={geocoding.state}
        displayPlaces={displayPlaces}
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
