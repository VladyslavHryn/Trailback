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

export function HeroSection({ pointCount, spanDays, placeCount }: HeroSectionProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <section className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-6 text-center">
      {/* Three soft, widely-separated glows rather than a single centred one
          — an off-centre light source reads as depth, a centred one reads as
          a vignette. One per accent, so the hero states the product's whole
          colour vocabulary before the story starts using it. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(58% 48% at 18% 12%, rgba(217, 119, 6, 0.15), transparent 70%),' +
            'radial-gradient(52% 42% at 86% 74%, rgba(37, 199, 156, 0.11), transparent 70%),' +
            'radial-gradient(46% 40% at 62% 22%, rgba(124, 131, 240, 0.09), transparent 72%)',
        }}
      />

      {/* The drifting field stands in for the pings themselves — the one
          decorative element on this screen, and the only place in the story
          that gets ambient motion. */}
      <Particles density={80} />

      <div className="relative z-10 flex flex-col items-center">
        <Reveal>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-signal-400">
            Твоя геоісторія
          </p>
        </Reveal>

        <Reveal index={1}>
          <p className="mt-10 font-display text-[clamp(3.5rem,16vw,11rem)] font-bold leading-[0.85] tracking-tighter text-trail-400">
            <NumberTicker value={pointCount} delay={0.35} />
          </p>
        </Reveal>

        <Reveal index={2}>
          <h1 className="mt-8 max-w-3xl font-display text-2xl font-semibold leading-tight tracking-tight text-ink-50 md:text-4xl">
            точок за {formatDaysSpan(spanDays)} — на одній карті
          </h1>
        </Reveal>

        <Reveal index={3}>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-400 md:text-lg">
            Google показував тобі лише один день за раз. Ось уся твоя історія
            разом — {formatNumber(placeCount)} {placesWord(placeCount)}, звички
            та маршрути, які склались непомітно для тебе самого.
          </p>
        </Reveal>
      </div>

      <motion.div
        className="absolute bottom-10 z-10 flex flex-col items-center gap-2"
        initial={prefersReducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.8 }}
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
          Гортай далі
        </span>
        <motion.div
          animate={prefersReducedMotion ? undefined : { y: [0, 7, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ChevronDown className="h-5 w-5 text-trail-400" />
        </motion.div>
      </motion.div>
    </section>
  )
}
