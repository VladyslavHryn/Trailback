/// <reference lib="webworker" />
// Runs the whole parse off the main thread so a multi-hundred-MB file never
// freezes the UI. This file is intentionally thin — all real logic lives in
// src/parsing, which has no worker-specific globals and is easy to test on
// its own.

import { parseLocationFile } from '../parsing/parseLocationFile'
import { LocationParseError, type ParseProgress, type ParsedPoints } from '../parsing/types'

declare const self: DedicatedWorkerGlobalScope

export type WorkerRequest = { file: File }

export type WorkerResponse =
  | { type: 'progress'; progress: ParseProgress }
  | { type: 'done'; result: ParsedPoints }
  | { type: 'error'; message: string }

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { file } = event.data

  try {
    const result = await parseLocationFile(file, (progress) => {
      const message: WorkerResponse = { type: 'progress', progress }
      self.postMessage(message)
    })

    const message: WorkerResponse = { type: 'done', result }
    self.postMessage(message, [
      result.lat.buffer,
      result.lng.buffer,
      result.timestampSec.buffer,
    ])
  } catch (error) {
    const text =
      error instanceof LocationParseError
        ? error.message
        : 'Не вдалося обробити файл. Спробуй інший експорт.'
    const message: WorkerResponse = { type: 'error', message: text }
    self.postMessage(message)
  }
}
