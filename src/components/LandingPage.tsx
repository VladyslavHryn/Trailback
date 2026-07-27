import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import L from 'leaflet'
import {
  AlertTriangle,
  ArrowDownToLine,
  FileJson,
  History,
  Layers,
  Map as MapIcon,
  Repeat,
  ShieldCheck,
  X,
} from 'lucide-react'

/* One stroke weight for every icon on this screen. Lucide's default 2 at the
   two sizes used here (16px in a chip, 20px in the drop zone) is solid enough
   to read as drawn rather than sketched; the header wordmark previously ran
   2.2 and the value chips ran the default, which is the kind of drift that
   makes an icon set look borrowed instead of specified. */
const ICON_STROKE = 2
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

/* Three promises, deliberately parallel: each is a noun phrase of four to six
   words, so the eye reads them as one set rather than three sentences of
   different lengths. The previous copy ran 8-10 words each with the qualifier
   trailing ("..., яких ти сам за собою не помічав"), which buries the payload
   at the end of the line on a screen the reader scans in about three seconds.

   The icons carry NO colour of their own — see the chip in the markup, where
   all three are rendered at one size in the single accent. Three different
   hues across three items of one semantic group ("what you get") reads as
   decoration, not as meaning. */
const VALUE_POINTS = [
  { icon: Layers, text: 'Вся карта одразу, не по днях' },
  { icon: Repeat, text: 'Звички, які ти не помічав сам' },
  { icon: History, text: 'Місця, що з’явились і зникли' },
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
    /* No local background fill. The page-level wash (one accent radial, in
       index.css) is allowed through instead of being covered by an opaque
       ink-950 panel and then re-decorated with floating coloured dots. */
    <div className="relative flex min-h-svh flex-col text-ink-50">
      <header className="relative z-10 flex items-center justify-between px-6 py-6 md:px-10">
        <div className="flex items-center gap-2 font-display text-lg font-semibold">
          <MapIcon className="h-5 w-5 text-trail-400" strokeWidth={ICON_STROKE} />
          Trailback
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center px-6 pb-16 pt-2 md:px-10">
        {/* ONE column of reading that ENDS at the drop zone, with the live demo
            beside it — rather than a two-column hero followed by a centred
            upload card, which put the only action the screen asks for outside
            the flow the reader was following. */}
        <div className="grid w-full max-w-6xl items-start gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16">
          <div className="flex flex-col">
            {/* Mono + caps: a system notice, in a different voice from both
                the headline and the body. */}
            <span className="text-label self-start rounded-full border border-trail-500/40 bg-trail-500/10 px-3 py-1.5 text-trail-300">
              Google видаляє хмарний Timeline
            </span>

            {/* The non-breaking space before the dash is load-bearing: without
                it the line broke as "…геоісторія" / "— на одній карті", and a
                dash must never open a line. It now breaks after the dash. */}
            <h1 className="text-balance mt-6 font-display text-title-lg font-bold leading-[1.04] text-ink-50">
              Вся твоя геоісторія&nbsp;— на одній карті
            </h1>

            <p className="mt-5 max-w-[48ch] text-body-lg leading-relaxed text-ink-400">
              Google Timeline показує лише один день за раз. Завантаж свій
              експорт — побач роки маршрутів одразу.
            </p>

            {/* Bare icons, NO chip. These three had the identical treatment as
                the drop zone's icon — same rounded square, same border, same
                accent fill — which put a decorative list marker and the one
                functional control of the screen in the same visual class. The
                container is now what marks something as ACTIONABLE, and it is
                spent only there. These also drop to trail-500 and 18px: a list
                marker should sit under the thing it is listing, not compete. */}
            <ul className="mt-8 flex flex-col gap-3">
              {VALUE_POINTS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3">
                  <Icon
                    className="h-[18px] w-[18px] shrink-0 text-trail-500"
                    strokeWidth={ICON_STROKE}
                  />
                  <span className="text-body font-medium text-ink-200">
                    {text}
                  </span>
                </li>
              ))}
            </ul>

            {/* A SOLID hairline, not a dashed rectangle. The dashed border is
                the single most reproduced drag-and-drop treatment there is; a
                1px solid edge that picks up the accent on hover and on
                drag-over says the same thing and looks specified. */}
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
              className={`mt-9 rounded-2xl border px-5 py-6 transition-colors duration-200 sm:px-6 ${
                isDragActive
                  ? 'border-trail-400 bg-trail-500/[0.09]'
                  : 'border-ink-700 bg-ink-900/50 hover:border-trail-500/55'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Not a cloud-with-an-up-arrow. Beyond being the default
                    choice, "upload to a cloud" is the one thing this product
                    promises it never does — the file stays in the browser. A
                    plain downward arrow to a line describes the actual
                    gesture: drop it here. */}
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                    isDragActive
                      ? 'border-trail-400/60 bg-trail-500/15 text-trail-300'
                      : 'border-ink-700 bg-ink-950/60 text-trail-400'
                  }`}
                >
                  <ArrowDownToLine className="h-5 w-5" strokeWidth={ICON_STROKE} />
                </span>

                <div className="min-w-0">
                  <p className="text-body-lg font-semibold leading-snug text-ink-50">
                    Перетягни файл сюди
                  </p>
                  {/* Filenames are data, so they are set in the data face —
                      and left in their real case, since these are literal
                      names the reader has to match. */}
                  <p className="mt-1.5 font-mono text-caption leading-relaxed text-ink-400">
                    Records.json або Timeline.json (розпакований з архіву
                    Takeout)
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-lg bg-trail-500 px-5 py-2.5 text-body font-semibold text-ink-950 transition-colors hover:bg-trail-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trail-300"
                >
                  {/* A JSON document — which is literally what this button
                      opens a picker for. It was FileArchive, an icon for a
                      zip: it reads as a phone-shaped rounded rectangle at
                      16px and pointed at the archive, not at the one file
                      that has to come out of it. */}
                  <FileJson className="h-4 w-4" strokeWidth={ICON_STROKE} />
                  Обрати файл
                </button>

                <button
                  type="button"
                  onClick={onDemo}
                  className="rounded-sm text-caption text-ink-400 underline decoration-ink-700 underline-offset-4 transition-colors hover:text-trail-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trail-300"
                >
                  Переглянути демо-карту
                </button>
              </div>

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
                className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-caption text-red-200"
              >
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0 text-red-300"
                  strokeWidth={ICON_STROKE}
                />
                <span>{displayedError}</span>
              </motion.div>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-caption text-ink-400">
              {/* Jade survives here and only here on this screen: it is the
                  secondary accent, on a reassurance rather than on an action.
                  Everything the reader can click or is meant to notice is
                  amber. */}
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck
                  className="h-4 w-4 text-signal-400"
                  strokeWidth={ICON_STROKE}
                />
                Файл обробляється локально в браузері
              </span>
              <button
                type="button"
                onClick={() => setIsGuideOpen(true)}
                className="rounded-sm underline decoration-ink-700 underline-offset-4 transition-colors hover:text-trail-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trail-300"
              >
                Як отримати експорт →
              </button>
            </div>

            {/* Stated BEFORE the upload, not after the requests have gone out.
                The exception is small and worth it, but it is the reader's call
                to make, and they can only make it if they know about it while
                the decision is still theirs. Held tertiary by COLOUR rather
                than by inventing a smaller size off the scale. */}
            <p className="mt-3 max-w-[56ch] text-caption leading-relaxed text-ink-600">
              Виняток один: щоб підписати топ-місця назвами й районами, до
              OpenStreetMap піде кілька десятків округлених координат. Ніколи
              не сам файл.
            </p>
          </div>

          <HeroDemo />
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
                className="rounded-md p-1 text-ink-400 transition hover:text-trail-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trail-300"
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

type LatLng = { lat: number; lng: number }

// The five recurring places the demo cycles through, ordered by angle around
// the group's centroid so the loop between them never crosses itself.
const DEMO_STOPS: LatLng[] = [
  { lat: 50.4522, lng: 30.5257 }, // Володимирська гірка
  { lat: 50.4649, lng: 30.5183 }, // Контрактова площа
  { lat: 50.4472, lng: 30.5145 }, // Золоті ворота
  { lat: 50.438, lng: 30.5192 }, // Бессарабська площа
  { lat: 50.4501, lng: 30.5234 }, // Майдан Незалежності
]

/**
 * Deterministic pseudo-noise in [-1, 1].
 *
 * Deterministic matters: the track is rebuilt on every mount, and a random
 * one would visibly redraw itself differently each time the landing page
 * loads, which reads as instability rather than as data.
 */
function demoNoise(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return (x - Math.floor(x)) * 2 - 1
}

/**
 * Turns the five stops into a dense, organic track.
 *
 * WHY: joining the stops directly drew five ruler-straight lines across the
 * middle of Kyiv — a stretched triangle that looks like a route someone
 * planned, not like a path a phone recorded. A real GPS trace is hundreds of
 * closely-spaced samples that curve between places and wander slightly
 * around the true line, and that texture is the entire reason the preview is
 * worth showing at all.
 *
 * Each leg is a quadratic Bézier whose control point is pushed out
 * perpendicular to the leg (alternating sides, so the path snakes rather
 * than bowing the same way every time), then every sample gets a small
 * offset on top. The curve is what stops it reading as a straight line; the
 * per-sample offset is what stops it reading as a perfect curve.
 */
function buildDemoTrack(stops: LatLng[], samplesPerLeg = 44): LatLng[] {
  const track: LatLng[] = []
  // Closes the loop: the last stop leads back to the first, so the track
  // reads as a routine that repeats rather than a one-way trip.
  const legs = stops.length

  for (let leg = 0; leg < legs; leg++) {
    const a = stops[leg]
    const b = stops[(leg + 1) % legs]

    const dLat = b.lat - a.lat
    const dLng = b.lng - a.lng

    // Perpendicular to the leg, so the bulge is always across the direction
    // of travel regardless of which way the leg runs.
    const side = leg % 2 === 0 ? 1 : -1
    const bendLat = -dLng * 0.16 * side
    const bendLng = dLat * 0.16 * side

    const controlLat = a.lat + dLat / 2 + bendLat
    const controlLng = a.lng + dLng / 2 + bendLng

    for (let i = 0; i < samplesPerLeg; i++) {
      const t = i / samplesPerLeg
      const inv = 1 - t

      // Quadratic Bézier.
      const lat = inv * inv * a.lat + 2 * inv * t * controlLat + t * t * b.lat
      const lng = inv * inv * a.lng + 2 * inv * t * controlLng + t * t * b.lng

      // ~15-30 m of wander, which is roughly what consumer GPS actually
      // produces. Enough to give the line texture, far too small to move it
      // off the streets it follows.
      const jitter = 0.00022
      track.push({
        lat: lat + demoNoise(leg * 977 + i * 3) * jitter,
        lng: lng + demoNoise(leg * 977 + i * 3 + 1) * jitter,
      })
    }
  }

  track.push(stops[0])
  return track
}

const DEMO_TRACK = buildDemoTrack(DEMO_STOPS)

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
  // Kept so a resize can RE-FIT, not just re-measure — see the observer below.
  const boundsRef = useRef<L.LatLngBounds | null>(null)

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

    const latLngs = DEMO_TRACK.map((p) => [p.lat, p.lng] as [number, number])
    boundsRef.current = L.latLngBounds(latLngs)
    map.fitBounds(boundsRef.current, { padding: [28, 28] })

    // Jade, matching MapView's demo route — a path between places, which is
    // the "place" accent's job; amber stays reserved for density.
    // `smoothFactor: 0` disables Leaflet's Douglas-Peucker simplification.
    // It defaults to 1 and is normally a good trade, but it is measured in
    // screen pixels: at the zoom this preview sits at, the whole 220-sample
    // track collapsed to THIRTEEN vertices — every curve and every bit of
    // GPS wander thrown away, leaving precisely the straight-line zigzag the
    // dense track was built to replace. The detail here IS the content, so
    // it has to survive to the screen.
    glowLineRef.current = L.polyline(latLngs, {
      color: '#25c79c',
      weight: 7,
      opacity: 0,
      smoothFactor: 0,
      className: 'trail-route-glow',
    }).addTo(map)

    // Solid and thin, NOT the marching-dash treatment this used to carry. A
    // dashed stroke is the convention for a route someone plans; a recorded
    // track is continuous, and reading as recorded is the whole point of the
    // preview. The dash also fought the curves, breaking a smooth path into
    // ticks that drew attention to the geometry instead of the shape.
    lineRef.current = L.polyline(latLngs, {
      color: '#5fdcb9',
      weight: 1.8,
      opacity: 0,
      lineCap: 'round',
      lineJoin: 'round',
      smoothFactor: 0,
    }).addTo(map)

    markersRef.current = DEMO_STOPS.map((p) =>
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

  // Keep the map sized AND FRAMED as the hero reflows across breakpoints.
  //
  // invalidateSize() alone only tells Leaflet the box changed; it holds the
  // existing centre and zoom. The initial fitBounds ran against whatever box
  // existed at mount, so once the hero's map grew from a 4:3 thumbnail to a
  // tall panel, the route ended up framed for a viewport that no longer
  // existed — the whole five-point loop sat off-screen and the demo showed
  // empty streets, which is precisely the one thing this element has to prove.
  // Re-fitting after the resize is what keeps the route in frame at every size.
  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(() => {
      const map = mapRef.current
      if (!map) return
      map.invalidateSize()
      if (boundsRef.current) map.fitBounds(boundsRef.current, { padding: [28, 28] })
    })
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
    /* NOT a card. This was a rounded-2xl panel with a 1px ink-700 border and a
       drop shadow — the identical construction as the drop zone below it, so
       the product's proof and the user's action carried the same visual weight
       and the eye had nothing to rank. The frame is gone, the corner radius is
       small enough not to echo the card, and it is substantially taller: this is
       a surface the product renders, not an object sitting on the page. The dead
       area that used to sit under a 4:3 thumbnail goes with it.
       It aligns to the container edge rather than bleeding. A bleed was tried at
       +2.5rem and stopped ~100px short of the viewport on a 1440 screen, because
       the container is centred with max-width — a partial bleed reads as a
       mis-set margin, not as a decision, so the honest edge is the aligned one. */
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg lg:aspect-auto lg:h-[38rem]">
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

/* The eight floating blurred dots that used to live here are gone. They were
   three different hues (amber, jade, and a periwinkle the design system had
   already declared removed) drifting on infinite loops behind the content —
   decoration with no function, and the most recognisable "premium" filler
   pattern in generated UI. The page-level accent wash in index.css supplies
   the one thing they were nominally for: keeping a large dark area from
   sitting at a single flat value. Deleting them also stops eight
   permanently-animating layers from compositing behind the hero. */
