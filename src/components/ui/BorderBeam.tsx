import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '../../lib/cn'

type BorderBeamProps = {
  /** Seconds for one full lap of the border. */
  duration?: number
  delay?: number
  color?: string
  className?: string
}

/**
 * A light that travels around a card's border (the Magic UI "border beam"
 * effect). Used sparingly — on the one card in a group that deserves the
 * eye, not on every card, or it stops meaning anything.
 *
 * HOW IT WORKS: an oversized conic gradient spins behind the card, and a
 * two-layer CSS mask (`.trail-beam-mask`, in index.css) hides everything
 * except a 1px ring at the edge, so all the viewer sees is a bright arc
 * sweeping the outline. The mask is the full box minus the content box,
 * which is exactly the ring left over by the 1px padding.
 *
 * Only `rotate` is animated — a compositor-only property, so this stays at
 * 60fps regardless of how much else is on screen. Animating the gradient's
 * angle directly would force a repaint every frame instead.
 */
export function BorderBeam({
  duration = 7,
  delay = 0,
  color = 'var(--color-trail-400)',
  className,
}: BorderBeamProps) {
  const prefersReducedMotion = useReducedMotion()

  // A perpetual spinning light is precisely the kind of ambient motion the
  // reduced-motion preference exists to silence.
  if (prefersReducedMotion) return null

  return (
    <span
      aria-hidden="true"
      className={cn(
        'trail-beam-mask pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] p-px',
        className,
      )}
    >
      <motion.span
        className="absolute left-1/2 top-1/2 aspect-square w-[180%] -translate-x-1/2 -translate-y-1/2"
        style={{
          background: `conic-gradient(from 0deg, transparent 0%, ${color} 10%, transparent 26%)`,
        }}
        animate={{ rotate: 360 }}
        transition={{ duration, delay, ease: 'linear', repeat: Infinity }}
      />
    </span>
  )
}
