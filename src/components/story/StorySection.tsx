import type { ReactNode } from 'react'
import { Reveal } from './Reveal'

type StorySectionProps = {
  /** Small all-caps label above the headline — orients the reader in the story. */
  eyebrow?: string
  title?: ReactNode
  subtitle?: ReactNode
  children?: ReactNode
  /** Full-bleed sections (the map) skip the centered max-width container. */
  bleed?: boolean
  className?: string
  id?: string
}

/**
 * One screen of the scroll-story: a full viewport tall, with its single
 * focal element centred and given room to breathe. Height is `min-h` rather
 * than a fixed `h` so a section whose content genuinely needs more room
 * (a long places list on a short laptop screen) grows instead of clipping —
 * cutting off content would be a worse failure than a slightly taller
 * section.
 */
export function StorySection({
  eyebrow,
  title,
  subtitle,
  children,
  bleed = false,
  className = '',
  id,
}: StorySectionProps) {
  if (bleed) {
    return (
      <section id={id} className={`relative min-h-svh w-full ${className}`}>
        {children}
      </section>
    )
  }

  return (
    <section
      id={id}
      className={`relative flex min-h-svh w-full flex-col items-center justify-center px-6 py-24 md:px-10 ${className}`}
    >
      <div className="w-full max-w-4xl">
        {eyebrow && (
          <Reveal>
            <p className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-signal-400">
              {eyebrow}
            </p>
          </Reveal>
        )}

        {title && (
          <Reveal index={1}>
            <h2 className="font-display text-3xl font-semibold leading-[1.1] tracking-tight text-ink-50 md:text-5xl">
              {title}
            </h2>
          </Reveal>
        )}

        {subtitle && (
          <Reveal index={2}>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-400 md:text-lg">
              {subtitle}
            </p>
          </Reveal>
        )}

        {children && <div className={title || subtitle ? 'mt-14' : ''}>{children}</div>}
      </div>
    </section>
  )
}
