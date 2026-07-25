import { useState } from 'react'
import { Route } from 'lucide-react'
import { LandingPage } from './components/LandingPage'
import { MapView } from './components/MapView'
import { ParsingScreen } from './components/ParsingScreen'
import { useLocationParser } from './hooks/useLocationParser'

function App() {
  const { state, parseFile, reset } = useLocationParser()
  const [showDemoMap, setShowDemoMap] = useState(false)

  const showMap = state.status === 'done' || showDemoMap

  const handleBack = () => {
    setShowDemoMap(false)
    reset()
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
        <main className="relative flex-1">
          <MapView points={points} />
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
