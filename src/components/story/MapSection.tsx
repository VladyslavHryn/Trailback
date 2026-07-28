import { useCallback, useLayoutEffect, useRef } from 'react'
import { Reveal } from './Reveal'
import { MapView, type MapLayer } from '../MapView'
import { MapLayerToggle } from './MapLayerToggle'
import type { ParsedPoints } from '../../parsing/types'
import type { DisplayPlace } from '../../analytics/placeInsights'
import type { HeatScale } from '../../map/aggregateHeatmapPoints'

/**
 * The caption card's measured height, published so the map's zoom buttons can
 * sit directly beneath it.
 *
 * It cannot be a constant. The card's text changes with the selected layer —
 * "Твоє життя як теплова карта" wraps to two lines where "Твої маршрути" takes
 * one — and it reflows again at every breakpoint. Any fixed offset is
 * therefore wrong for two of the three layers, and wrong by enough to either
 * overlap the card or leave a visible gap under it.
 *
 * Same mechanism ResultsStory uses for the header height, for the same reason;
 * the consumer is MapView's ZoomButtons, which reads it in a `calc()`.
 */
const CAPTION_HEIGHT_VAR = '--trail-map-caption-h'

type MapSectionProps = {
  points: ParsedPoints
  places?: DisplayPlace[]
  layer: MapLayer
  heatScale?: HeatScale
  /** Human-readable current period, e.g. "2024 рік". */
  rangeLabel: string
  /** False whenever a year or month filter narrows the view. */
  isFullHistory: boolean
  onLayerChange: (layer: MapLayer) => void
}

// Each layer answers a different question, so the caption changes with it —
// a heading that said "your life as a heatmap" while the map drew routes
// would be describing something that isn't on screen.
const CAPTIONS: Record<MapLayer, { eyebrow: string; title: string; body: string }> = {
  heat: {
    eyebrow: 'Уся історія разом',
    title: 'Твоє життя як теплова карта',
    body: 'Що яскравіше світиться — то більше часу там пройшло. Google показував лише один день; тут — усі одразу.',
  },
  places: {
    eyebrow: 'Місця, які повторювались',
    title: 'Твої місця на карті',
    body: 'Кожна позначка — місце, куди ти повертався. Що яскравіша — то більше часу там пройшло. Наведи, щоб побачити деталі.',
  },
  routes: {
    eyebrow: 'Як ти рухався',
    title: 'Твої маршрути',
    body: 'Лінії — це справжні шляхи, якими ти проходив. Де вони накладаються густіше, там ти бував частіше.',
  },
}

/**
 * What the same three layers say once a year or month filter is on.
 *
 * The all-time wording makes claims the filtered map does not support. "Уся
 * історія разом" over one year of pings is simply false, and the heat layer's
 * "Google показував лише один день; тут — усі одразу" is the product's central
 * promise — repeating it above a twelve-month slice undercuts the one line the
 * whole app exists to earn. Selecting 2024 made this screen contradict the
 * header sitting directly above it.
 */
const RANGED_BODIES: Record<MapLayer, string> = {
  heat: 'Що яскравіше світиться — то більше часу там пройшло за цей період. Обери «Весь час» угорі, щоб побачити всі роки на одній карті.',
  places: 'Кожна позначка — місце, куди ти повертався саме в цей час. Що яскравіша — то більше часу там пройшло. Наведи, щоб побачити деталі.',
  routes: 'Лінії — це справжні шляхи, якими ти проходив за цей період. Де вони накладаються густіше, там ти бував частіше.',
}

export function MapSection({
  points,
  places,
  layer,
  heatScale,
  rangeLabel,
  isFullHistory,
  onLayerChange,
}: MapSectionProps) {
  const base = CAPTIONS[layer]
  const caption = isFullHistory
    ? base
    : { ...base, eyebrow: rangeLabel, body: RANGED_BODIES[layer] }

  // A callback ref owning its observer's whole lifetime, rather than a plain
  // ref plus a mount effect. Splitting the two is a StrictMode hazard: the
  // simulated unmount can run the effect's cleanup after the ref has already
  // re-attached, disconnecting a live observer that nothing then rebuilds.
  const captionNodeRef = useRef<HTMLDivElement | null>(null)
  const captionObserverRef = useRef<ResizeObserver | null>(null)

  const publishCaptionHeight = useCallback(() => {
    const node = captionNodeRef.current
    if (!node) return
    document.documentElement.style.setProperty(
      CAPTION_HEIGHT_VAR,
      `${node.offsetHeight}px`,
    )
  }, [])

  const measureCaption = useCallback(
    (node: HTMLDivElement | null) => {
      captionObserverRef.current?.disconnect()
      captionObserverRef.current = null
      captionNodeRef.current = node

      if (!node) {
        document.documentElement.style.removeProperty(CAPTION_HEIGHT_VAR)
        return
      }

      publishCaptionHeight()
      const observer = new ResizeObserver(publishCaptionHeight)
      observer.observe(node)
      captionObserverRef.current = observer
    },
    [publishCaptionHeight],
  )

  // Deliberately no dependency array. Switching layers rewrites the card's
  // text, and that is a RENDER — catching it here publishes the new height in
  // the same commit, before paint, instead of leaving the buttons at the old
  // offset until the observer fires on the next frame. The observer still
  // covers what a render here cannot: viewport resizes and late-loading fonts.
  useLayoutEffect(publishCaptionHeight)

  return (
    /* The section is a SCROLL TRACK, deliberately taller than the viewport,
       and everything visible lives in one pinned stage inside it. That split
       is what stops the caption and the map drifting apart.

       Both were previously laid out against the section directly: the map
       absolutely positioned, the caption sticky. Neither survives a scroll
       intact. Measured on a 720px viewport, scrolling 400px into the section
       put the map's top edge at -400px while the caption still sat at its
       136px offset — so the heading appeared to hang in place while the map
       slid out from behind it. Then, at 399px, the caption hit the bottom of
       its own containing block and started sliding too, at a different moment
       and from a different position.

       A sticky element can only stay put for as long as its container has
       room left, so no combination of offsets fixes this while the container
       is exactly one viewport tall. Pinning the whole stage instead makes the
       question moot: the map, the scrims and the caption are one box, they
       cannot move relative to each other, and the extra track length is what
       the reader spends looking at the map. */
    <section className="relative h-[160svh] w-full">
      <div className="sticky top-0 h-svh w-full overflow-hidden">
        <div className="absolute inset-0">
          <MapView
            points={points}
            places={places}
            layer={layer}
            heatScale={heatScale}
            scrollWheelZoom={false}
          />
        </div>

        {/* Scrims. The top one is the caption's backing and so runs deeper;
            the bottom one only has to stop the map dying against the section
            edge and keep Leaflet's attribution legible.

            A full-width band rather than a panel behind the block alone: the
            map is deliberately full-bleed, and a card floating on it would
            undo that. The gradient keeps the middle of the frame — where the
            trails are — completely clear. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-gradient-to-b from-ink-950 via-ink-950/60 to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink-950 to-transparent"
        />

        {/* Caption as a COMPACT BLOCK in the top-right corner, hugging the
            map's own edge rather than the story's text column.

            This is the one section whose background carries meaning, so the
            type has to go wherever the data is not, and on this history that
            is the upper right: the trails run diagonally from the top-centre
            down through the middle and along the bottom. Every earlier
            placement collided with them somewhere — across the top it sat on
            the densest band, along the bottom it sat on the Poznyaky loop.

            THE TRADE, stated plainly: it leaves the 113/305px left spine the
            other six sections share. That is a real cost and it was not worth
            paying while the block spanned the full width — a full-measure
            block set flush right also drags the index label into a trailing
            position and gives the body copy a ragged left edge. Shrunk to a
            36rem card it costs neither: the text inside is still left-aligned
            and the index still leads, the whole thing simply sits in the
            corner of the frame the way a map's own controls do.

            Anchored to the VIEWPORT gutter, not to max-w-7xl. On a 1920px
            screen the centred container ends at 1560 while the map runs to the
            edge, and a caption stopping 360px short of the frame reads as
            misalignment rather than as a margin.

            `pointer-events-none` on the wrapper, restored on the toggle
            itself, so the caption never intercepts a drag of the map
            underneath it.

            z-800 sits above every Leaflet map pane (they run to 700), so the
            caption is never printed under a marker, and below Leaflet's own
            control corners (1000) and the header (1100). */}
        <div
          className="pointer-events-none absolute inset-x-6 z-[800] flex justify-end md:inset-x-10"
          style={{ top: 'calc(var(--trail-header-h, 9rem) + 2rem)' }}
        >
          <div ref={measureCaption} className="w-full max-w-[36rem]">
            {/* Index and eyebrow on one line. The 9rem side rail the other
                sections use is a device for a full-width column; inside a
                36rem card it would eat a quarter of the measure to set two
                short labels. */}
            <Reveal>
              <p className="flex items-baseline gap-3 font-mono text-xs text-ink-600">
                02
                <span className="text-label-micro text-trail-400 md:text-[11px]">
                  {caption.eyebrow}
                </span>
              </p>
            </Reveal>

            <Reveal index={1}>
              <h2 className="mt-4 font-display text-3xl font-semibold leading-[1.05] tracking-tight text-ink-50 md:text-[2.75rem]">
                {caption.title}
              </h2>
            </Reveal>
            <Reveal index={2}>
              <p className="mt-4 max-w-[44ch] text-sm leading-relaxed text-ink-400 md:text-base">
                {caption.body}
              </p>
            </Reveal>

            {/* UNDER the text, not beside it. Setting it alongside is what
                made an earlier pass look broken: the switcher is 354px wide
                and `shrink-0`, so on a 820px viewport it took the row and left
                the heading 163px to wrap in — five lines of one and two words
                each, measured, in a column with 565px available. A control
                that can starve the headline next to it does not belong on the
                headline's row. */}
            <div className="mt-6">
              <MapLayerToggle value={layer} onChange={onLayerChange} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
