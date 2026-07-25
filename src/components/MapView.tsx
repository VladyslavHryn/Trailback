import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '../map/registerLeafletHeat'
import type { ParsedPoints } from '../parsing/types'
import type { DisplayPlace } from '../analytics/placeInsights'
import { assignDistrictColors } from '../analytics/placeInsights'
import { aggregateHeatmapPoints } from '../map/aggregateHeatmapPoints'

const MAX_PLACE_MARKERS = 8
// Plain hex (not the CSS var) because it gets an alpha suffix appended
// below for the marker glow — var(--x)80 isn't valid CSS.
const DEFAULT_PLACE_COLOR = '#22d3ee'

function createPlaceIcon(rank: number, color: string) {
  return L.divIcon({
    className: '',
    html: `<div class="trail-place-marker" style="border-color:${color};color:${color};box-shadow:0 0 10px ${color}80">${rank}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}

function formatVisitDuration(seconds: number): string {
  const hours = seconds / 3600
  if (hours >= 24) return `${Math.round(hours / 24)} дн`
  if (hours >= 1) return `${hours.toFixed(1)} год`
  return `${Math.round(seconds / 60)} хв`
}

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
  places?: DisplayPlace[]
  /**
   * Off inside the scroll-story: a full-height map that captures the wheel
   * would swallow the page scroll and trap the reader on that screen, with
   * no way to continue. Zoom stays available via the +/- controls and
   * double-click, so nothing is actually lost.
   */
  scrollWheelZoom?: boolean
}

export function MapView({ points, places, scrollWheelZoom = true }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerGroupRef = useRef<L.LayerGroup | null>(null)
  const placesLayerRef = useRef<L.LayerGroup | null>(null)

  // Mount the map + base tiles once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, { zoomControl: true, scrollWheelZoom })

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
    // Deliberately mount-once: `scrollWheelZoom` is read at construction and
    // is fixed per usage site, and re-running this would tear down and
    // rebuild the whole map (and its tiles) rather than toggle one option.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      // Belt-and-suspenders on top of the invalidateSize()/ResizeObserver in
      // the mount effect: if the container still measures 0x0 right at this
      // exact instant (seen in the split-view layout — the map's flex
      // sibling can shift its width after this effect already fired),
      // leaflet.heat's canvas throws IndexSizeError instead of just
      // rendering nothing. Retrying a beat later rather than crashing the
      // whole map view is worth a little duplication here.
      const addHeatLayerWhenSized = (attemptsLeft: number) => {
        const size = map.getSize()
        if ((size.x === 0 || size.y === 0) && attemptsLeft > 0) {
          setTimeout(() => addHeatLayerWhenSized(attemptsLeft - 1), 100)
          return
        }
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
            0.15: 'rgba(245, 158, 11, 0)',
            0.4: 'rgba(245, 158, 11, 0.45)',
            0.65: '#f59e0b',
            0.85: '#fbbf24',
            1.0: '#fcd34d',
          },
        }).addTo(layerGroup)
      }
      addHeatLayerWhenSized(20)
    } else {
      const latLngs = DEMO_POINTS.map((p) => [p.lat, p.lng] as [number, number])
      map.fitBounds(L.latLngBounds(latLngs), { padding: [64, 64] })

      // Soft blurred glow line beneath the crisp dashed line, for depth.
      L.polyline(latLngs, {
        color: '#f59e0b',
        weight: 10,
        opacity: 0.25,
        className: 'trail-route-glow',
      }).addTo(layerGroup)

      L.polyline(latLngs, {
        color: '#fbbf24',
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

  // Place markers live in their own layer/effect, separate from the
  // heatmap — analytics finishes well after the heatmap is already showing
  // (it's a heavier, worker-side computation), so this shouldn't force a
  // re-draw of the heatmap layer when results arrive.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    placesLayerRef.current?.remove()
    if (!places || places.length === 0) {
      placesLayerRef.current = null
      return
    }

    const placesLayer = L.layerGroup().addTo(map)
    placesLayerRef.current = placesLayer

    const shown = places.slice(0, MAX_PLACE_MARKERS)
    // Markers colored by district (when known) so the map itself shows the
    // district breakdown, not just the dashboard list — same color
    // assignment logic as the dashboard's district cards.
    const districtColors = assignDistrictColors(
      shown.map((p) => p.district).filter((d): d is string => d != null),
    )

    shown.forEach((place, index) => {
      const color = place.district ? (districtColors.get(place.district) ?? DEFAULT_PLACE_COLOR) : DEFAULT_PLACE_COLOR
      L.marker([place.lat, place.lng], { icon: createPlaceIcon(index + 1, color) })
        .addTo(placesLayer)
        .bindTooltip(
          `#${index + 1} ${place.displayName} · ${place.visitCount} візитів · ${formatVisitDuration(place.totalDurationSec)}`,
          { direction: 'top', offset: [0, -12] },
        )
    })
  }, [places])

  return <div ref={containerRef} className="h-full w-full" />
}
