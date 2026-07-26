import type { ReactNode } from 'react'
import { Reveal } from './Reveal'
import { cn } from '../../lib/cn'

type StorySectionProps = {
  /** Small all-caps label — orients the reader in the story. */
  eyebrow?: string
  /** Section number for the left rail, e.g. "03". Encodes real sequence: the
   * story genuinely is read in order, which is the only thing that justifies
   * numbering it. */
  index?: string
  title?: ReactNode
  subtitle?: ReactNode
  children?: ReactNode
  /** Full-bleed sections (the map) skip the layout entirely. */
  bleed?: boolean
  className?: string
  id?: string
}

/**
 * One screen of the scroll-story.
 *
 * THE LAYOUT, and why it isn't centred. Every section used to be the same
 * stack — centred eyebrow, centred headline, centred subtext, evenly spaced,
 * vertically centred in the viewport. That shape is the giveaway: it's what
 * you get when nothing has been decided about where the weight of a screen
 * should sit, and it reads as generated regardless of which typeface or
 * palette is layered on top.
 *
 * What replaces it:
 *   - A two-column grid with a narrow left RAIL. The rail holds the section
 *     number and eyebrow and nothing else; it sticks while the content
 *     scrolls past, so the reader always knows where they are in the story
 *     without a progress bar. All the actual weight lands in the right
 *     column, which is what makes the screen asymmetric rather than balanced.
 *   - Text is left-aligned and measure-limited (~30ch headlines, ~50ch body),
 *     so lines start on a shared axis the eye can return to. Centred text
 *     gives every line a different starting point.
 *   - Content is TOP-anchored with a large lead-in rather than vertically
 *     centred, so sections flow as one continuous document instead of a deck
 *     of slides that each happen to be one viewport tall.
 */
export function StorySection({
  eyebrow,
  index,
  title,
  subtitle,
  children,
  bleed = false,
  className = '',
  id,
}: StorySectionProps) {
  if (bleed) {
    return (
      <section id={id} className={cn('relative min-h-svh w-full', className)}>
        {children}
      </section>
    )
  }

  return (
    <section
      id={id}
      className={cn(
        'relative mx-auto w-full max-w-6xl px-6 py-[14vh] md:px-10',
        className,
      )}
    >
      <div className="grid gap-y-8 md:grid-cols-[7rem_minmax(0,1fr)] md:gap-x-12 lg:grid-cols-[9rem_minmax(0,1fr)]">
        <div className="md:sticky md:top-[16vh] md:self-start">
          {index && (
            <p className="font-mono text-xs text-ink-600 md:text-sm">{index}</p>
          )}
          {eyebrow && (
            <p className="mt-2 font-mono text-[10px] uppercase leading-relaxed tracking-[0.2em] text-signal-400 md:text-[11px]">
              {eyebrow}
            </p>
          )}
          {/* Hairline that only exists on the wide layout, where it reads as
              a margin rule rather than as decoration. */}
          <span
            aria-hidden="true"
            className="mt-5 hidden h-16 w-px bg-gradient-to-b from-ink-700 to-transparent md:block"
          />
        </div>

        <div>
          {title && (
            <Reveal>
              <h2 className="max-w-[30ch] font-display text-[clamp(2rem,5.5vw,4.25rem)] font-semibold leading-[1.02] tracking-tight text-ink-50">
                {title}
              </h2>
            </Reveal>
          )}

          {subtitle && (
            <Reveal index={1}>
              <p className="mt-6 max-w-[50ch] text-base leading-relaxed text-ink-400 md:text-lg">
                {subtitle}
              </p>
            </Reveal>
          )}

          {children && <div className={title || subtitle ? 'mt-14' : ''}>{children}</div>}
        </div>
      </div>
    </section>
  )
}
