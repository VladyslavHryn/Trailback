import { useEffect, useRef } from 'react'
import { useInView, useMotionValue, useReducedMotion, useSpring } from 'framer-motion'
import { cn } from '../../lib/cn'

type NumberTickerProps = {
  value: number
  /** Decimal places to keep — headline counts use 0, rates use 1. */
  decimals?: number
  className?: string
  /** Rendered verbatim after the number (e.g. " км", "%"). */
  suffix?: string
  /** Seconds to wait after entering view, for staggering a row of stats. */
  delay?: number
}

/**
 * A number that rolls up to its value the first time it scrolls into view.
 *
 * Two implementation details that matter more than they look:
 *
 *  - The animation is driven by a motion value written straight into
 *    `textContent`, NOT into React state. A spring emits a new value every
 *    frame; routing that through setState would re-render the component ~60
 *    times a second and drag the whole section's frame budget down with it.
 *    Writing to the DOM node directly keeps the ticker off React's critical
 *    path entirely.
 *  - The element carries the final value as its accessible name from the
 *    start, so a screen reader announces "70 631" once rather than
 *    narrating every intermediate frame of a decorative count-up.
 */
export function NumberTicker({
  value,
  decimals = 0,
  className,
  suffix = '',
  delay = 0,
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const prefersReducedMotion = useReducedMotion()

  const motionValue = useMotionValue(0)
  // Tuned to settle in roughly a second and land softly: a stiffer spring
  // reads as a glitch on large numbers, a looser one is still visibly
  // crawling after the reader has moved on.
  const spring = useSpring(motionValue, { damping: 45, stiffness: 90, mass: 0.8 })
  const isInView = useInView(ref, { once: true, margin: '0px 0px -60px 0px' })

  const format = (n: number) =>
    n.toLocaleString('uk-UA', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })

  useEffect(() => {
    if (!isInView) return
    if (prefersReducedMotion) return
    const timeout = setTimeout(() => motionValue.set(value), delay * 1000)
    return () => clearTimeout(timeout)
  }, [isInView, prefersReducedMotion, motionValue, value, delay])

  useEffect(() => {
    if (prefersReducedMotion) return
    return spring.on('change', (latest) => {
      if (ref.current) ref.current.textContent = format(latest)
    })
    // `format` is recreated each render but only closes over `decimals`,
    // which is in the dep list — no stale-closure risk here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spring, decimals, prefersReducedMotion])

  const finalText = format(value) + suffix

  return (
    <span className={cn('tabular-nums', className)}>
      {/* The animating node is hidden from assistive tech and the real value
          is exposed once, in text, alongside it. Putting an aria-label on
          the animating span instead would be unreliable — a bare <span> has
          no role for the label to attach to. */}
      <span ref={ref} aria-hidden="true">
        {/* Start at zero so the roll-up has somewhere to travel from —
            except under reduced motion, where nothing animates and the
            number simply has to be correct on first paint. */}
        {prefersReducedMotion ? format(value) : format(0)}
      </span>

      {/* The unit is a SEPARATE span, and this is a correctness fix rather
          than a nicety. Hero numerals are set with heavy negative tracking
          (-0.05em, which at 150px is nearly 8px); applied to "73%" that
          tracking pulls the percent sign hard into the 3 until they touch.
          Kerning is a property of a glyph PAIR, so the fix has to live at the
          boundary: the unit opts out of the numeral tracking, takes a little
          positive space back, and sits slightly smaller, which is also how
          a percent sign is normally cut against lining figures. */}
      {suffix && (
        <span
          aria-hidden="true"
          className={cn(
            'text-[0.62em] tracking-normal',
            // A unit written as a word ("км") was authored with a leading
            // space and needs a real word gap; a tight sign ("%") needs only
            // the hair of space the negative tracking stole.
            /^\s/.test(suffix) ? 'ml-[0.2em]' : 'ml-[0.04em]',
          )}
        >
          {suffix.trim()}
        </span>
      )}

      <span className="sr-only">{finalText}</span>
    </span>
  )
}
