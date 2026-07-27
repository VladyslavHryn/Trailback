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
      result.sources.buffer,
    ])
  } catch (error) {
    // A LocationParseError is a diagnosis this code wrote on purpose, and its
    // message already tells the reader what to do about it.
    //
    // ANYTHING ELSE IS A SURPRISE, and the previous version replaced it with
    // a fixed sentence — which is how a real failure became impossible to act
    // on: the same nine words covered a corrupt file, an out-of-memory kill
    // and a bug in this parser, and nothing anywhere recorded which. Keep the
    // friendly framing, carry the actual reason inside it, and put the full
    // error (stack included) somewhere a developer can read it.
    if (error instanceof LocationParseError) {
      const message: WorkerResponse = { type: 'error', message: error.message }
      self.postMessage(message)
      return
    }

    console.error('[trailback] parsing failed unexpectedly', error)
    const detail =
      error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    const message: WorkerResponse = {
      type: 'error',
      message: `Не вдалося обробити файл — ${detail}`,
    }
    self.postMessage(message)
  }
}
