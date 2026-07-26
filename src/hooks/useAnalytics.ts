import { useCallback, useRef, useState } from 'react'
import type { ParsedPoints } from '../parsing/types'
import type { AnalyticsResult } from '../analytics/runAnalytics'
import { filterPointsByRange, rangeKey, type RangeSelection } from '../analytics/timeRange'
import type {
  AnalyticsWorkerRequest,
  AnalyticsWorkerResponse,
} from '../workers/analytics.worker'

export type AnalyticsState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done'; result: AnalyticsResult }
  | { status: 'error'; message: string }

/**
 * Runs the analytics engine for a given time range, and remembers what it
 * already computed.
 *
 * THE CACHE is the whole point of this hook rather than a bare worker call.
 * Clustering a multi-year history is seconds of work, and the time filter
 * invites the reader to move back and forth between periods — "2023, then
 * 2024, then back to 2023". Without a cache every one of those is a full
 * re-run of DBSCAN over the same points, and the third one is just as slow
 * as the first. Keyed by range, a period the reader has already visited
 * comes back instantly and synchronously, with no loading state at all.
 *
 * Lifetime is the visit: a plain in-memory Map, cleared on reset. It is
 * deliberately NOT persisted to storage — the results are derived from
 * someone's movement history, and writing that to disk to save a few
 * seconds would trade the product's core promise for a minor convenience.
 */
export function useAnalytics() {
  const [state, setState] = useState<AnalyticsState>({ status: 'idle' })
  const workerRef = useRef<Worker | null>(null)
  const cacheRef = useRef(new Map<string, AnalyticsResult>())
  // Guards against a superseded run: if the reader switches range while a
  // worker is mid-flight, the older result must not overwrite the newer one.
  const runIdRef = useRef(0)

  const run = useCallback((points: ParsedPoints, selection: RangeSelection) => {
    const key = rangeKey(selection)
    const runId = ++runIdRef.current

    const cached = cacheRef.current.get(key)
    if (cached) {
      workerRef.current?.terminate()
      workerRef.current = null
      setState({ status: 'done', result: cached })
      return
    }

    workerRef.current?.terminate()

    const worker = new Worker(new URL('../workers/analytics.worker.ts', import.meta.url), {
      type: 'module',
    })
    workerRef.current = worker
    setState({ status: 'running' })

    worker.onmessage = (event: MessageEvent<AnalyticsWorkerResponse>) => {
      const message = event.data
      worker.terminate()
      if (workerRef.current === worker) workerRef.current = null
      if (runIdRef.current !== runId) return

      if (message.type === 'done') {
        cacheRef.current.set(key, message.result)
        setState({ status: 'done', result: message.result })
      } else {
        setState({ status: 'error', message: message.message })
      }
    }

    worker.onerror = () => {
      worker.terminate()
      if (workerRef.current === worker) workerRef.current = null
      if (runIdRef.current !== runId) return
      setState({ status: 'error', message: 'Не вдалося обчислити аналітику.' })
    }

    // Filtering happens here, on the main thread, so the worker only ever
    // receives the slice it needs. Posting the whole history and filtering
    // inside would structured-clone every point on every range change —
    // tens of megabytes copied to look at one month.
    //
    // No transfer list: the main thread keeps its own copy of `points` for
    // the map, so the typed arrays must be CLONED, not moved out from
    // under it.
    const request: AnalyticsWorkerRequest = {
      points: filterPointsByRange(points, selection),
    }
    worker.postMessage(request)
  }, [])

  const reset = useCallback(() => {
    runIdRef.current++
    workerRef.current?.terminate()
    workerRef.current = null
    cacheRef.current.clear()
    setState({ status: 'idle' })
  }, [])

  return { state, run, reset }
}
