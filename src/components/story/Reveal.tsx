import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

type RevealProps = {
  children: ReactNode
  /** Stagger position — each step delays the reveal a little further. */
  index?: number
  className?: string
  /** How far the element travels while fading in. */
  distance?: number
}

/**
 * Fades + slides content in the first time it scrolls into view — the effect
 * that makes a scroll-story feel alive rather than like a long static page.
 *
 * `once: true` matters: re-animating every time a section scrolls back into
 * view makes scrolling up feel broken, since content the reader already
 * "earned" disappears and replays.
 *
 * When the reader has asked for reduced motion, this renders as a plain
 * element — not a zero-duration animation. An animation that still runs
 * instantly can leave content stuck at opacity 0 if it's interrupted, and
 * the whole point of honoring the preference is that nothing moves.
 */
export function Reveal({ children, index = 0, className, distance = 24 }: RevealProps) {
  const prefersReducedMotion = useReducedMotion()

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: distance }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{
        duration: 0.7,
        delay: index * 0.09,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  )
}
