import { useState } from 'react'
import { ChevronDown, Copy, RotateCcw } from 'lucide-react'
import {
  DEFAULT_HEAT_PRESET,
  HEAT_PRESETS,
  type HeatConfig,
  type HeatPresetName,
} from '../../map/heatConfig'
import { cn } from '../../lib/cn'

type HeatTunerProps = {
  config: HeatConfig
  onChange: (config: HeatConfig) => void
  /** Peak cell intensity in the current dataset — shown so the `max` the
   * layer actually receives isn't a mystery while tuning. */
  peakIntensity: number
}

/**
 * Dev-only live controls for the heatmap.
 *
 * Deliberately writes STRAIGHT to the layer on every input event rather than
 * behind an "apply" button: the whole point is to drag a slider and watch the
 * render change, which is the only reliable way to pick these values. Nothing
 * here is persisted — "Копіювати" dumps the current config as JSON so a
 * setting arrived at by eye can be pasted back into heatConfig.ts as the new
 * default.
 */
export function HeatTuner({ config, onChange, peakIntensity }: HeatTunerProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [copied, setCopied] = useState(false)

  const set = <K extends keyof HeatConfig>(key: K, value: HeatConfig[K]) =>
    onChange({ ...config, [key]: value })

  const setStopPosition = (index: number, position: number) => {
    const stops = config.stops.map((stop, i) =>
      i === index ? { ...stop, position } : stop,
    )
    onChange({ ...config, stops })
  }

  const applyPreset = (name: HeatPresetName) => onChange(HEAT_PRESETS[name])

  const copyConfig = async () => {
    await navigator.clipboard.writeText(JSON.stringify(config, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const effectiveMax = (peakIntensity * config.peakHeadroom).toFixed(2)

  return (
    <div
      className={cn(
        'absolute right-4 top-4 z-[1200] w-[268px] overflow-hidden rounded-xl',
        'border border-ink-700 bg-ink-950/92 font-mono text-[11px] text-ink-200',
        'shadow-[0_16px_40px_rgba(0,0,0,0.6)] backdrop-blur-md',
      )}
    >
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-ink-800/70"
      >
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-trail-400" />
          Heatmap · dev
        </span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 transition-transform', isOpen && 'rotate-180')}
        />
      </button>

      {isOpen && (
        <div className="border-t border-ink-800 px-3 pb-3 pt-2.5">
          <div className="flex gap-1.5">
            {(Object.keys(HEAT_PRESETS) as HeatPresetName[]).map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => applyPreset(name)}
                className="flex-1 rounded-md border border-ink-700 px-2 py-1.5 capitalize transition-colors hover:border-signal-500 hover:text-signal-300"
              >
                {name}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] leading-snug text-ink-400">
            «baseline» — еталонні значення leaflet.heat. Якщо на них видно, а
            на «amber» ні — справа в кольорах, а не в даних.
          </p>

          <div className="mt-3 flex flex-col gap-2.5">
            <Slider
              label="minOpacity"
              value={config.minOpacity}
              min={0.1}
              max={0.9}
              step={0.01}
              onChange={(v) => set('minOpacity', v)}
            />
            <Slider
              label="peakHeadroom"
              value={config.peakHeadroom}
              min={0.05}
              max={1}
              step={0.01}
              onChange={(v) => set('peakHeadroom', v)}
              hint={`max = ${effectiveMax}`}
            />
            <Slider
              label="radius"
              value={config.radius}
              min={10}
              max={50}
              step={1}
              onChange={(v) => set('radius', v)}
            />
            <Slider
              label="blur"
              value={config.blur}
              min={5}
              max={40}
              step={1}
              onChange={(v) => set('blur', v)}
            />
            <Slider
              label="maxZoom"
              value={config.maxZoom}
              min={10}
              max={20}
              step={1}
              onChange={(v) => set('maxZoom', v)}
            />
          </div>

          <p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-ink-400">
            Позиції стопів
          </p>
          <div className="mt-1.5 flex flex-col gap-2">
            {config.stops.map((stop, i) => (
              <div key={i} className="flex items-center gap-2">
                <span
                  className="h-3 w-3 shrink-0 rounded-sm border border-ink-700"
                  style={{ background: stop.color }}
                />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={stop.position}
                  onChange={(e) => setStopPosition(i, Number(e.target.value))}
                  className="h-1 flex-1 accent-trail-400"
                />
                <span className="w-8 shrink-0 text-right tabular-nums text-ink-400">
                  {stop.position.toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-3 flex gap-1.5">
            <button
              type="button"
              onClick={copyConfig}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-ink-700 px-2 py-1.5 transition-colors hover:border-signal-500 hover:text-signal-300"
            >
              <Copy className="h-3 w-3" />
              {copied ? 'Скопійовано' : 'Копіювати'}
            </button>
            <button
              type="button"
              onClick={() => applyPreset(DEFAULT_HEAT_PRESET)}
              aria-label="Скинути"
              className="rounded-md border border-ink-700 px-2 py-1.5 transition-colors hover:border-signal-500 hover:text-signal-300"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  hint,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  hint?: string
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between">
        <span className="text-ink-200">{label}</span>
        <span className="tabular-nums text-trail-300">
          {step < 1 ? value.toFixed(2) : value}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 h-1 w-full accent-trail-400"
      />
      {hint && <span className="mt-0.5 block text-[10px] text-ink-400">{hint}</span>}
    </label>
  )
}
