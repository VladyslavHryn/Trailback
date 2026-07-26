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

      {/* Caption block kept on the same left axis as every other section's
          content column, rather than centred over the map — the map is the
          full-bleed element, so the type has to hold the alignment. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 px-6 pt-16 md:px-10 md:pt-20">
        <div className="mx-auto grid w-full max-w-6xl md:grid-cols-[7rem_minmax(0,1fr)] md:gap-x-12 lg:grid-cols-[9rem_minmax(0,1fr)]">
          <Reveal>
            <div>
              <p className="font-mono text-xs text-ink-600">02</p>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-signal-400 md:text-[11px]">
                Уся історія разом
              </p>
            </div>
          </Reveal>
          <div className="mt-6 md:mt-0">
            <Reveal index={1}>
              <h2 className="max-w-[24ch] font-display text-3xl font-semibold leading-[1.05] tracking-tight text-ink-50 md:text-5xl">
                Твоє життя як теплова карта
              </h2>
            </Reveal>
            <Reveal index={2}>
              <p className="mt-4 max-w-[46ch] text-sm leading-relaxed text-ink-400 md:text-base">
                Що яскравіше світиться — то більше часу там пройшло. Карту можна
                рухати, масштаб — кнопками «+» та «−».
              </p>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  )
}
