import { Reveal } from './Reveal'
import { MapView } from '../MapView'
import type { ParsedPoints } from '../../parsing/types'
import type { DisplayPlace } from '../../analytics/placeInsights'

type MapSectionProps = {
  points: ParsedPoints
  places?: DisplayPlace[]
}

export function MapSection({ points, places }: MapSectionProps) {
  return (
    <section className="relative h-svh w-full">
      <MapView points={points} places={places} scrollWheelZoom={false} />

      {/* Gradient scrims top and bottom: the caption needs a readable
          backing, but a solid panel over a full-bleed map would undo the
          point of making the map full-bleed in the first place. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-ink-950 via-ink-950/70 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-ink-950 to-transparent"
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 px-6 pt-16 md:px-12 md:pt-20">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal-400">
              Уся історія разом
            </p>
          </Reveal>
          <Reveal index={1}>
            <h2 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight text-ink-50 md:text-5xl">
              Твоє життя як теплова карта
            </h2>
          </Reveal>
          <Reveal index={2}>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-400 md:text-base">
              Що яскравіше світиться — то більше часу там пройшло. Карту можна
              рухати, масштаб — кнопками «+» та «−».
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
