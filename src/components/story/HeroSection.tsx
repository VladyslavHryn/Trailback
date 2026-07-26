import { motion, useReducedMotion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { Reveal } from './Reveal'
import { formatDaysSpan, formatNumber, placesWord } from './format'
import { NumberTicker } from '../ui/NumberTicker'
import { Particles } from '../ui/Particles'

type HeroSectionProps = {
  pointCount: number
  spanDays: number
  placeCount: number
}

/**
 * The story's opening screen.
 *
 * Composition: everything is anchored to the LEFT edge and the weight sits
 * low, so the screen has a direction instead of a centre. The count is the
 * largest thing on the page by a wide margin — a tiny mono label above it, a
 * headline roughly a fifth its size beside it, body text smaller again. That
 * size jump is the whole idea: the number is the fact worth carrying away, and
 * it should be legible from across the room while the supporting text waits
 * to be read. Two evenly-sized lines of text would say nothing about which
 * one matters.
 */
export function HeroSection({ pointCount, spanDays, placeCount }: HeroSectionProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <section className="relative flex min-h-svh flex-col justify-end overflow-hidden">
      {/* Depth in layers rather than one flat fill: a wide warm wash anchored
          behind where the number actually sits (so the glow belongs to the
          content instead of floating as a decorative blob), a cooler counter-
          light from the far edge, and a vignette that keeps the bottom
          readable under the scroll hint. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(70% 55% at 8% 78%, rgba(217, 119, 6, 0.17), transparent 68%),' +
            'radial-gradient(48% 42% at 92% 14%, rgba(37, 199, 156, 0.10), transparent 70%),' +
            'radial-gradient(40% 34% at 66% 52%, rgba(124, 131, 240, 0.08), transparent 74%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-ink-950 to-transparent"
      />

      <Particles density={80} />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-[18vh] md:px-10">
        <Reveal>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-signal-400 md:text-xs">
            Твоя геоісторія
          </p>
        </Reveal>

        {/* The count and its unit share a baseline, with the unit kept small
            and set in mono — the pairing reads as one measurement rather than
            as a headline followed by a caption. */}
        <Reveal index={1}>
          <div className="mt-6 flex flex-wrap items-end gap-x-6 gap-y-2">
            <p className="font-display text-[clamp(4rem,18vw,13rem)] font-bold leading-[0.78] tracking-tighter text-trail-400">
              <NumberTicker value={pointCount} delay={0.3} />
            </p>
            <p className="pb-3 font-mono text-xs uppercase tracking-[0.18em] text-ink-400 md:text-sm">
              точок
            </p>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] md:gap-16">
          <Reveal index={2}>
            <h1 className="max-w-[24ch] font-display text-2xl font-semibold leading-[1.1] tracking-tight text-ink-50 md:text-4xl">
              за {formatDaysSpan(spanDays)} — уперше на одній карті
            </h1>
          </Reveal>

          <Reveal index={3}>
            <p className="max-w-[44ch] text-sm leading-relaxed text-ink-400 md:pt-2 md:text-base">
              Google показував тобі лише один день за раз. Ось уся твоя історія
              разом — {formatNumber(placeCount)} {placesWord(placeCount)}, звички
              та маршрути, які склались непомітно для тебе самого.
            </p>
          </Reveal>
        </div>
      </div>

      <motion.div
        className="absolute bottom-8 right-6 z-10 flex items-center gap-3 md:right-10"
        initial={prefersReducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.8 }}
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
          Гортай
        </span>
        <motion.div
          animate={prefersReducedMotion ? undefined : { y: [0, 6, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ChevronDown className="h-4 w-4 text-trail-400" />
        </motion.div>
      </motion.div>
    </section>
  )
}
