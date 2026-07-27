// The heat layer's visual configuration — one shipped setting, not a panel.
//
// WHY NO CONTROLS. There used to be a dev tuner wired to these values, on the
// argument that leaflet.heat's output isn't derivable by reasoning. That's
// true of the *first* pass, but it isn't a reason to ship sliders: a reader
// looking at their own life shouldn't have to fix our rendering before the
// map means anything. The values below were arrived at by measuring the
// rendered canvas (see the alpha-distribution targets in the comments), which
// is repeatable, rather than by eye.
//
// WHAT WAS WRONG BEFORE, since every constant here is a reaction to it:
//   1. `minOpacity: 0.4` put a FLOOR under every blob's alpha. simpleheat
//      draws each point with `globalAlpha = max(value/max, minOpacity)`, so a
//      cell visited once was painted at 40% — nearly as loud as a cell
//      visited ten thousand times. The single most important cause of "no
//      gradation": the scale's bottom half was unusable by construction.
//   2. The gradient's first stop sat at 0.2 with an opaque dark brown, and
//      nothing was defined below it. Everything fainter than 20% clamped to
//      that brown instead of fading out, so the map had a permanent muddy
//      wash under it.
//   3. `max` was the peak cell intensity exactly. But leaflet.heat ADDS
//      overlapping blobs before mapping through the gradient, and at
//      city-wide zoom a blob covers dozens of grid cells. Around home,
//      dozens of contributions summed past the top of the ramp, flattening
//      the busiest region into one uniform pale-yellow plateau — the "blinding
//      blob". Measured: 12.5% of all heat pixels pinned at maximum alpha.

/** A gradient stop: a position on the 0..1 intensity scale plus its colour. */
export interface HeatStop {
  position: number
  color: string
}

export interface HeatConfig {
  radius: number
  blur: number
  maxZoom: number
  minOpacity: number
  stops: HeatStop[]
}

/**
 * Headroom above the top of the normalised intensity scale (1.0), used
 * directly as the heat layer's `max`. Overlapping blobs are summed before
 * the gradient is applied, so a dense region accumulates past any single
 * cell's value; a little headroom keeps the top of the ramp reserved for
 * genuinely exceptional density.
 *
 * MEASURED, not guessed. The rendered canvas was sampled and its pixels
 * bucketed by alpha across a sweep of values (share of heat pixels in the
 * top bucket / in the top three / number of the ten buckets carrying a real
 * share):
 *
 *   headroom   saturated   warm end   buckets used
 *   1.00        2.3%        12.0%      10 / 10
 *   1.15       ~1.9%        ~8.5%      10 / 10
 *   2.00        0.4%         4.3%       9 / 10
 *   6.00        0.0%         0.0%       6 / 10   ← warm end never reached
 *
 * 1.15 keeps a small, real hotspot core and still spends the whole ramp.
 * The much larger value tried first looked "safe" but simply moved the fault
 * from blown-out to washed-out: nothing reached amber at all.
 *
 * For contrast, the configuration this replaced measured 12.5% of heat
 * pixels pinned at maximum alpha — the plateau that read as one flat blob.
 */
export const ACCUMULATION_HEADROOM = 1.15

export const HEAT_CONFIG: HeatConfig = {
  // Radius and blur are deliberately smaller than leaflet.heat's defaults
  // (25/15). The aggregation upstream already bins pings onto a grid, so a
  // wide radius doesn't add information — it just melts adjacent cells into
  // each other until discrete places stop being discrete. Smaller marks keep
  // "here" and "next street over" separable.
  radius: 14,
  blur: 18,

  // NEUTRALISES leaflet.heat's zoom scaling. Read the plugin, not the name:
  // it computes
  //     v = 1 / 2 ** clamp(maxZoom - currentZoom, 0, 12)
  // and multiplies EVERY point's intensity by v. So v is 1 at any zoom at or
  // above `maxZoom`, and halves for each level below it. A value of 0 puts the
  // whole practical zoom range on the flat part of that curve.
  //
  // This was 16, on the reading that the option sets where the layer "looks
  // right". The effect was the opposite of the comment: below zoom 16 the heat
  // halved per level and simply vanished. Measured on the rendered canvas, two
  // clicks of the zoom-out control:
  //
  //   zoom 16 → 2828 lit samples, peak alpha 158
  //   zoom 15 → 2775                        85
  //   zoom 14 → 1471                        71
  //   zoom 13 →  760                        60      ← and gone below that
  //
  // The scaling exists for RAW pings, where a point is one observation and a
  // zoomed-out view should discount crowding. Nothing here is raw: the
  // aggregation upstream bins onto a FIXED geographic grid and normalises each
  // cell to 0..1 against the whole history (see HeatScale). A cell's value is
  // already an absolute statement about that place, so re-scaling it by the
  // current zoom makes the same cell mean different things at different zooms
  // — the exact fault the fixed reference frame was built to remove.
  maxZoom: 0,

  // Near-zero floor: alpha should be free to fall all the way to nothing, so
  // a place visited once reads as a whisper rather than as a statement. This
  // is the single biggest contributor to the scale having a usable range.
  minOpacity: 0.05,

  // A cool→warm ramp rather than one hue at varying opacity.
  //
  // This is a deliberate exception to "sequential scales use a single hue".
  // The rule exists to prevent hue from carrying meaning it doesn't have —
  // but a dark-cool → bright-warm ramp (the family inferno/magma belong to)
  // is monotonic in LIGHTNESS, which is the property that actually makes a
  // sequential scale readable. Traversing hue as well simply widens the
  // perceptual distance between "once" and "constantly", which is exactly the
  // gradation that was missing. The reserved brand amber is spent only at the
  // top, so the accent still means what it means everywhere else: magnitude.
  stops: [
    // Fully transparent at the bottom so sparse areas disappear instead of
    // tinting the basemap.
    { position: 0.0, color: 'rgba(18, 48, 58, 0)' },
    // Rare visits: a cold, dark teal that reads as "recorded, barely".
    { position: 0.18, color: 'rgba(23, 78, 92, 0.55)' },
    // Regular presence.
    { position: 0.42, color: 'rgba(37, 124, 118, 0.78)' },
    // Frequent: the ramp turns warm here, which is where the eye starts
    // reading "a lot".
    { position: 0.68, color: 'rgba(190, 110, 40, 0.9)' },
    // True hotspots only.
    { position: 0.88, color: '#f59e0b' },
    { position: 1.0, color: '#fcd34d' },
  ],
}

/** Turns the stop list into the object shape leaflet.heat wants. */
export function toLeafletGradient(stops: HeatStop[]): Record<number, string> {
  const gradient: Record<number, string> = {}
  for (const stop of stops) gradient[stop.position] = stop.color
  return gradient
}

/**
 * The full options object for a heat layer.
 *
 * `max` is a CONSTANT because the aggregation now hands over intensities
 * already normalised to 0..1 against a scale derived from the whole history
 * (see HeatScale). It used to be the current slice's own peak, which is what
 * made the time filter appear to do nothing: every slice renormalised itself
 * back to full brightness. Normalising upstream, once, is what lets a
 * quieter period actually render quieter.
 */
export function toLeafletOptions(config: HeatConfig) {
  return {
    radius: config.radius,
    blur: config.blur,
    maxZoom: config.maxZoom,
    minOpacity: config.minOpacity,
    max: ACCUMULATION_HEADROOM,
    gradient: toLeafletGradient(config.stops),
  }
}
