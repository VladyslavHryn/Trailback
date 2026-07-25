import { useCallback, useRef, useState } from 'react'
import type { Place } from '../analytics/places'
import {
  geocodePlaceCenters,
  type GeocodedPlace,
  type GeocodeProgress,
} from '../analytics/geocoding'

export type GeocodingState =
  | { status: 'idle' }
  | { status: 'running'; progress: GeocodeProgress }
  | { status: 'done'; results: Map<number, GeocodedPlace> }

// Nominatim is rate-limited to ~1 req/sec, so geocoding N places takes
// roughly N seconds — capped to the top places by time spent, not every
// cluster DBSCAN found (which can include very minor ones).
const MAX_PLACES_TO_GEOCODE = 25

// Runs entirely on the main thread, not a worker: this is I/O-bound (a
// network round-trip plus a deliberate delay), not CPU-bound, so there's
// nothing here that would block rendering the way clustering would.
export function useGeocoding() {
  const [state, setState] = useState<GeocodingState>({ status: 'idle' })
  // Guards against a stale run's late-arriving results overwriting a newer
  // one if the user loads a different file while geocoding is in flight.
  const runIdRef = useRef(0)

  const run = useCallback((places: Place[]) => {
    const runId = ++runIdRef.current
    const targets = places.slice(0, MAX_PLACES_TO_GEOCODE).map((p) => ({
      clusterId: p.clusterId,
      lat: p.lat,
      lng: p.lng,
    }))

    if (targets.length === 0) {
      setState({ status: 'done', results: new Map() })
      return
    }

    setState({ status: 'running', progress: { completed: 0, total: targets.length } })

    geocodePlaceCenters(targets, (progress) => {
      if (runIdRef.current !== runId) return
      setState({ status: 'running', progress })
    }).then((results) => {
      if (runIdRef.current !== runId) return
      setState({ status: 'done', results })
    })
  }, [])

  const reset = useCallback(() => {
    runIdRef.current++
    setState({ status: 'idle' })
  }, [])

  return { state, run, reset }
}
