import { motion } from 'framer-motion'
import { Loader2, ShieldCheck } from 'lucide-react'
import type { ParseProgress } from '../parsing/types'
import { formatDecimal } from './story/format'

type ParsingScreenProps = {
  progress: ParseProgress
  onCancel: () => void
}

function formatMb(bytes: number): string {
  return formatDecimal(bytes / (1024 * 1024))
}

export function ParsingScreen({ progress, onCancel }: ParsingScreenProps) {
  const percent =
    progress.totalBytes > 0
      ? Math.min(100, Math.round((progress.bytesRead / progress.totalBytes) * 100))
      : 0

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-ink-950 px-6 text-ink-50">
      <div className="w-full max-w-md rounded-2xl border border-ink-700 bg-ink-900/60 p-8 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-trail-400" />

        <h1 className="mt-5 font-display text-xl font-semibold text-ink-50">
          Обробляємо твою геоісторію
        </h1>
        <p className="mt-2 text-sm text-ink-400">
          Файл великий, тому це відбувається частинами прямо в браузері — і
          нікуди не завантажується.
        </p>

        <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-ink-800">
          <motion.div
            className="h-full rounded-full bg-trail-500"
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          />
        </div>
        <div className="mt-2 flex justify-between font-mono text-xs text-ink-400">
          <span>{percent}%</span>
          <span>
            {formatMb(progress.bytesRead)} / {formatMb(progress.totalBytes)} МБ
          </span>
        </div>

        <p className="mt-4 font-mono text-xs text-ink-400">
          Знайдено точок: {progress.pointsFound.toLocaleString('uk-UA')}
          {progress.recordsSkipped > 0 && (
            <> · пропущено записів: {progress.recordsSkipped.toLocaleString('uk-UA')}</>
          )}
        </p>

        {/* The same badge the landing page carries, repeated at the one
            moment the reader is actually handing over the file — a promise
            made only on the screen before this one is the easiest promise to
            doubt.

            It promises what is actually true, and no more. This used to read
            "нічого не покидає цей пристрій", which is an absolute the product
            does not keep: later, to name the top places, their rounded centres
            are sent to OpenStreetMap. A privacy claim that turns out to have
            an unmentioned exception costs more trust than the exception itself
            ever would, so the file gets the absolute promise — it genuinely
            never leaves — and the exception is named on the spot. */}
        <p className="mt-6 inline-flex items-center gap-1.5 text-xs text-ink-400">
          <ShieldCheck className="h-3.5 w-3.5 text-ink-400" />
          Твій файл не залишає цей пристрій
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-ink-600">
          Згодом, щоб підписати твої топ-місця, до Foursquare і OpenStreetMap
          підуть лише округлені координати їхніх центрів — кілька десятків
          точок, ніколи не сам файл.
        </p>

        <button
          type="button"
          onClick={onCancel}
          className="mt-4 block w-full text-xs text-ink-400 underline decoration-ink-700 underline-offset-4 transition hover:text-trail-300"
        >
          Скасувати
        </button>
      </div>
    </div>
  )
}
