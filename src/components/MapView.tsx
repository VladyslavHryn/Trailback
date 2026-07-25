import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '../map/registerLeafletHeat'
import type { ParsedPoints } from '../parsing/types'
import { aggregateHeatmapPoints } from '../map/aggregateHeatmapPoints'

// Placeholder route shown until a real file is parsed (and reused by the
// landing page's "Переглянути демо-карту" shortcut).
const DEMO_POINTS: Array<{ lat: number; lng: number; label: string }> = [
  { lat: 50.4501, lng: 30.5234, label: 'Київ' },
  { lat: 49.8397, lng: 24.0297, label: 'Львів' },
  { lat: 48.4647, lng: 35.0462, label: 'Дніпро' },
  { lat: 46.4825, lng: 30.7233, label: 'Одеса' },
]

// CARTO's dark basemap is still OpenStreetMap data underneath (CARTO just
// restyles the same OSM tiles), so it satisfies the "Leaflet + OSM" stack
// while looking far less harsh than the stock raster tiles — and it gives
// the Step 3 heatmap a dark canvas to glow against instead of fighting it.
export const TILE_URL =
  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'

// Shared with the landing page's hero demo so the "preview" and the real
// map use the exact same marker style instead of two divergent look&feels.
export function createPulseIcon() {
  return L.divIcon({
    className: '',
    html: '<div class="trail-marker-pulse"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

type MapViewProps = {
  points?: ParsedPoints
}

export function MapView({ points }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerGroupRef = useRef<L.LayerGroup | null>(null)

  // Mount the map + base tiles once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, { zoomControl: true })

    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTRIBUTION,
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map)

    mapRef.current = map

    // Leaflet measures the container once at construction time. If the
    // flex layout around it hasn't settled yet (or the pane resizes later),
    // the map is left thinking it's 0x0 — harmless for plain markers, but
    // leaflet.heat's canvas throws (`getImageData` with a 0 width) instead
    // of just rendering nothing. invalidateSize keeps the map's idea of its
    // own size in sync with reality.
    map.invalidateSize()
    const resizeObserver = new ResizeObserver(() => map.invalidateSize())
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Draw either the real parsed points or the placeholder route, and refit
  // the view — kept separate from map creation so this can react to `points`
  // arriving without tearing down and recreating the tiles.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    layerGroupRef.current?.remove()
    const layerGroup = L.layerGroup().addTo(map)
    layerGroupRef.current = layerGroup

    if (points && points.lat.length > 0) {
      const count = points.lat.length

      // True extent over ALL points (cheap numeric pass), not just the
      // rendered sample below — the view should cover the whole history
      // even if a far-flung outlier point happens to land between strides.
      let minLat = Infinity
      let maxLat = -Infinity
      let minLng = Infinity
      let maxLng = -Infinity
      for (let i = 0; i < count; i++) {
        const lat = points.lat[i]
        const lng = points.lng[i]
        if (lat < minLat) minLat = lat
        if (lat > maxLat) maxLat = lat
        if (lng < minLng) minLng = lng
        if (lng > maxLng) maxLng = lng
      }
      map.fitBounds(
        [
          [minLat, minLng],
          [maxLat, maxLng],
        ],
        { padding: [32, 32] },
      )

      // The whole-history heatmap is the actual differentiator over Google
      // (which only ever shows one day at a time) — see
      // aggregateHeatmapPoints for why raw pings are grid-aggregated first
      // rather than fed to the heat layer directly or just downsampled.
      const { points: heatPoints, maxIntensity } = aggregateHeatmapPoints(points)
      L.heatLayer(heatPoints, {
        radius: 16,
        blur: 20,
        max: maxIntensity,
        minOpacity: 0.25,
        // Heat intensity is a MAGNITUDE (how often you were here), so this
        // is a sequential scale — one hue, light→dark — not a blend of two
        // hues. Crossing from teal to orange mid-ramp looked like a muddy
        // brown stain where they met (RGB-interpolating between
        // near-complementary hues desaturates instead of blending cleanly).
        // Staying inside one hue (brand orange) and only ramping
        // opacity/lightness avoids that entirely.
        gradient: {
          0.15: 'rgba(232, 133, 58, 0)',
          0.4: 'rgba(232, 133, 58, 0.45)',
          0.65: '#e8853a',
          0.85: '#f2a35e',
          1.0: '#f7c088',
        },
      }).addTo(layerGroup)
    } else {
      const latLngs = DEMO_POINTS.map((p) => [p.lat, p.lng] as [number, number])
      map.fitBounds(L.latLngBounds(latLngs), { padding: [64, 64] })

      // Soft blurred glow line beneath the crisp dashed line, for depth.
      L.polyline(latLngs, {
        color: '#e8853a',
        weight: 10,
        opacity: 0.25,
        className: 'trail-route-glow',
      }).addTo(layerGroup)

      L.polyline(latLngs, {
        color: '#f2a35e',
        weight: 3,
        opacity: 0.9,
        lineCap: 'round',
        className: 'trail-route-line',
      }).addTo(layerGroup)

      DEMO_POINTS.forEach((point) => {
        L.marker([point.lat, point.lng], { icon: createPulseIcon() })
          .addTo(layerGroup)
          .bindTooltip(point.label, { direction: 'top', offset: [0, -10] })
      })
    }
  }, [points])

  return <div ref={containerRef} className="h-full w-full" />
}
