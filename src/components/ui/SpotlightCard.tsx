import { useRef, type ReactNode } from 'react'
import { motion, useMotionTemplate, useMotionValue, useReducedMotion } from 'framer-motion'
import { cn } from '../../lib/cn'

type SpotlightCardProps = {
  children: ReactNode
  className?: string
  /** Hue of the cursor glow — lets a card match the data series it carries. */
  glow?: string
}

/**
 * A card that lights up under the cursor and lifts slightly on hover.
 *
 * The glow position is held in motion values and piped into the gradient
 * through `useMotionTemplate`, so tracking the pointer never triggers a
 * React render — the browser just gets a new `background` string on the
 * layer it is already compositing. Storing the coordinates in state instead
 * would re-render the card on every mousemove event.
 *
 * The lift is a transform (not a margin/top change) so it can't reflow the
 * grid around it mid-hover.
 */
export function SpotlightCard({
  children,
  className,
  glow = 'rgba(245, 158, 11, 0.14)',
}: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useReducedMotion()

  const mouseX = useMotionValue(-500)
  const mouseY = useMotionValue(-500)

  const background = useMotionTemplate`radial-gradient(340px circle at ${mouseX}px ${mouseY}px, ${glow}, transparent 70%)`

  return (
    <motion.div
      ref={ref}
      onMouseMove={(e) => {
        const rect = ref.current?.getBoundingClientRect()
        if (!rect) return
        mouseX.set(e.clientX - rect.left)
        mouseY.set(e.clientY - rect.top)
      }}
      onMouseLeave={() => {
        // Park the light far outside the card so it fades out cleanly
        // instead of freezing wherever the cursor happened to exit.
        mouseX.set(-500)
        mouseY.set(-500)
      }}
      whileHover={prefersReducedMotion ? undefined : { y: -4 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-ink-800 bg-ink-900/60',
        'transition-colors duration-300 hover:border-ink-600',
        className,
      )}
    >
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background }}
      />
      {/* Carries the radius down the tree: children that trace the card's
          outline (BorderBeam) size themselves with `rounded-[inherit]`, and
          `inherit` resolves against the DIRECT parent — so without this the
          beam would draw a square ring inside rounded corners. */}
      <div className="relative rounded-[inherit]">{children}</div>
    </motion.div>
  )
}
