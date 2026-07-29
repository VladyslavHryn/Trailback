import { Flame, MapPin, Spline } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'
import type { MapLayer } from '../MapView'

type MapLayerToggleProps = {
  value: MapLayer
  onChange: (layer: MapLayer) => void
}

const OPTIONS: Array<{ value: MapLayer; label: string; icon: LucideIcon }> = [
  { value: 'heat', label: 'Теплова карта', icon: Flame },
  { value: 'places', label: 'Топ місць', icon: MapPin },
  { value: 'routes', label: 'Маршрути', icon: Spline },
]

/**
 * Switches which reading of the history the map draws.
 *
 * A segmented control rather than checkboxes, because these are alternatives
 * rather than additions — see MapLayer for why the three don't stack. Labels
 * are written out rather than left as icons: "heat vs routes" is not
 * something an icon communicates unambiguously, and this is the one control
 * on the screen that changes what the reader is looking at.
 */
export function MapLayerToggle({ value, onChange }: MapLayerToggleProps) {
  return (
    <div
      role="group"
      aria-label="Що показувати на карті"
      className="pointer-events-auto inline-flex gap-1 rounded-xl border border-glow-teal/12 bg-ink-950/60 p-1 backdrop-blur-xl"
    >
      {OPTIONS.map(({ value: option, label, icon: Icon }) => {
        const active = option === value
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            aria-pressed={active}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-3 py-2 font-mono text-[11px] transition-colors duration-200',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trail-300',
              active
                ? 'bg-glow-teal/10 text-trail-300 shadow-[0_2px_8px_rgba(63,184,168,0.15)]'
                : 'text-ink-400 hover:bg-ink-800/70 hover:text-ink-200',
            )}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
