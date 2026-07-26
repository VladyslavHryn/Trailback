// Every knob the heatmap has, in one place, plus the two presets worth
// starting from.
//
// WHY THIS FILE EXISTS: the heat layer's appearance was tuned twice by
// reasoning about the numbers rather than looking at the result, and both
// times it landed somewhere wrong — first a saturated slab, then nearly
// invisible. The values are genuinely not derivable: leaflet.heat composites
// blobs additively and then maps the accumulated alpha through the gradient,
// so the only honest way to pick them is to move a slider and look. This
// file is the shape those sliders write into, and HeatTuner is the sliders.

/** A gradient stop: a position on the 0..1 intensity scale plus its colour. */
export interface HeatStop {
  position: number
  color: string
}

export interface HeatConfig {
  radius: number
  blur: number
  /** leaflet.heat scales intensity down above this zoom. */
  maxZoom: number
  minOpacity: number
  /**
   * Fraction of the peak observed cell intensity that counts as "fully hot".
   * 1 means the busiest cell in the history sits exactly at the top of the
   * gradient; lower values push more of the map up the ramp.
   */
  peakHeadroom: number
  stops: HeatStop[]
}

/**
 * leaflet.heat's own documented example configuration, colours included.
 *
 * This is the baseline to confirm against FIRST. Its virtue is not that it
 * suits the product — the blue/lime/red ramp obviously doesn't — but that it
 * is known to render visibly for a wide range of inputs. If the map looks
 * right with this and wrong with the brand palette, the problem is the
 * palette; if it looks wrong with both, the problem is upstream in the data
 * or the radius, and no amount of colour tweaking will fix it. Keeping it
 * one click away turns "is the heatmap broken?" into a question with an
 * answer instead of a guess.
 */
export const BASELINE_HEAT_CONFIG: HeatConfig = {
  radius: 25,
  blur: 15,
  maxZoom: 17,
  minOpacity: 0.4,
  peakHeadroom: 1,
  stops: [
    { position: 0.2, color: '#0000ff' },
    { position: 0.4, color: '#00ff00' },
    { position: 0.6, color: '#ffff00' },
    { position: 0.8, color: '#ff0000' },
    { position: 1.0, color: '#8b0000' },
  ],
}

/**
 * The brand palette on the SAME distribution as the baseline — identical
 * stop positions, identical opacity and radius, only the five colours
 * swapped for an amber ramp that runs dark→bright the way a density scale
 * should. Because the numbers are untouched, anything that renders under the
 * baseline renders under this too.
 */
export const AMBER_HEAT_CONFIG: HeatConfig = {
  ...BASELINE_HEAT_CONFIG,
  stops: [
    { position: 0.2, color: '#7c2d12' },
    { position: 0.4, color: '#b45309' },
    { position: 0.6, color: '#f59e0b' },
    { position: 0.8, color: '#fcd34d' },
    { position: 1.0, color: '#fef3c7' },
  ],
}

export type HeatPresetName = 'baseline' | 'amber'

export const HEAT_PRESETS: Record<HeatPresetName, HeatConfig> = {
  baseline: BASELINE_HEAT_CONFIG,
  amber: AMBER_HEAT_CONFIG,
}

/** Which preset the app ships with. */
export const DEFAULT_HEAT_PRESET: HeatPresetName = 'amber'

/** Turns the editable stop list into the object shape leaflet.heat wants. */
export function toLeafletGradient(stops: HeatStop[]): Record<number, string> {
  const gradient: Record<number, string> = {}
  for (const stop of stops) gradient[stop.position] = stop.color
  return gradient
}

/** The subset of options that can be pushed to a live layer via setOptions. */
export function toLeafletOptions(config: HeatConfig, peakIntensity: number) {
  return {
    radius: config.radius,
    blur: config.blur,
    maxZoom: config.maxZoom,
    minOpacity: config.minOpacity,
    // A history with a single cell (or none) would give a zero/NaN max and
    // leaflet.heat divides by it.
    max: Math.max(peakIntensity * config.peakHeadroom, 0.0001),
    gradient: toLeafletGradient(config.stops),
  }
}
