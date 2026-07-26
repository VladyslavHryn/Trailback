import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  AlertTriangle,
  FileArchive,
  History,
  Map as MapIcon,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react'
import { TILE_URL, TILE_ATTRIBUTION, createPulseIcon } from './MapView'

const GUIDE_STEPS = [
  {
    title: 'Відкрий Google Takeout',
    body: 'Перейди на takeout.google.com і увійди у свій акаунт Google.',
  },
  {
    title: 'Обери лише Timeline',
    body: 'Натисни «Deselect all» і онови позначку тільки біля Location History (Timeline).',
  },
  {
    title: 'Сформуй експорт у JSON',
    body: 'Вибери формат JSON, один архів, і натисни «Create export».',
  },
  {
    title: 'Розпакуй і завантаж сюди',
    body: 'Коли Google надішле лист — розпакуй архів і перетягни у зону вище файл Records.json (або Timeline.json у новішому форматі) з нього.',
  },
]

const VALUE_POINTS = [
  {
    icon: MapIcon,
    text: 'Карта всього твого життя одразу, а не один день, як у Google',
  },
  {
    icon: Sparkles,
    text: 'Звички й закономірності, яких ти сам за собою не помічав',
  },
  {
    icon: History,
    text: 'Місця, що зникли з твого життя, і нові, що з’явились',
  },
]

type LandingPageProps = {
  onFileSelected: (file: File) => void
  onDemo: () => void
  /** Surfaced from the parser (e.g. unrecognized format) after an upload attempt. */
  errorMessage?: string
}

export function LandingPage({
  onFileSelected,
  onDemo,
  errorMessage,
}: LandingPageProps) {
  const [isDragActive, setIsDragActive] = useState(false)
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const displayedError = localError ?? errorMessage

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const file = files[0]

    if (!file.name.toLowerCase().endsWith('.json')) {
      setLocalError(
        'Підтримується лише .json — розпакуй архів Google Takeout і завантаж файл Records.json або Timeline.json звідти.',
      )
      return
    }

    setLocalError(null)
    onFileSelected(file)
  }

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-ink-950 text-ink-50">
      <AmbientBackground />

      <header className="relative z-10 flex items-center justify-between px-6 py-6 md:px-10">
        <div className="flex items-center gap-2 font-display text-lg font-semibold">
          <MapIcon className="h-5 w-5 text-trail-400" strokeWidth={2.2} />
          Trailback
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center px-6 py-10 md:py-14">
        <div className="grid w-full max-w-5xl gap-10 md:grid-cols-2 md:items-center md:gap-14">
          <div className="text-center md:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-trail-500/40 bg-trail-500/10 px-3 py-1 text-xs font-medium text-trail-300">
              Google видаляє хмарний Timeline
            </span>

            <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.1] tracking-tight text-ink-50 md:text-5xl">
              Врятуй свою геоісторію,
              <br />
              поки Google її не стер
            </h1>

            <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-ink-400 md:mx-0">
              Твій телефон роками тихо записував, де ти був. Google от-от
              видалить цю історію назавжди. Завантаж її сюди — і побач своє
              життя однією картою: улюблені місця, звички та маршрути, яких
              сам би ніколи не помітив.
            </p>

            <ul className="mx-auto mt-6 flex max-w-md flex-col gap-3 text-left md:mx-0">
              {VALUE_POINTS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-signal-500/10 text-signal-400">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-sm leading-relaxed text-ink-200">
                    {text}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <HeroDemo />
        </div>

        <div className="mt-12 w-full max-w-xl">
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragActive(true)
            }}
            onDragLeave={() => setIsDragActive(false)}
            onDrop={(e) => {
              e.preventDefault()
              setIsDragActive(false)
              handleFiles(e.dataTransfer.files)
            }}
            className={`flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
              isDragActive
                ? 'border-trail-400 bg-trail-500/10'
                : 'border-ink-700 bg-ink-900/60'
            }`}
          >
            <UploadCloud
              className={`h-9 w-9 ${isDragActive ? 'text-trail-300' : 'text-ink-400'}`}
            />
            <div>
              <p className="text-base font-medium text-ink-50">
                Перетягни файл експорту Google сюди
              </p>
              <p className="mt-1 text-sm text-ink-400">
                Records.json або Timeline.json (розпакований з архіву Takeout)
              </p>
            </div>

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg bg-trail-500 px-5 py-2.5 text-sm font-medium text-ink-950 transition hover:bg-trail-400"
            >
              <FileArchive className="h-4 w-4" />
              Обрати файл
            </button>

            <button
              type="button"
              onClick={onDemo}
              className="text-xs text-ink-400 underline decoration-ink-700 underline-offset-4 transition hover:text-trail-300"
            >
              Переглянути демо-карту
            </button>

            <input
              ref={inputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>

          {displayedError && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
              <span>{displayedError}</span>
            </motion.div>
          )}

          <div className="mt-4 flex flex-col items-center gap-2 text-xs text-ink-400 sm:flex-row sm:justify-center sm:gap-4">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-signal-400" />
              Файл обробляється локально в браузері
            </span>
            <button
              type="button"
              onClick={() => setIsGuideOpen(true)}
              className="text-ink-400 underline decoration-ink-700 underline-offset-4 transition hover:text-trail-300"
            >
              Як отримати експорт →
            </button>
          </div>
        </div>
      </main>

      <GuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </div>
  )
}

function GuideModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-20 flex items-center justify-center bg-ink-950/70 px-6 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-ink-700 bg-ink-900 p-6 text-left shadow-2xl"
          >
            <div className="flex items-start justify-between">
              <h2 className="font-display text-lg font-semibold text-ink-50">
                Як отримати експорт з Google Takeout
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Закрити"
                className="rounded-md p-1 text-ink-400 transition hover:text-trail-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <ol className="mt-5 flex flex-col gap-4">
              {GUIDE_STEPS.map((step, index) => (
                <li key={step.title} className="flex gap-3">
                  <span className="font-mono text-sm text-trail-400">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3 className="text-sm font-medium text-ink-50">
                      {step.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-ink-400">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// --- Hero demo: illustrates the product's core value in ~9s loop ---
// Google Timeline only ever shows one day at a time. The animation below
// pages through a few real Kyiv stops one-by-one on an actual embedded map,
// then accumulates ALL of them into one connected route, then surfaces
// example insight stats — the same three-step story the real app tells once
// a Takeout file is parsed. It's a real Leaflet map (not an illustration)
// so it looks exactly like what the product actually produces.

const DEMO_DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт']

// Ordered by angle around the group's centroid (not by name or visit time) —
// connecting real landmarks in an arbitrary order makes the route zigzag
// and cross itself, while an angular sort always traces a clean loop
// around the cluster with no self-intersections.
const KYIV_ROUTE: Array<{ lat: number; lng: number }> = [
  { lat: 50.4522, lng: 30.5257 }, // Володимирська гірка
  { lat: 50.4649, lng: 30.5183 }, // Контрактова площа
  { lat: 50.4472, lng: 30.5145 }, // Золоті ворота
  { lat: 50.438, lng: 30.5192 }, // Бессарабська площа
  { lat: 50.4501, lng: 30.5234 }, // Майдан Незалежності
]

const DEMO_INSIGHTS = [
  { label: 'Пройдено', value: '2 847 км' },
  { label: 'Улюблене місце', value: 'Кав’ярня на розі' },
  { label: 'Років даних', value: '6' },
]

type DemoPhase = 'day' | 'accumulated' | 'insights'

const DAY_STEP_MS = 550
const ACCUMULATED_HOLD_MS = 2400
const INSIGHTS_HOLD_MS = 3400

function HeroDemo() {
  const prefersReducedMotion = useReducedMotion()
  const [phase, setPhase] = useState<DemoPhase>(
    prefersReducedMotion ? 'insights' : 'day',
  )
  const [dayStep, setDayStep] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<L.Marker[]>([])
  const glowLineRef = useRef<L.Polyline | null>(null)
  const lineRef = useRef<L.Polyline | null>(null)

  // Mount a real, non-interactive Leaflet map once — same tiles and marker
  // style as the actual product (MapView), just small and inert.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
    })

    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTRIBUTION,
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map)

    const latLngs = KYIV_ROUTE.map((p) => [p.lat, p.lng] as [number, number])
    map.fitBounds(L.latLngBounds(latLngs), { padding: [28, 28] })

    // Jade, matching MapView's demo route — a path between places, which is
    // the "place" accent's job; amber stays reserved for density.
    glowLineRef.current = L.polyline(latLngs, {
      color: '#25c79c',
      weight: 8,
      opacity: 0,
      className: 'trail-route-glow',
    }).addTo(map)

    lineRef.current = L.polyline(latLngs, {
      color: '#5fdcb9',
      weight: 2.5,
      opacity: 0,
      lineCap: 'round',
      className: 'trail-route-line',
    }).addTo(map)

    markersRef.current = KYIV_ROUTE.map((p) =>
      L.marker([p.lat, p.lng], { icon: createPulseIcon(), opacity: 0 }).addTo(
        map,
      ),
    )

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Keep the map sized correctly as the hero grid reflows across breakpoints.
  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(() => mapRef.current?.invalidateSize())
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Drive marker/route visibility from the phase state machine below —
  // toggling opacity on existing layers instead of recreating the map.
  useEffect(() => {
    const markers = markersRef.current
    if (!markers.length) return

    if (phase === 'day') {
      lineRef.current?.setStyle({ opacity: 0 })
      glowLineRef.current?.setStyle({ opacity: 0 })
      markers.forEach((marker, i) => marker.setOpacity(i === dayStep ? 1 : 0))
    } else {
      const dim = phase === 'insights' ? 0.35 : 1
      lineRef.current?.setStyle({ opacity: 0.9 * dim })
      glowLineRef.current?.setStyle({ opacity: 0.25 * dim })
      markers.forEach((marker) => marker.setOpacity(dim))
    }
  }, [phase, dayStep])

  useEffect(() => {
    if (prefersReducedMotion) return

    let dayInterval: number | undefined
    let phaseTimeout: number

    const runDayPhase = () => {
      setPhase('day')
      setDayStep(0)
      let step = 0
      dayInterval = window.setInterval(() => {
        step += 1
        setDayStep(step % DEMO_DAYS.length)
      }, DAY_STEP_MS)
      phaseTimeout = window.setTimeout(() => {
        window.clearInterval(dayInterval)
        runAccumulatedPhase()
      }, DAY_STEP_MS * DEMO_DAYS.length)
    }

    const runAccumulatedPhase = () => {
      setPhase('accumulated')
      phaseTimeout = window.setTimeout(runInsightsPhase, ACCUMULATED_HOLD_MS)
    }

    const runInsightsPhase = () => {
      setPhase('insights')
      phaseTimeout = window.setTimeout(runDayPhase, INSIGHTS_HOLD_MS)
    }

    runDayPhase()

    return () => {
      window.clearInterval(dayInterval)
      window.clearTimeout(phaseTimeout)
    }
  }, [prefersReducedMotion])

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-ink-700 bg-ink-900/60 shadow-2xl">
      <div ref={containerRef} className="absolute inset-0" />

      <div className="pointer-events-none absolute inset-0">
        <AnimatePresence>
          {phase === 'day' && (
            <motion.div
              key="day-label"
              exit={{ opacity: 0 }}
              className="absolute left-3 top-3 rounded-md bg-ink-950/70 px-2 py-1 font-mono text-[11px] text-ink-200"
            >
              {DEMO_DAYS[dayStep]} · один день, як у Google
            </motion.div>
          )}
          {phase === 'accumulated' && (
            <motion.div
              key="accumulated-label"
              exit={{ opacity: 0 }}
              className="absolute left-3 top-3 rounded-md bg-ink-950/70 px-2 py-1 font-mono text-[11px] text-signal-300"
            >
              6 років · уся історія одразу
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute right-3 top-3 rounded-md bg-ink-950/70 px-2 py-1 font-mono text-[10px] text-ink-500">
          Київ · приклад
        </div>

        <AnimatePresence>
          {phase === 'insights' && (
            <motion.div
              key="insights"
              className="absolute inset-x-3 bottom-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <div className="absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-ink-900/95 to-transparent" />
              <div className="grid grid-cols-3 gap-2 rounded-xl border border-ink-700 bg-ink-950/90 p-2.5 backdrop-blur-sm">
                {DEMO_INSIGHTS.map((insight, i) => (
                  <motion.div
                    key={insight.label}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="text-center"
                  >
                    <div className="font-display text-sm font-semibold text-trail-300">
                      {insight.value}
                    </div>
                    <div className="mt-1 text-[10px] leading-tight text-ink-400">
                      {insight.label}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

type Dot = {
  id: number
  top: number
  left: number
  size: number
  duration: number
  delay: number
  color: string
}

const AMBIENT_DOTS: Dot[] = [
  { id: 1, top: 18, left: 12, size: 5, duration: 9, delay: 0, color: '#d97706' },
  { id: 2, top: 30, left: 82, size: 4, duration: 11, delay: 1.2, color: '#25c79c' },
  { id: 3, top: 68, left: 20, size: 3.5, duration: 8, delay: 0.6, color: '#7c83f0' },
  { id: 4, top: 76, left: 70, size: 5, duration: 12, delay: 2, color: '#25c79c' },
  { id: 5, top: 10, left: 55, size: 3, duration: 10, delay: 1.6, color: '#d97706' },
  { id: 6, top: 50, left: 90, size: 4, duration: 9.5, delay: 0.4, color: '#7c83f0' },
  { id: 7, top: 85, left: 40, size: 3.5, duration: 13, delay: 2.4, color: '#25c79c' },
  { id: 8, top: 42, left: 6, size: 4.5, duration: 10.5, delay: 0.9, color: '#d97706' },
]

function AmbientBackground() {
  const prefersReducedMotion = useReducedMotion()

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-ink-950 via-transparent to-ink-950" />

      {AMBIENT_DOTS.map((dot) => (
        <motion.div
          key={dot.id}
          className="absolute rounded-full blur-[2px]"
          style={{
            top: `${dot.top}%`,
            left: `${dot.left}%`,
            width: dot.size * 4,
            height: dot.size * 4,
            background: dot.color,
          }}
          initial={{ opacity: 0.15 }}
          animate={
            prefersReducedMotion
              ? { opacity: 0.15 }
              : {
                  opacity: [0.1, 0.35, 0.1],
                  y: [0, -14, 0],
                }
          }
          transition={{
            duration: dot.duration,
            delay: dot.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}
