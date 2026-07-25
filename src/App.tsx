import { useState } from 'react'
import { Route } from 'lucide-react'
import { LandingPage } from './components/LandingPage'
import { MapView } from './components/MapView'

type View = 'landing' | 'map'

function App() {
  const [view, setView] = useState<View>('landing')

  if (view === 'map') {
    return (
      <div className="flex h-svh flex-col bg-ink-950">
        <header className="flex items-center justify-between border-b border-ink-800 bg-ink-900 px-6 py-3">
          <div className="flex items-center gap-2 font-display text-lg font-semibold text-ink-50">
            <Route className="h-5 w-5 text-trail-400" strokeWidth={2.2} />
            Trailback
          </div>
          <button
            type="button"
            onClick={() => setView('landing')}
            className="text-sm text-ink-400 transition hover:text-trail-300"
          >
            ← Завантажити інший файл
          </button>
        </header>
        <main className="relative flex-1">
          <MapView />
        </main>
      </div>
    )
  }

  return <LandingPage onContinue={() => setView('map')} />
}

export default App
