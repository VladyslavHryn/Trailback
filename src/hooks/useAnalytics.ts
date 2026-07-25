import { useCallback, useRef, useState } from 'react'
import type { ParsedPoints } from '../parsing/types'
import type { AnalyticsResult } from '../analytics/runAnalytics'
import type {
  AnalyticsWorkerRequest,
  AnalyticsWorkerResponse,
} from '../workers/analytics.worker'

export type AnalyticsState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done'; result: AnalyticsResult }
  | { status: 'error'; message: string }

export function useAnalytics() {
  const [state, setState] = useState<AnalyticsState>({ status: 'idle' })
  const workerRef = useRef<Worker | null>(null)

  const run = useCallback((points: ParsedPoints) => {
    workerRef.current?.terminate()

    const worker = new Worker(new URL('../workers/analytics.worker.ts', import.meta.url), {
      type: 'module',
    })
    workerRef.current = worker
    setState({ status: 'running' })

    worker.onmessage = (event: MessageEvent<AnalyticsWorkerResponse>) => {
      const message = event.data
      if (message.type === 'done') {
        setState({ status: 'done', result: message.result })
      } else {
        setState({ status: 'error', message: message.message })
      }
      worker.terminate()
      workerRef.current = null
    }

    worker.onerror = () => {
      setState({ status: 'error', message: 'Не вдалося обчислити аналітику.' })
      worker.terminate()
      workerRef.current = null
    }

    // No transfer list here on purpose: the main thread keeps its own copy
    // of `points` for the heatmap, so the typed arrays must be CLONED to
    // the worker, not moved out from under it.
    const request: AnalyticsWorkerRequest = { points }
    worker.postMessage(request)
  }, [])

  const reset = useCallback(() => {
    workerRef.current?.terminate()
    workerRef.current = null
    setState({ status: 'idle' })
  }, [])

  return { state, run, reset }
}
