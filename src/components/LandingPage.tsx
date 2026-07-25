import { useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ArrowRight,
  FileArchive,
  Route,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react'

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
    title: 'Завантаж і перетягни сюди',
    body: 'Коли Google надішле лист — завантаж архів і перетягни його у зону нижче.',
  },
]

type LandingPageProps = {
  onContinue: () => void
}

export function LandingPage({ onContinue }: LandingPageProps) {
  const [isDragActive, setIsDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const prefersReducedMotion = useReducedMotion()

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    // Real parsing lands in Step 2 — for now, any selected file opens the map view.
    onContinue()
  }

  return (
    <div className="min-h-svh bg-ink-950 text-ink-50">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 md:px-10">
        <div className="flex items-center gap-2 font-display text-lg font-semibold">
          <Route className="h-5 w-5 text-trail-400" strokeWidth={2.2} />
          Trailback
        </div>
        <div className="flex items-center gap-1.5 text-xs text-ink-400">
          <ShieldCheck className="h-4 w-4 text-signal-400" />
          Дані не залишають цей пристрій
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 md:px-10">
        <section className="grid gap-12 pt-10 md:grid-cols-[1.15fr_0.85fr] md:gap-8 md:pt-16">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-trail-500/40 bg-trail-500/10 px-3 py-1 text-xs font-medium text-trail-300">
              Google видаляє хмарний Timeline
            </span>

            <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.08] tracking-tight text-ink-50 md:text-6xl">
              Врятуй свою геоісторію,
              <br />
              поки Google її не стер
            </h1>

            <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-400">
              Google Timeline показує тільки один день за раз і видаляє старі
              записи. Trailback аналізує всю історію локацій одразу —
              і показує закономірності всього твого життя, яких Google
              просто не показує.
            </p>

            <div className="mt-8 flex items-start gap-3 rounded-xl border border-ink-800 bg-ink-900/60 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-signal-400" />
              <p className="text-sm text-ink-400">
                <span className="font-medium text-ink-200">
                  Гарантія приватності:
                </span>{' '}
                файл обробляється локально в твоєму браузері. Нічого не
                завантажується на жоден сервер і не покидає цей пристрій.
              </p>
            </div>
          </div>

          <TrailSignature reducedMotion={Boolean(prefersReducedMotion)} />
        </section>

        <section className="mt-16 md:mt-20" id="upload">
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
            className={`flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors ${
              isDragActive
                ? 'border-trail-400 bg-trail-500/10'
                : 'border-ink-700 bg-ink-900/40'
            }`}
          >
            <UploadCloud
              className={`h-10 w-10 ${isDragActive ? 'text-trail-300' : 'text-ink-400'}`}
            />
            <div>
              <p className="text-lg font-medium text-ink-50">
                Перетягни архів Google Takeout сюди
              </p>
              <p className="mt-1 text-sm text-ink-400">
                Підтримується .json та .zip з експортом Location History
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
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
                onClick={onContinue}
                className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm text-ink-400 transition hover:text-trail-300"
              >
                Переглянути демо-карту
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept=".json,.zip"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>
        </section>

        <section className="mt-20 md:mt-28">
          <h2 className="font-display text-2xl font-semibold text-ink-50">
            Як отримати свій експорт з Google Takeout
          </h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-4">
            {GUIDE_STEPS.map((step, index) => (
              <li key={step.title} className="relative pl-0">
                <span className="font-mono text-sm text-trail-400">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-2 font-medium text-ink-50">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-400">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="border-t border-ink-800 px-6 py-8 text-center text-xs text-ink-400 md:px-10">
        Trailback — персональний аналізатор геоісторії. Без акаунтів, без
        хмари, без відправки даних.
      </footer>
    </div>
  )
}

function TrailSignature({ reducedMotion }: { reducedMotion: boolean }) {
  const waypoints: Array<[number, number]> = [
    [20, 190],
    [70, 120],
    [130, 150],
    [180, 60],
    [230, 90],
  ]

  const d = `M ${waypoints.map(([x, y]) => `${x} ${y}`).join(' L ')}`

  return (
    <div className="relative flex items-center justify-center rounded-2xl border border-ink-800 bg-ink-900/50 py-10">
      <svg
        viewBox="0 0 260 220"
        className="h-56 w-full max-w-[280px]"
        fill="none"
      >
        <g opacity={0.25}>
          {Array.from({ length: 6 }).map((_, row) =>
            Array.from({ length: 7 }).map((_, col) => (
              <circle
                key={`${row}-${col}`}
                cx={20 + col * 38}
                cy={16 + row * 38}
                r={1.4}
                fill="#3a4049"
              />
            )),
          )}
        </g>

        <motion.path
          d={d}
          stroke="#e8853a"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={reducedMotion ? { pathLength: 1 } : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.6, ease: 'easeInOut' }}
        />

        {waypoints.map(([x, y], index) => (
          <circle
            key={`${x}-${y}`}
            cx={x}
            cy={y}
            r={index === waypoints.length - 1 ? 5 : 3.5}
            fill={index === waypoints.length - 1 ? '#3fb8a8' : '#12151a'}
            stroke="#e8853a"
            strokeWidth={2}
          />
        ))}
      </svg>
    </div>
  )
}
