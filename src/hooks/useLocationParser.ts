import { useCallback, useRef, useState } from 'react'
import type { ParseProgress, ParsedPoints } from '../parsing/types'
import type { WorkerResponse } from '../workers/locationParser.worker'

export type ParserState =
  | { status: 'idle' }
  | { status: 'parsing'; progress: ParseProgress }
  | { status: 'done'; points: ParsedPoints }
  | { status: 'error'; message: string }

export function useLocationParser() {
  const [state, setState] = useState<ParserState>({ status: 'idle' })
  const workerRef = useRef<Worker | null>(null)

  const parseFile = useCallback((file: File) => {
    workerRef.current?.terminate()

    const worker = new Worker(
      new URL('../workers/locationParser.worker.ts', import.meta.url),
      { type: 'module' },
    )
    workerRef.current = worker

    setState({
      status: 'parsing',
      progress: {
        bytesRead: 0,
        totalBytes: file.size,
        recordsSeen: 0,
        recordsSkipped: 0,
        pointsFound: 0,
      },
    })

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data
      if (message.type === 'progress') {
        setState({ status: 'parsing', progress: message.progress })
      } else if (message.type === 'done') {
        setState({ status: 'done', points: message.result })
        worker.terminate()
        workerRef.current = null
      } else {
        setState({ status: 'error', message: message.message })
        worker.terminate()
        workerRef.current = null
      }
    }

    // This fires when the WORKER ITSELF fails — it couldn't be loaded, or it
    // threw outside the handler's own try/catch. That is a different fault
    // from "the file couldn't be parsed", and it used to report the identical
    // sentence, so the two were indistinguishable from the outside. Whatever
    // the browser tells us about it goes into the message and the console
    // rather than being dropped.
    worker.onerror = (event: ErrorEvent) => {
      console.error('[trailback] parser worker failed', event)
      const detail = event?.message ? ` — ${event.message}` : ''
      setState({
        status: 'error',
        message: `Не вдалося запустити обробку файлу${detail}`,
      })
      worker.terminate()
      workerRef.current = null
    }

    worker.postMessage({ file })
  }, [])

  const reset = useCallback(() => {
    workerRef.current?.terminate()
    workerRef.current = null
    setState({ status: 'idle' })
  }, [])

  return { state, parseFile, reset }
}
