import { Reveal } from './Reveal'
import { MapView, type MapLayer } from '../MapView'
import { MapLayerToggle } from './MapLayerToggle'
import type { ParsedPoints } from '../../parsing/types'
import type { DisplayPlace } from '../../analytics/placeInsights'

type MapSectionProps = {
  points: ParsedPoints
  places?: DisplayPlace[]
  layer: MapLayer
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

export function MapSection({ points, places, layer, onLayerChange }: MapSectionProps) {
  const caption = CAPTIONS[layer]

  return (
    <section className="relative h-svh w-full">
      <MapView
        points={points}
        places={places}
        layer={layer}
        scrollWheelZoom={false}
      />

      {/* Gradient scrims top and bottom: the caption needs a readable
          backing, but a solid panel over a full-bleed map would undo the
          point of making the map full-bleed in the first place. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-ink-950 via-ink-950/70 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink-950 to-transparent"
      />

      {/* Caption block kept on the same left axis as every other section's
          content column, rather than centred over the map — the map is the
          full-bleed element, so the type has to hold the alignment.
          `pointer-events-none` on the wrapper, restored on the toggle itself,
          so the caption never intercepts a drag of the map underneath it. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 px-6 pt-28 md:px-10 md:pt-32">
        <div className="mx-auto grid w-full max-w-7xl md:grid-cols-[7rem_minmax(0,1fr)] md:gap-x-12 lg:grid-cols-[9rem_minmax(0,1fr)]">
          <Reveal>
            <div>
              <p className="font-mono text-xs text-ink-600">02</p>
              <p className="mt-2 text-label-micro text-signal-400 md:text-[11px]">
                {caption.eyebrow}
              </p>
            </div>
          </Reveal>
          <div className="mt-6 md:mt-0">
            <Reveal index={1}>
              <h2 className="max-w-[24ch] font-display text-3xl font-semibold leading-[1.05] tracking-tight text-ink-50 md:text-5xl">
                {caption.title}
              </h2>
            </Reveal>
            <Reveal index={2}>
              <p className="mt-4 max-w-[46ch] text-sm leading-relaxed text-ink-400 md:text-base">
                {caption.body}
              </p>
            </Reveal>

            <div className="mt-6">
              <MapLayerToggle value={layer} onChange={onLayerChange} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
