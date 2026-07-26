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
    <section className="relative flex min-h-svh flex-col justify-center overflow-hidden">
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

      {/* Same rail grid as every other section, so the opening screen starts
          on the SAME left axis as the six that follow. It previously used a
          plain centred container, which put the biggest number in the product
          nearly 200px to the left of every heading after it — the reader's eye
          had to re-find the margin on screen two. The rail also lets the hero
          carry "01" and take its place in the numbered sequence rather than
          sitting outside it. */}
      {/* Vertically centred, not bottom-anchored. Pinning the block to the
          bottom left a ~530px void above it on a wide screen: with the number
          capped in size, the composition was one small cluster of type sitting
          under half a screen of nothing. Centring a LEFT-aligned, rail-offset
          block keeps the asymmetry that gives the screen direction while
          spending the height on both sides of the content instead of all of
          it on one. The padding clears the fixed header and the scroll hint. */}
      <div className="relative z-10 mx-auto grid w-full max-w-7xl gap-y-8 px-6 py-28 md:grid-cols-[7rem_minmax(0,1fr)] md:gap-x-12 md:px-10 lg:grid-cols-[9rem_minmax(0,1fr)]">
        <Reveal>
          <div>
            <p className="font-mono text-xs text-ink-600 md:text-sm">01</p>
            <p className="text-label mt-2 text-signal-400">Твоя геоісторія</p>
          </div>
        </Reveal>

        <div>
          {/* The count and its unit share a baseline, with the unit kept small
              and set in mono — the pairing reads as one measurement rather
              than as a headline followed by a caption. */}
          <Reveal index={1}>
            <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
              <p className="numeral-hero text-trail-400">
                <NumberTicker value={pointCount} delay={0.3} />
              </p>
              <p className="text-label pb-3 text-ink-400">точок</p>
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
                Google показував тобі лише один день за раз. Ось уся твоя
                історія разом — {formatNumber(placeCount)} {placesWord(placeCount)},
                звички та маршрути, які склались непомітно для тебе самого.
              </p>
            </Reveal>
          </div>
        </div>
      </div>

      <motion.div
        className="absolute bottom-8 right-6 z-10 flex items-center gap-3 md:right-10"
        initial={prefersReducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.8 }}
      >
        <span className="text-label-micro text-ink-400">
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
