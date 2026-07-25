/// <reference lib="webworker" />
// Runs the whole analytics engine off the main thread — clustering + the
// distance passes over a multi-year history is real compute, and this
// keeps the UI (already showing the heatmap) responsive while it happens.

import { runAnalytics, type AnalyticsResult } from '../analytics/runAnalytics'
import type { ParsedPoints } from '../parsing/types'

declare const self: DedicatedWorkerGlobalScope

export type AnalyticsWorkerRequest = { points: ParsedPoints }

export type AnalyticsWorkerResponse =
  | { type: 'done'; result: AnalyticsResult }
  | { type: 'error'; message: string }

self.onmessage = (event: MessageEvent<AnalyticsWorkerRequest>) => {
  try {
    const result = runAnalytics(event.data.points)
    const message: AnalyticsWorkerResponse = { type: 'done', result }
    self.postMessage(message)
  } catch (error) {
    const message: AnalyticsWorkerResponse = {
      type: 'error',
      message: error instanceof Error ? error.message : 'Не вдалося обчислити аналітику.',
    }
    self.postMessage(message)
  }
}
