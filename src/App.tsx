import { useEffect, useMemo, useState } from 'react'
import { Loader2, Route } from 'lucide-react'
import { LandingPage } from './components/LandingPage'
import { ParsingScreen } from './components/ParsingScreen'
import { ResultsStory } from './components/ResultsStory'
import { useLocationParser } from './hooks/useLocationParser'
import { useAnalytics } from './hooks/useAnalytics'
import { useGeocoding } from './hooks/useGeocoding'
import { buildDisplayPlaces } from './analytics/placeInsights'
import { computeHeatScale } from './map/aggregateHeatmapPoints'
import { movementPoints } from './parsing/selectPoints'
import { generateDemoPoints } from './demo/generateDemoPoints'
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
  const [showDemo, setShowDemo] = useState(false)
  const [range, setRange] = useState<RangeSelection>(ALL_TIME)

  // Real parsed points from file upload
  const parsedPoints = state.status === 'done' ? state.points : undefined

  // Synthetic demo points — generated once when demo mode is toggled on.
  // generateDemoPoints() is deterministic (~5 ms) so memoising on showDemo
  // is the right key: we only want one dataset per demo session.
  const demoPoints = useMemo(
    () => (showDemo ? generateDemoPoints() : undefined),
    [showDemo],
  )

  // Whichever source is active drives everything below.
  const activePoints = parsedPoints ?? demoPoints

  // Run analytics whenever active points or selected range change.
  // Covers both real-file and demo cases with the same effect.
  useEffect(() => {
    if (!activePoints) return
    analytics.run(activePoints, range)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePoints, rangeKey(range)])

  // Reset range to ALL_TIME when the data source is cleared.
  useEffect(() => {
    if (state.status === 'idle' || state.status === 'error') setRange(ALL_TIME)
  }, [state.status])

  const periods = useMemo(
    () => (activePoints ? listAvailablePeriods(activePoints) : null),
    [activePoints],
  )

  const visiblePoints = useMemo(
    () => (activePoints ? filterPointsByRange(activePoints, range) : undefined),
    [activePoints, range],
  )

  const heatScale = useMemo(
    () => (activePoints ? computeHeatScale(movementPoints(activePoints)) : undefined),
    [activePoints],
  )

  // Start geocoding once clustering is done.
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
    setShowDemo(false)
    reset()
    analytics.reset()
    geocoding.reset()
    setRange(ALL_TIME)
    window.scrollTo({ top: 0 })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (state.status === 'parsing') {
    return <ParsingScreen progress={state.progress} onCancel={reset} />
  }

  // Full story view — for both real uploads and the demo.
  if (visiblePoints && periods && analytics.state.status === 'done') {
    return (
      <ResultsStory
        points={visiblePoints}
        analytics={analytics.state}
        geocoding={geocoding.state}
        displayPlaces={displayPlaces}
        periods={periods}
        range={range}
        heatScale={heatScale}
        onRangeChange={setRange}
        onLoadAnother={handleBack}
      />
    )
  }

  // Demo analytics is running (typically < 1 s) — show a lightweight spinner
  // rather than the bare map the old demo mode used.
  if (showDemo && analytics.state.status === 'running') {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-ink-950 text-ink-50">
        <div className="flex items-center gap-2 font-display text-lg font-semibold">
          <Route className="h-5 w-5 text-trail-400" strokeWidth={2.2} />
          Trailback
        </div>
        <Loader2 className="mt-4 h-6 w-6 animate-spin text-trail-400" />
        <p className="font-mono text-xs text-ink-400">Генеруємо демо-історію…</p>
      </div>
    )
  }

  return (
    <LandingPage
      onFileSelected={parseFile}
      onDemo={() => setShowDemo(true)}
      errorMessage={state.status === 'error' ? state.message : undefined}
    />
  )
}

export default App
