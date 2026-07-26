import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '../map/registerLeafletHeat'
import type { ParsedPoints } from '../parsing/types'
import type { DisplayPlace } from '../analytics/placeInsights'
import { districtShade } from '../analytics/placeInsights'
import { aggregateHeatmapPoints } from '../map/aggregateHeatmapPoints'
import { HEAT_CONFIG, toLeafletOptions } from '../map/heatConfig'

const MAX_PLACE_MARKERS = 8

// Only the strongest few pins get a written label. Every pin carrying its
// name is how a map turns into a wall of overlapping chips the moment two
// places sit in the same neighbourhood — which, for a personal history, is
// most of them. The rest stay as dots and reveal their name on hover.
const MAX_LABELLED_PINS = 4

/** Guards against a place name breaking out of the markup or the layout. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function truncate(value: string, max = 22): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

function createPlaceIcon(rank: number, color: string, label: string | null) {
  const labelHtml = label
    ? `<span class="trail-pin__label">
         <span class="trail-pin__rank">${String(rank).padStart(2, '0')}</span>
         <span>${escapeHtml(truncate(label))}</span>
       </span>`
    : ''

  return L.divIcon({
    className: '',
    html: `<div class="trail-pin" style="--pin:${color}">
             <span class="trail-pin__dot"></span>
             ${labelHtml}
           </div>`,
    // Zero-size box anchored exactly on the coordinate; `.trail-pin` then
    // transforms itself so the DOT lands on the point and the label flows
    // to the right. Sizing the box instead would centre the whole
    // dot+label pair, putting the dot off the location it marks.
    iconSize: [0, 0],
    iconAnchor: [0, 0],
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
// the heatmap a dark canvas to glow against instead of fighting it.
//
// Crucially it's taken as TWO layers rather than the combined `dark_all`.
// The combined style bakes settlement names into the same image as the
// geography, so every village around the city ("Kotsiubynske", "Irpin")
// shouts at full contrast across the view with no way to quiet it. Split
// apart, the labels get their own pane that sits UNDER the data and can be
// dimmed and desaturated in CSS (`.trail-labels-pane`) — present enough to
// orient you, quiet enough to stay out of the way.
export const TILE_URL =
  'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png'
export const LABEL_TILE_URL =
  'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png'
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'

/** Pane for the label tiles: above the basemap, below the heat/marker data. */
const LABELS_PANE = 'trailLabels'

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

  const heatLayerRef = useRef<L.HeatLayer | null>(null)

  // Mount the map + base tiles once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, { zoomControl: true, scrollWheelZoom })

    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTRIBUTION,
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map)

    // Own pane, z-index between the basemap (200) and the data overlays
    // (400), so place names sit above the geography but under the heatmap
    // and pins. `.trail-labels-pane` then dims the whole pane at once.
    const labelsPane = map.createPane(LABELS_PANE)
    labelsPane.style.zIndex = '250'
    labelsPane.classList.add('trail-labels-pane')
    L.tileLayer(LABEL_TILE_URL, {
      subdomains: 'abcd',
      maxZoom: 20,
      pane: LABELS_PANE,
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

    // Guards the deferred layer creation below against a superseded run of
    // this effect. Without it there is a real race: the sizing retry is a
    // setTimeout that closes over ITS OWN layerGroup, so when the effect
    // re-runs (new points, or React's development double-mount) the pending
    // callback from the previous run still fires, builds a heat layer, adds
    // it to a group that has already been removed from the map, and — worst
    // of all — overwrites heatLayerRef with it. The map then shows one layer
    // while the tuner drives a detached one, so every slider looks dead.
    let cancelled = false

    // The heat layer belongs to the group being dropped, so clear the ref
    // with it rather than leaving the tuner pointing at a detached layer.
    heatLayerRef.current = null
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
        if (cancelled) return
        const size = map.getSize()
        if ((size.x === 0 || size.y === 0) && attemptsLeft > 0) {
          setTimeout(() => addHeatLayerWhenSized(attemptsLeft - 1), 100)
          return
        }

        // Every visual parameter comes from heatConfig.ts, which documents
        // why each value is what it is.
        heatLayerRef.current = L.heatLayer(
          heatPoints,
          toLeafletOptions(HEAT_CONFIG, maxIntensity),
        ).addTo(layerGroup)
      }
      addHeatLayerWhenSized(20)
    } else {
      const latLngs = DEMO_POINTS.map((p) => [p.lat, p.lng] as [number, number])
      map.fitBounds(L.latLngBounds(latLngs), { padding: [64, 64] })

      // The demo route is a ROUTE between recognised places, not a density
      // reading, so it takes the place accent (jade) rather than the heat
      // amber — amber is reserved for magnitude everywhere in the product.
      // Soft blurred glow line beneath the crisp dashed line, for depth.
      L.polyline(latLngs, {
        color: '#25c79c',
        weight: 10,
        opacity: 0.22,
        className: 'trail-route-glow',
      }).addTo(layerGroup)

      L.polyline(latLngs, {
        color: '#5fdcb9',
        weight: 2.5,
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

    return () => {
      cancelled = true
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

    // Pin colour encodes TIME SPENT, on one hue, ranked against the top
    // place. Previously each district drew from a rotating rainbow, which
    // looked like a legend the reader had to learn and meant nothing on its
    // own — mint vs pink said only "different district", never "more of your
    // life". Intensity on a single hue says the thing that matters, and the
    // districts screen uses the identical scale so the two agree.
    const topDuration = shown[0]?.totalDurationSec || 1

    shown.forEach((place, index) => {
      const color = districtShade(place.totalDurationSec / topDuration)

      // Only the top few pins carry a visible name; the rest are bare dots
      // whose name is one hover away. A coordinate pair is a placeholder for
      // a name we don't have yet (geocoding still running, or it failed), so
      // it goes in the tooltip but never on the map as a chip.
      const hasRealName = !/^-?\d+\.\d+, -?\d+\.\d+$/.test(place.displayName)
      const pinLabel = index < MAX_LABELLED_PINS && hasRealName ? place.displayName : null

      L.marker([place.lat, place.lng], {
        icon: createPlaceIcon(index + 1, color, pinLabel),
        // Higher-ranked pins sit above lower ones, so the most important
        // label is never the one hidden underneath.
        zIndexOffset: (MAX_PLACE_MARKERS - index) * 10,
      })
        .addTo(placesLayer)
        .bindTooltip(
          `#${index + 1} ${place.displayName} · ${place.visitCount} візитів · ${formatVisitDuration(place.totalDurationSec)}`,
          { direction: 'top', offset: [0, -12] },
        )
    })
  }, [places])

  return <div ref={containerRef} className="h-full w-full" />
}
