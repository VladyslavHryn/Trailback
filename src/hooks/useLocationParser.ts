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

    worker.onerror = () => {
      setState({
        status: 'error',
        message: 'Не вдалося обробити файл. Спробуй інший експорт.',
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
