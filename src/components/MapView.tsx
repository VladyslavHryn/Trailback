import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '../map/registerLeafletHeat'
import type { ParsedPoints } from '../parsing/types'
import type { DisplayPlace } from '../analytics/placeInsights'
import { assignDistrictColors } from '../analytics/placeInsights'
import { aggregateHeatmapPoints } from '../map/aggregateHeatmapPoints'

const MAX_PLACE_MARKERS = 8

// Only the strongest few pins get a written label. Every pin carrying its
// name is how a map turns into a wall of overlapping chips the moment two
// places sit in the same neighbourhood — which, for a personal history, is
// most of them. The rest stay as dots and reveal their name on hover.
const MAX_LABELLED_PINS = 4

// Plain hex, not a CSS var: it's interpolated into inline `--pin`, and the
// pin's glow feeds it through color-mix(), which needs a real color value.
const DEFAULT_PLACE_COLOR = '#25c79c'

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

// Fraction of the peak cell intensity that counts as "fully hot". Below 1 so
// the top of the colour ramp is actually reachable — see the `max` option.
const HEAT_PEAK_HEADROOM = 0.8

/**
 * Heat blob size for the CURRENT zoom, derived from the aggregation grid's
 * spacing rather than hard-coded.
 *
 * The grid spacing is fixed in degrees while leaflet.heat's radius is in
 * screen pixels, so projecting one cell at the current zoom converts between
 * the two and keeps neighbouring blobs at a roughly constant overlap as the
 * reader zooms. The 1.15 factor leaves them just touching: enough to read as
 * continuous where the data is continuous, without stacking many deep.
 *
 * Worth knowing how much this actually does, since it looks like it does
 * more: for a history confined to one city the grid is only a few metres
 * across, which projects to 1-3px at any normal zoom, so the result sits on
 * the lower clamp and behaves like a fixed radius. It earns its keep at the
 * other end — a history spanning a country has kilometre-wide cells, where a
 * fixed small radius would scatter the map with disconnected specks. What
 * prevents saturation in the city case is the intensity normalisation and
 * the gradient ramp, not this.
 *
 * The clamps are legibility bounds: below ~7px a blob is a speck, and past
 * ~44px it smears neighbouring places into one another.
 */
export function heatRadiusFor(
  map: Pick<L.Map, 'getCenter' | 'project'>,
  cellSizeDeg: number,
): { radius: number; blur: number } {
  const center = map.getCenter()
  const a = map.project([center.lat, center.lng])
  const b = map.project([center.lat + cellSizeDeg, center.lng])
  const cellPx = Math.abs(b.y - a.y)

  const radius = Math.min(44, Math.max(7, cellPx * 1.15))
  // Blur slightly wider than the radius is what gives each blob a soft
  // shoulder instead of a hard disc edge.
  return { radius, blur: radius * 1.35 }
}

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
  /** Live `zoomend` handler for the heat layer, so it can be detached when
   * the layer it belongs to is torn down and replaced. */
  const heatSyncRef = useRef<(() => void) | null>(null)

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

    // Detach the previous heat layer's zoom handler before dropping the
    // layer itself — otherwise every re-run leaks another listener that
    // resizes a layer no longer on the map.
    if (heatSyncRef.current) {
      map.off('zoomend', heatSyncRef.current)
      heatSyncRef.current = null
    }
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
      const {
        points: heatPoints,
        maxIntensity,
        cellSizeDeg,
      } = aggregateHeatmapPoints(points)

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

        const heatLayer = L.heatLayer(heatPoints, {
          ...heatRadiusFor(map, cellSizeDeg),
          // Normalising against slightly BELOW the peak cell, so the densest
          // places actually reach the top of the gradient. Using the exact
          // peak leaves the ramp's brightest stops unreachable — leaflet.heat
          // re-bins the points into its own grid before normalising, so the
          // busiest cell lands short of 1.0 and the "hot core" never gets
          // hot. Measured: the core topped out around two-thirds opacity at
          // 1.0, which reads as a smudge rather than a focal point.
          max: maxIntensity * HEAT_PEAK_HEADROOM,
          // A low floor matters as much as the ramp below: leaflet.heat
          // clamps everything it draws to at least this alpha, so a high
          // minOpacity (the old 0.25) gives every faintly-visited cell a
          // visible flat wash and erases the difference between "passed
          // through once" and "passed through often".
          minOpacity: 0.08,
          // Heat intensity is a MAGNITUDE (how often you were here), so this
          // is a sequential scale — one hue ramped in lightness — not a
          // blend of two hues. Crossing from teal to orange mid-ramp looked
          // like a muddy brown stain where they met (RGB-interpolating
          // between near-complementary hues desaturates instead of blending
          // cleanly).
          //
          // The stop SPACING is what produces density falloff rather than a
          // flat slab of colour. Most of the range is spent climbing
          // through transparency in a dark copper, so sparse areas read as
          // a faint stain; only the top fifth reaches full opacity, and only
          // the very peak reaches the pale core. The previous ramp hit
          // fully-opaque orange at 0.65 and had nothing left to say above
          // it, which is why every moderately-visited street rendered as
          // the same solid stroke.
          gradient: {
            0.0: 'rgba(120, 53, 15, 0)',
            0.16: 'rgba(146, 64, 14, 0.26)',
            0.32: 'rgba(180, 83, 9, 0.5)',
            0.5: 'rgba(217, 119, 6, 0.72)',
            0.66: 'rgba(245, 158, 11, 0.87)',
            0.82: 'rgba(251, 191, 36, 0.95)',
            1.0: 'rgba(254, 243, 199, 1)',
          },
        }).addTo(layerGroup)

        // Re-derive the radius whenever the zoom changes, so the blob size
        // keeps tracking the grid spacing instead of drifting away from it.
        // See heatRadiusFor for how much this is really worth at city scale
        // (little — it sits on the clamp) versus country scale (a lot).
        const syncRadius = () => heatLayer.setOptions(heatRadiusFor(map, cellSizeDeg))
        map.on('zoomend', syncRadius)
        heatSyncRef.current = syncRadius
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
