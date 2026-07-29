import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import L from 'leaflet'
import {
  AlertTriangle,
  ArrowDownToLine,
  FileJson,
  Map as MapIcon,
  ShieldCheck,
  X,
} from 'lucide-react'

/* One stroke weight for every icon on this screen. Lucide's default 2 at the
   two sizes used here (16px in a chip, 20px in the drop zone) is solid enough
   to read as drawn rather than sketched; the header wordmark previously ran
   2.2 and the value chips ran the default, which is the kind of drift that
   makes an icon set look borrowed instead of specified. */
const ICON_STROKE = 2

/* The drop zone's frame, as four CROP MARKS rather than a drawn rectangle.
   A dashed box is the most recognisable drag-and-drop treatment there is,
   and a 1px solid box is only a quieter version of the same generic shape.
   Registration marks are the convention for a map sheet or a photographic
   crop — the frame is IMPLIED by its corners, which is less furniture and
   specific to what this product actually handles. */
const CROP_CORNERS = [
  { key: 'tl', box: 'left-0 top-0', h: 'left-0 top-0', v: 'left-0 top-0' },
  { key: 'tr', box: 'right-0 top-0', h: 'right-0 top-0', v: 'right-0 top-0' },
  { key: 'bl', box: 'bottom-0 left-0', h: 'bottom-0 left-0', v: 'bottom-0 left-0' },
  { key: 'br', box: 'bottom-0 right-0', h: 'bottom-0 right-0', v: 'bottom-0 right-0' },
] as const
import { TILE_URL, TILE_ATTRIBUTION, createPlaceIcon } from './MapView'
import { ACCENT } from '../map/accent'

const GUIDE_STEPS = [
  {
    title: 'Android',
    body: 'Налаштування телефону → Локація (Location) → Хронологія (Timeline) → Експортувати дані Хронології (Export Timeline data) → зберегти файл.',
  },
  {
    title: 'iPhone',
    body: 'Google Maps → профіль → Ваша хронологія → ⋯ → Налаштування локації та конфіденційності → Export Timeline data.',
  },
  {
    title: 'Завантаж сюди',
    body: 'Перетягни експортований файл (обов\'язково JSON формат) у зону вище або обери його кнопкою «Обрати файл».',
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

      {/* `justify-center` centres the hero as ONE block in the leftover
          viewport height, rather than letting it hang from the top with the
          slack collecting underneath. The padding is symmetric for the same
          reason — the previous pt-2/pb-16 pair was itself an 56px upward
          bias, so even a centred block would have sat high. `py` is the
          minimum breathing room on short screens, where the content is
          taller than the viewport and centring has nothing left to do. */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-12 md:px-10">
        {/* ONE column of reading that ENDS at the drop zone, with the live demo
            beside it — rather than a two-column hero followed by a centred
            upload card, which put the only action the screen asks for outside
            the flow the reader was following. */}
        {/* `items-stretch`, so the map column resolves to the ROW's height
            and the map genuinely fills its side instead of floating as a
            fixed-height widget beside a taller column of text. */}
        <div className="grid w-full max-w-6xl items-stretch gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16">
          <div className="flex flex-col">
            {/* No eyebrow badge above the headline. It carried a real fact,
                but it shouted it in caps, in mono, inside a pill — three
                emphasis devices stacked on a line of supporting text, which
                made it louder than the H1 it was supposed to introduce. The
                urgency now opens the subtitle in plain language, where it
                reads as a reason rather than as a sticker.

                The headline is the column's first element, so it carries no
                top margin: the grid is `items-start`, and a leftover offset
                here would drop it below the top of the preview card beside
                it. */}
            {/* The non-breaking space before the dash is load-bearing: without
                it the line broke as "…геоісторія" / "— на одній карті", and a
                dash must never open a line. It now breaks after the dash. */}
            <h1 className="text-balance font-display text-title-lg font-bold leading-[1.04] text-ink-50">
              Вся твоя геоісторія&nbsp;— на одній карті
            </h1>

            <p className="mt-6 max-w-[48ch] text-body-lg leading-relaxed text-ink-400">
              Google видаляє хмарний Timeline. Завантаж свій експорт — побач
              роки маршрутів одразу.
            </p>

            {/* The three promises, as PROSE rather than a bulleted list.
                They were an icon-left/text-right row repeated three times —
                the most template-like block on the page, and the icons were
                pure decoration: a stack of layers, a repeat arrow and a clock
                said nothing the words did not. Folded into one sentence, they
                read as a claim the product is making instead of a feature
                grid, and the emphasis does the scanning work the icons were
                pretending to do. */}
            <p className="mt-8 max-w-[48ch] text-body leading-relaxed text-ink-400">
              Замість сотень окремих днів —{' '}
              <span className="font-medium text-ink-200">одна карта</span>, на
              якій видно{' '}
              <span className="font-medium text-ink-200">
                звички, яких ти за собою не помічав
              </span>
              , і{' '}
              <span className="font-medium text-ink-200">
                місця, що з’явились чи зникли
              </span>{' '}
              з твого життя.
            </p>

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
              className={`trail-dropzone relative mt-10 rounded-2xl px-6 py-7 transition-colors duration-200 sm:px-7 ${
                isDragActive
                  ? 'trail-dropzone--active bg-gradient-to-b from-glow-teal/[0.08] to-glow-teal/[0.02]'
                  : 'bg-gradient-to-b from-ink-800/45 to-ink-900/25 hover:from-ink-800/60 hover:to-ink-900/35'
              }`}
            >
              {/* The frame, as four registration marks rather than a drawn
                  rectangle — see `.trail-crop`. Decorative, so hidden from
                  assistive tech: the drop zone is already described by its
                  heading and its button. */}
              {CROP_CORNERS.map(({ key, box, h, v }) => {
                /* Colour and length are INLINE, not utility classes. The two
                   state-driven properties are the whole point of the control,
                   and they have to be certain: verified in the browser that
                   neither a `bg-*` utility nor a custom `border-color` rule
                   actually reached these elements, while the class names were
                   present and correct. An inline style is immune to whatever
                   is eating them, and for exactly two animated properties it
                   is also the plainest way to say it. */
                const bar = isDragActive ? '#3fb8a8' : '#424a50'
                const reach = isDragActive ? '2rem' : '1rem'
                return (
                  <span key={key} aria-hidden="true" className={`absolute ${box}`}>
                    <span
                      className={`absolute ${h} transition-all duration-300`}
                      style={{ backgroundColor: bar, width: reach, height: '1px' }}
                    />
                    <span
                      className={`absolute ${v} transition-all duration-300`}
                      style={{ backgroundColor: bar, width: '1px', height: reach }}
                    />
                  </span>
                )
              })}

              <div className="flex items-start gap-4">
                {/* Not a cloud-with-an-up-arrow. Beyond being the default
                    choice, "upload to a cloud" is the one thing this product
                    promises it never does — the file stays in the browser. A
                    plain downward arrow to a line describes the actual
                    gesture: drop it here. */}
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                    isDragActive
                      ? 'border-glow-teal/40 bg-glow-teal/10 text-glow-teal'
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
                  className="h-4 w-4 text-ink-400"
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
              Виняток один: щоб підписати топ-місця назвами й районами, кілька
              десятків округлених координат піде до Foursquare і OpenStreetMap.
              Ніколи не сам файл.
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
            className="w-full max-w-md rounded-2xl border border-glow-teal/15 bg-gradient-to-b from-ink-800/90 to-ink-900/90 p-6 text-left shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-start justify-between">
              <h2 className="font-display text-lg font-semibold text-ink-50">
                Як експортувати свою хронологію
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

/**
 * The recurring places the preview cycles through. Two carry a name, and
 * only two: the chips are the thing that connects this preview to the real
 * results map, but a name on every pin turns a small preview into a wall of
 * overlapping labels — the same reason the results map labels only its
 * strongest few.
 */
const DEMO_STOPS: Array<LatLng & { label: string }> = [
  { lat: 50.4522, lng: 30.5257, label: 'Дім' }, // Володимирська гірка
  { lat: 50.438, lng: 30.5192, label: 'Робота' }, // Бессарабська площа
]

/**
 * The waypoints the track was ROUTED through, which is a different list from
 * the places worth marking. Three of them (Контрактова, Золоті ворота,
 * Майдан) exist only to give the road route its shape — they are geometry,
 * not destinations. They used to get pins as well, which put an unlabelled
 * dot on three arbitrary bends and made the map read like debug output;
 * every dot on a map is a claim that something happened there.
 * Kept as a comment rather than as code because the track is baked: nothing
 * reads these at runtime.
 *   50.4649, 30.5183 — Контрактова площа
 *   50.4472, 30.5145 — Золоті ворота
 *   50.4501, 30.5234 — Майдан Незалежності
 */

/**
 * The preview track, MAP-MATCHED to Kyiv's real street network.
 *
 * This is baked geometry, not a runtime lookup. It was produced once by
 * routing the stops above through OSRM (`/route/v1/driving`, 673 vertices,
 * 15.5 km) and then simplified with Douglas-Peucker at a 4 m tolerance,
 * which cuts it to 117 vertices without moving the line anywhere a reader
 * could see — a road's shape survives 4 m; only redundant collinear samples
 * don't.
 *
 * WHY BAKED. The landing page is decoration shown before any file exists, so
 * a network round-trip to a routing service on every visit would buy nothing
 * and add a failure mode (rate limits, downtime, offline) to the first
 * screen anyone sees.
 *
 * WHY MATCHED AT ALL, rather than a synthetic curve. The previous version
 * invented this path with Bezier curves and pseudo-random jitter. It read as
 * plausible, but every wiggle in it was decoration — and the wiggle in a
 * real trace is the one thing that proves it was recorded rather than drawn.
 * Borrowing real road geometry means the bends here are genuine turns at
 * genuine intersections, so the preview is a truthful sample of what the
 * product draws instead of an artist's impression of one.
 */
const DEMO_TRACK: Array<[lat: number, lng: number]> = [
  [50.45213, 30.52561], [50.45174, 30.5263], [50.45042, 30.5245], [50.45125, 30.52298],
  [50.45239, 30.5243], [50.45233, 30.52446], [50.45235, 30.5246], [50.45287, 30.52524],
  [50.4531, 30.52542], [50.45339, 30.52534], [50.45347, 30.52548], [50.45308, 30.52597],
  [50.4524, 30.5272], [50.45213, 30.52734], [50.45164, 30.52825], [50.4507, 30.52927],
  [50.45074, 30.52937], [50.45191, 30.52825], [50.45354, 30.52776], [50.45492, 30.52755],
  [50.45537, 30.52766], [50.45602, 30.52806], [50.45629, 30.52806], [50.45657, 30.52792],
  [50.45703, 30.52753], [50.45808, 30.5263], [50.46024, 30.52303], [50.4613, 30.52467],
  [50.46316, 30.52187], [50.46445, 30.52395], [50.46628, 30.521], [50.46564, 30.52002],
  [50.4651, 30.51873], [50.46506, 30.5184], [50.46512, 30.51827], [50.46498, 30.51784],
  [50.46496, 30.5178], [50.465, 30.51832], [50.46508, 30.5184], [50.46512, 30.51827],
  [50.46498, 30.51784], [50.46406, 30.51643], [50.46313, 30.5172], [50.46249, 30.51784],
  [50.46139, 30.51836], [50.46068, 30.52097], [50.46111, 30.52169], [50.45826, 30.52605],
  [50.45703, 30.52753], [50.45657, 30.52792], [50.45621, 30.52807], [50.45592, 30.52801],
  [50.45537, 30.52766], [50.45492, 30.52755], [50.45452, 30.52756], [50.45292, 30.52792],
  [50.44965, 30.52344], [50.44894, 30.52269], [50.44797, 30.5221], [50.4448, 30.52104],
  [50.44604, 30.5134], [50.4472, 30.51387], [50.44717, 30.51434], [50.4472, 30.51387],
  [50.44894, 30.51458], [50.44776, 30.52202], [50.44097, 30.51972], [50.44082, 30.51985],
  [50.44078, 30.52013], [50.44074, 30.52237], [50.44065, 30.52251], [50.44023, 30.52273],
  [50.43955, 30.52356], [50.43836, 30.52102], [50.43815, 30.52081], [50.43786, 30.52072],
  [50.43611, 30.52072], [50.43601, 30.52064], [50.43595, 30.52049], [50.43595, 30.51843],
  [50.43821, 30.51845], [50.43849, 30.51899], [50.43798, 30.51959], [50.43849, 30.51899],
  [50.43912, 30.52034], [50.44032, 30.51909], [50.44058, 30.51965], [50.44082, 30.51985],
  [50.44773, 30.52218], [50.4488, 30.52277], [50.44954, 30.52349], [50.45186, 30.52669],
  [50.4518, 30.52796], [50.45164, 30.52825], [50.4507, 30.52927], [50.45074, 30.52937],
  [50.45233, 30.52782], [50.45242, 30.5276], [50.4524, 30.5272], [50.44965, 30.52344],
  [50.44894, 30.52269], [50.44797, 30.5221], [50.4448, 30.52104], [50.44526, 30.51819],
  [50.44816, 30.51935], [50.44773, 30.52218], [50.44861, 30.52263], [50.44931, 30.52323],
  [50.45186, 30.52669], [50.4518, 30.52796], [50.45164, 30.52825], [50.4507, 30.52927],
  [50.45074, 30.52937], [50.45238, 30.52773], [50.4524, 30.5272], [50.45174, 30.5263],
  [50.45213, 30.52561]
]

/**
 * Splits the baked track into the stretch travelled DAILY and the rest.
 *
 * A Strava-style heat render needs a frequency per segment, and this preview
 * has none: the track is one loop, walked once. Rather than invent a random
 * weight per vertex, the frequency comes from the one thing that is actually
 * true of a commute — the stretch between home and work is covered twice a
 * day, every working day, while the rest of a loop is occasional. So the arc
 * between the two named stops is the hot corridor and the remainder is not.
 *
 * Computed at module load from the track itself, so it stays correct if the
 * route is ever re-baked.
 */
function nearestIndex(track: Array<[number, number]>, lat: number, lng: number): number {
  let best = 0
  let bestD = Infinity
  for (let i = 0; i < track.length; i++) {
    const d = (track[i][0] - lat) ** 2 + (track[i][1] - lng) ** 2
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

const HOME_INDEX = nearestIndex(DEMO_TRACK, DEMO_STOPS[0].lat, DEMO_STOPS[0].lng)
const WORK_INDEX = nearestIndex(DEMO_TRACK, DEMO_STOPS[1].lat, DEMO_STOPS[1].lng)

/** The daily commute stretch: the shorter arc between the two stops. */
const HOT_SEGMENT: Array<[number, number]> = DEMO_TRACK.slice(
  Math.min(HOME_INDEX, WORK_INDEX),
  Math.max(HOME_INDEX, WORK_INDEX) + 1,
)

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
  // The commute corridor, drawn as its own bloom + core on top of the base
  // track — this is what turns a uniform GPS trace into a heat render.
  const hotGlowRef = useRef<L.Polyline | null>(null)
  const hotLineRef = useRef<L.Polyline | null>(null)
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

    const latLngs: Array<[number, number]> = DEMO_TRACK
    boundsRef.current = L.latLngBounds(latLngs)
    map.fitBounds(boundsRef.current, { padding: [28, 28] })

    // Jade, matching MapView's demo route — a path between places, which is
    // the "place" accent's job; amber stays reserved for density.
    // `smoothFactor: 0` disables Leaflet's own Douglas-Peucker pass. It
    // defaults to 1 and is normally a good trade, but it is measured in
    // SCREEN PIXELS, so at this preview's zoom it flattened the whole track
    // to thirteen vertices — every turn thrown away, leaving a straight-line
    // zigzag. The geometry is already simplified once, in metres, where the
    // tolerance means something; simplifying again in pixels only destroys
    // the street shape that is the point of showing it.
// AMBER, not the jade this used to be. Jade sits in exactly the hue
    // family CARTO's dark basemap uses for water and parks, so the route
    // dissolved into the tiles it was drawn over. Amber is absent from that
    // palette, and it is also the system's magnitude accent — which is now
    // literally what this line encodes, since its weight varies with how
    // often a stretch was travelled.
    //
    // FOUR LAYERS, in the order Strava's heat render stacks them: a wide
    // blurred bloom under the commute, a softer bloom under everything, the
    // full track as a thin dim trace, and the commute again as a bright
    // thick core. Frequency therefore reads three ways at once — brightness,
    // thickness and bloom — instead of a single uniform hairline.
    //
    // `smoothFactor: 0` throughout: the geometry was already simplified once
    // in METRES when it was baked, and Leaflet's own pass is measured in
    // screen pixels, which at this zoom flattens the street shape away.
    // TEAL atmospheric glow — widest, faintest. Decorative only.
    L.polyline(latLngs, {
      color: '#3fb8a8',
      weight: 24,
      opacity: 0,
      smoothFactor: 0,
      lineCap: 'round',
      lineJoin: 'round',
      className: 'trail-route-glow-teal',
    }).addTo(map)

    glowLineRef.current = L.polyline(latLngs, {
      color: '#d97706',
      weight: 9,
      opacity: 0,
      smoothFactor: 0,
      lineCap: 'round',
      lineJoin: 'round',
      className: 'trail-route-glow',
    }).addTo(map)

    hotGlowRef.current = L.polyline(HOT_SEGMENT, {
      color: '#f59e0b',
      weight: 18,
      opacity: 0,
      smoothFactor: 0,
      lineCap: 'round',
      lineJoin: 'round',
      className: 'trail-route-glow',
    }).addTo(map)

    lineRef.current = L.polyline(latLngs, {
      color: '#f59e0b',
      weight: 1.6,
      opacity: 0,
      smoothFactor: 0,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map)

    hotLineRef.current = L.polyline(HOT_SEGMENT, {
      color: '#fcd34d',
      weight: 3.4,
      opacity: 0,
      smoothFactor: 0,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map)

    markersRef.current = DEMO_STOPS.map((p) =>
      L.marker([p.lat, p.lng], {
        icon: createPlaceIcon(null, ACCENT.light, p.label),
        opacity: 0,
      }).addTo(map),
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
      hotLineRef.current?.setStyle({ opacity: 0 })
      hotGlowRef.current?.setStyle({ opacity: 0 })
      // Five weekdays over two real places: a weekday IS home and work, so
      // cycling them tells the "one fragment per day" story without needing
      // a marker parked on a bend for days three to five.
      const active = dayStep % markers.length
      markers.forEach((marker, i) => marker.setOpacity(i === active ? 1 : 0))
    } else {
      // The insights phase dims the map so the stat cards on top of it stay
      // legible. 0.35 was chosen when the route was a single opaque line; it
      // is far too deep now that the route is a layered heat render whose
      // base trace is deliberately faint to begin with — multiplied together
      // the corridor fell to 33% and the base to 17%. It matters more than a
      // phase tweak because a reduced-motion visitor never leaves this phase,
      // so that was the ONLY map they ever saw.
      const dim = phase === 'insights' ? 0.7 : 1
      // The base trace stays deliberately faint: the contrast between it and
      // the commute IS the frequency reading. Lift it and the map flattens
      // back into one uniform line.
      lineRef.current?.setStyle({ opacity: 0.5 * dim })
      glowLineRef.current?.setStyle({ opacity: 0.16 * dim })
      hotLineRef.current?.setStyle({ opacity: 0.95 * dim })
      hotGlowRef.current?.setStyle({ opacity: 0.4 * dim })
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
       mis-set margin, not as a decision, so the honest edge is the aligned one.

       NO card treatment at all now: the small radius is gone too. A rounded
       box around a map still reads as a widget embedded in a page, and that
       radius was physically clipping the Leaflet attribution, which sits
       flush in the bottom-right corner. Square edges let the map read as a
       panel OF the layout and give the attribution its corner back.
       `overflow-hidden` stays — it clips the tile grid, not the chrome.
       Height now comes from the stretched grid row on desktop, so the map
       matches the text column exactly; the aspect ratio only governs the
       stacked mobile layout, where there is no second column to match. */
    <div className="relative w-full overflow-hidden aspect-[4/3] lg:aspect-auto lg:h-full lg:min-h-[34rem]">
      <div ref={containerRef} className="absolute inset-0" />

      <div className="pointer-events-none absolute inset-0">
        <AnimatePresence>
          {phase === 'day' && (
            <motion.div
              key="day-label"
              exit={{ opacity: 0 }}
              className="absolute left-3 top-3 rounded-md border border-glow-teal/10 bg-ink-950/60 px-2 py-1 font-mono text-[11px] text-ink-200 backdrop-blur-sm"
            >
              {DEMO_DAYS[dayStep]} · один день, як у Google
            </motion.div>
          )}
          {phase === 'accumulated' && (
            <motion.div
              key="accumulated-label"
              exit={{ opacity: 0 }}
              className="absolute left-3 top-3 rounded-md border border-glow-teal/15 bg-ink-950/60 px-2 py-1 font-mono text-[11px] text-trail-300 backdrop-blur-sm"
            >
              6 років · уся історія одразу
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute right-3 top-3 rounded-md border border-glow-teal/10 bg-ink-950/60 px-2 py-1 font-mono text-[10px] text-ink-500 backdrop-blur-sm">
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
              <div className="grid grid-cols-3 gap-2 rounded-xl border border-glow-teal/15 bg-ink-950/70 p-2.5 backdrop-blur-md">
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
