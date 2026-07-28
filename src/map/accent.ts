// THE accent. One colour family for everything in this product that encodes
// MAGNITUDE or ATTENTION, and the single place any new feature takes it from.
//
// WHY THIS FILE EXISTS. The three map layers had grown three unrelated colour
// languages, each defined at its own call site: the heatmap ran a cool
// teal→warm ramp (measured on a real render: 1488 of 1504 lit samples read as
// teal, so in practice the layer WAS teal), the place pins were jade at a
// hard-coded OKLCH hue of 172, and only the routes were amber. Switching tabs
// therefore looked like switching products rather than changing the reading of
// one dataset. Nothing enforced agreement because nothing owned the colour.
//
// So: every layer now derives from the values below. A new feature that needs
// an accent imports from here; it does not pick a hex.
//
// PAIRED WITH CSS. `--color-trail-*` in index.css is the same ramp for markup
// (buttons, badges, focus rings). CSS custom properties can't be read from a
// canvas fill without a getComputedStyle round-trip per draw, so the values are
// duplicated here on purpose — the two lists are kept in step by hand, and the
// comment in index.css says so. RAMP and the tokens must not drift.
//
// The jade `--color-signal-*` family is GONE — the tokens are deleted from
// @theme, not merely unused, so nothing can reference them again without
// reintroducing them on purpose. What used to be jade is either this accent
// (anything that is data or a quantity) or the neutral ink scale (chrome, and
// the privacy reassurance, which is a statement rather than a measurement).

/**
 * Dark → bright, low density → high. Ordered, and meant to be read as a ramp
 * rather than as named brand colours: position in the list is the meaning.
 */
export const ACCENT = {
  /** Barely recorded. Sits just off the page background. */
  emberDeep: '#4a2408',
  ember: '#7c3d0a',
  /** Regular presence. */
  base: '#b45309',
  mid: '#d97706',
  /** Frequent — the brand amber that also paints buttons. */
  bright: '#f59e0b',
  light: '#fcd34d',
  /** Peak only: pushed toward white so the very top of a scale still separates
   * from `light` on a dark background, where two similar ambers do not. */
  peak: '#fef3c7',
} as const

/**
 * An ACCENT value at a given alpha, as `rgba()`.
 *
 * Canvas gradients need a colour with an alpha channel per stop — a hex plus a
 * separate opacity is not expressible there — and hand-writing the rgb triples
 * beside the hex list is exactly how the two drift apart.
 */
export function withAlpha(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * The accent's hue on the OKLCH wheel, for scales that interpolate rather than
 * step through RAMP. #f59e0b is oklch(76.9% 0.165 70), so 70 is the axis every
 * magnitude ramp rotates around.
 */
export const ACCENT_HUE = 70

/** Lightness/chroma stops for the interpolated magnitude scale, dim → bright. */
const SHADE_STOPS = [
  { l: 32, c: 0.055 },
  { l: 46, c: 0.095 },
  { l: 60, c: 0.13 },
  { l: 72, c: 0.155 },
  { l: 84, c: 0.135 },
] as const

/**
 * Colour for a value given its share (0..1) of the largest value it is being
 * compared against.
 *
 * Interpolates in OKLCH rather than sRGB: mixing hex numerically darkens and
 * desaturates through the middle of a ramp (the classic muddy midpoint), while
 * OKLCH is perceptually uniform, so equal steps in the input look like equal
 * steps in brightness — the entire point of a magnitude scale.
 *
 * Square-rooted because most places sit far below the top one; on a linear
 * scale they would all collapse into the same near-black.
 */
export function accentShade(share: number): string {
  const t = Math.min(Math.max(share, 0), 1)
  const eased = Math.sqrt(t)

  const scaled = eased * (SHADE_STOPS.length - 1)
  const lower = Math.floor(scaled)
  const upper = Math.min(lower + 1, SHADE_STOPS.length - 1)
  const f = scaled - lower

  const a = SHADE_STOPS[lower]
  const b = SHADE_STOPS[upper]
  const l = a.l + (b.l - a.l) * f
  const c = a.c + (b.c - a.c) * f

  return `oklch(${l.toFixed(1)}% ${c.toFixed(3)} ${ACCENT_HUE})`
}
