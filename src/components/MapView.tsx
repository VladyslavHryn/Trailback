import { useCallback, useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import '../map/registerLeafletHeat'
import type { ParsedPoints } from '../parsing/types'
import { movementPoints } from '../parsing/selectPoints'
import type { DisplayPlace } from '../analytics/placeInsights'
import { districtShade } from '../analytics/placeInsights'
import { formatDecimal } from './story/format'
import {
  aggregateHeatmapPoints,
  computeHeatScale,
  type HeatScale,
} from '../map/aggregateHeatmapPoints'
import { buildRoutes } from '../map/buildRoutes'
import { robustBounds } from '../map/robustBounds'
import { selectVisibleLabels } from '../map/labelCollision'
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

/**
 * The product's place pin: a small luminous dot on the coordinate, with an
 * optional name chip beside it.
 *
 * Exported so the landing page's preview map draws pins with the SAME markup
 * and the same CSS as the real results map. A visual copy would drift the
 * first time either side is touched, and the preview's whole job is to be an
 * honest sample of what the product produces.
 *
 * `rank` is optional: the results map numbers its top places, while the
 * preview is naming one or two landmarks where a rank would be meaningless.
 */
export function createPlaceIcon(
  rank: number | null,
  color: string,
  label: string | null,
) {
  const rankHtml =
    rank === null
      ? ''
      : `<span class="trail-pin__rank">${String(rank).padStart(2, '0')}</span>`

  const labelHtml = label
    ? `<span class="trail-pin__label">
         ${rankHtml}
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
  if (hours >= 1) return `${formatDecimal(hours)} год`
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

// Standard OSM tiles, used only if CARTO can't be reached. One CDN is a
// single point of failure for the entire map, and its failure mode is the
// worst one available: tiles simply never arrive, leaving an empty coloured
// rectangle with no error and nothing to act on. OSM's own tile servers are
// a different origin entirely, so a block or outage on one rarely takes the
// other with it.
//
// These tiles are light, which would wreck a dark UI, so the fallback pane
// is inverted in CSS (`.trail-fallback-tiles`) — the standard trick for
// getting a dark basemap out of light raster tiles.
const FALLBACK_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const FALLBACK_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

/** Pane for the label tiles: above the basemap, below the heat/marker data. */
const LABELS_PANE = 'trailLabels'
/** Pane for the fallback basemap, so it can be inverted without touching
 * anything drawn on top of it. */
const FALLBACK_PANE = 'trailFallbackTiles'

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

/**
 * Which reading of the same history the map is showing. These are three
 * genuinely different questions — where time piled up, which places those
 * were, and how you moved between them — so they're modes rather than
 * layers stacked together: drawing all three at once would put pins and
 * strokes over exactly the bright cores they sit on and make each harder to
 * read than it is alone.
 */
export type MapLayer = 'heat' | 'places' | 'routes'

type MapViewProps = {
  points?: ParsedPoints
  places?: DisplayPlace[]
  layer?: MapLayer
  /**
   * The colour scale to draw the heatmap against, derived from the FULL
   * history rather than from `points`. Passing it in is what makes periods
   * comparable — see HeatScale. Optional so the map still works standalone
   * (the landing page's demo); it then falls back to scaling `points`
   * against themselves, which is correct when they are the whole history.
   */
  heatScale?: HeatScale
  /**
   * Off inside the scroll-story: a full-height map that captures the wheel
   * would swallow the page scroll and trap the reader on that screen, with
   * no way to continue. Zoom stays available via the +/- controls and
   * double-click, so nothing is actually lost.
   */
  scrollWheelZoom?: boolean
}

export function MapView({
  points,
  places,
  layer = 'heat',
  heatScale,
  scrollWheelZoom = true,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerGroupRef = useRef<L.LayerGroup | null>(null)
  const placesLayerRef = useRef<L.LayerGroup | null>(null)

  // Drives the disabled state of the zoom buttons below, so neither of them is
  // ever a control that looks live and does nothing at the ends of the range.
  const [zoomState, setZoomState] = useState({ canIn: true, canOut: true })

  const heatLayerRef = useRef<L.HeatLayer | null>(null)
  /** The points object the view was last fitted to — see the refit guard. */
  const fittedPointsRef = useRef<ParsedPoints | null>(null)

  // Mount the map + base tiles once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    // A Leaflet map with no view is not merely empty — it is BROKEN. It
    // requests no tiles, refuses to add layers, and throws "Set map center
    // and zoom first" the moment anything calls getCenter(), which a drag
    // does. Giving it a neutral world view at construction means the map is
    // always in a valid state; fitBounds then moves it to the real data a
    // moment later. Cheap insurance against a failure mode whose symptom
    // (an empty black rectangle) points nowhere near its cause.
    // NO built-in zoomControl — see the ZoomButtons overlay at the bottom of
    // this file for the whole reason, which is a page-scroll bug rather than a
    // matter of taste.
    const map = L.map(containerRef.current, {
      zoomControl: false,
      scrollWheelZoom,
      center: [48.4, 31.2],
      zoom: 5,
    })

    // This map instance has never been fitted, whatever a previous one did.
    // The guard below is keyed on the points object, and that ref OUTLIVES
    // the map: on a remount with the same points (React's development
    // double-mount, or any re-created map) it would report "already fitted"
    // for a map that had never had a view set at all, and leave it in the
    // broken state described above.
    fittedPointsRef.current = null

    const baseTiles = L.tileLayer(TILE_URL, {
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
    const labelTiles = L.tileLayer(LABEL_TILE_URL, {
      subdomains: 'abcd',
      maxZoom: 20,
      pane: LABELS_PANE,
    }).addTo(map)

    // Swap to the fallback source the first time a base tile fails to load.
    // Guarded so a handful of failing tiles can't tear the layer down
    // repeatedly, and the labels layer goes with it — its tiles come from
    // the same host, so if the base is unreachable the labels are too, and
    // leaving it would keep retrying requests that can't succeed.
    let usedFallback = false
    baseTiles.on('tileerror', () => {
      if (usedFallback) return
      usedFallback = true

      map.removeLayer(baseTiles)
      map.removeLayer(labelTiles)

      const fallbackPane = map.createPane(FALLBACK_PANE)
      fallbackPane.style.zIndex = '200'
      fallbackPane.classList.add('trail-fallback-tiles')
      L.tileLayer(FALLBACK_TILE_URL, {
        attribution: FALLBACK_ATTRIBUTION,
        maxZoom: 19,
        pane: FALLBACK_PANE,
      }).addTo(map)
    })

    mapRef.current = map

    const syncZoomState = () => {
      setZoomState({
        canIn: map.getZoom() < map.getMaxZoom(),
        canOut: map.getZoom() > map.getMinZoom(),
      })
    }
    syncZoomState()
    // `zoomlevelschange` matters as much as `zoomend`: adding the fallback tile
    // layer changes maxZoom (19 vs 20), which moves the end of the range under
    // the buttons without the zoom itself changing.
    map.on('zoomend zoomlevelschange', syncZoomState)

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
      map.off('zoomend zoomlevelschange', syncZoomState)
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
    // re-runs (new points, a range change, or React's development
    // double-mount) the pending callback from the previous run still fires,
    // builds a heat layer and adds it to a group that has already been
    // removed from the map — leaving an orphaned layer behind.
    let cancelled = false

    // The heat layer belongs to the group being dropped, so clear the ref
    // with it rather than leaving a pointer to a detached layer.
    heatLayerRef.current = null
    layerGroupRef.current?.remove()
    const layerGroup = L.layerGroup().addTo(map)
    layerGroupRef.current = layerGroup

    if (points && points.lat.length > 0) {

      // Where nearly all of the history is, NOT its full extent — see
      // robustBounds for the measurement showing why a true bounding box is
      // the wrong opening frame (three stray points out of 27,000 dropped the
      // view from Kyiv at zoom 14 to half of Europe at zoom 5, taking the
      // heatmap and the route with it).
      const bounds = robustBounds(points)

      // Only refit when the DATA changed, never on a layer toggle. Switching
      // between heat and routes is a change of reading, not of subject: if
      // the reader has zoomed into their neighbourhood, throwing them back
      // out because they pressed a different tab loses the position they
      // were studying.
      if (bounds && fittedPointsRef.current !== points) {
        fittedPointsRef.current = points
        map.fitBounds(
          [
            [bounds.minLat, bounds.minLng],
            [bounds.maxLat, bounds.maxLng],
          ],
          { padding: [32, 32] },
        )
      }

      if (layer === 'heat') {
        // The whole-history heatmap is the actual differentiator over Google
        // (which only ever shows one day at a time) — see
        // aggregateHeatmapPoints for why raw pings are grid-aggregated first
        // rather than fed to the heat layer directly or just downsampled.
        //
        // MOVEMENT POINTS ONLY. A visit is expanded into many samples at one
        // coordinate so the stay detector can measure it, which is right for
        // that job and ruinous here: dozens of identical coordinates land in
        // a single grid cell and burn it to the top of the scale, so a map
        // meant to show where a life was spent turned into one blazing dot
        // per visit with the actual movement invisible around it.
        const track = movementPoints(points)
        const { points: heatPoints } = aggregateHeatmapPoints(
          track,
          heatScale ?? computeHeatScale(track),
        )

        // Belt-and-suspenders on top of the invalidateSize()/ResizeObserver
        // in the mount effect: if the container still measures 0x0 at this
        // exact instant, leaflet.heat's canvas throws IndexSizeError instead
        // of just rendering nothing. Retrying a beat later rather than
        // crashing the whole map view is worth a little duplication here.
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
            toLeafletOptions(HEAT_CONFIG),
          ).addTo(layerGroup)
        }
        addHeatLayerWhenSized(20)
      }

      if (layer === 'routes') {
        // Thin, low-opacity strokes on a canvas renderer. Thin because the
        // information here is the SHAPE of the network and where strokes
        // overlap — a heavy line would merge neighbouring streets into one
        // blob and destroy exactly that; low-opacity because overlapping
        // passes then accumulate, so a commute driven three hundred times
        // reads brighter than a road taken once, for free.
        // Same reason as the heatmap: a run of identical visit samples draws
        // as a stationary knot in the middle of a path that never stopped.
        // AMBER, and drawn TWICE. Jade sat in the same hue family CARTO's
        // dark basemap uses for water and parks, so a 1.1px jade hairline at
        // 32% dissolved into the tiles it was drawn over — barely visible
        // even where the reader had walked hundreds of times.
        //
        // Two passes on two renderers, so every wide stroke is under every
        // thin one: a broad dim pass that pools into a glow wherever paths
        // run together, and a narrow bright core that keeps a single street
        // legible. Canvas can't blur, so the bloom comes from width and
        // accumulation rather than a filter — which is also what makes
        // frequency readable, since overlapping passes stack while a road
        // taken once stays faint.
        const glowRenderer = L.canvas({ padding: 0.4 })
        const coreRenderer = L.canvas({ padding: 0.4 })
        const segments = buildRoutes(movementPoints(points))

        for (const segment of segments) {
          L.polyline(segment, {
            renderer: glowRenderer,
            color: '#d97706',
            weight: 7,
            opacity: 0.09,
            lineCap: 'round',
            lineJoin: 'round',
            interactive: false,
          }).addTo(layerGroup)
        }

        for (const segment of segments) {
          L.polyline(segment, {
            renderer: coreRenderer,
            color: '#fbbf24',
            weight: 1.4,
            opacity: 0.5,
            lineCap: 'round',
            lineJoin: 'round',
            interactive: false,
          }).addTo(layerGroup)
        }
      }
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
  }, [points, layer, heatScale])

  // Place markers live in their own layer/effect, separate from the
  // heatmap — analytics finishes well after the heatmap is already showing
  // (it's a heavier, worker-side computation), so this shouldn't force a
  // re-draw of the heatmap layer when results arrive.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    placesLayerRef.current?.remove()
    if (layer !== 'places' || !places || places.length === 0) {
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

    // COLLISION PASS. Pins are placed by geography, so nothing stops two of
    // them landing on top of each other — and when they do, their name chips
    // overlap into an unreadable pile. Capping the number of labels doesn't
    // help: four labels collide just as badly if the four places are on the
    // same street.
    //
    // Runs after layout (labels have to exist to be measured) and again on
    // every zoom or pan, because which labels fit is a property of the
    // CURRENT view, not of the data.
    const resolveCollisions = () => {
      const labelled = placesLayer
        .getLayers()
        .map((l) => (l as L.Marker).getElement()?.querySelector('.trail-pin__label'))
        .filter((el): el is HTMLElement => el instanceof HTMLElement)

      // Measure everything unhidden first, or a label suppressed by the last
      // pass would measure as zero-size and never come back when there is
      // room for it again.
      labelled.forEach((el) => el.classList.remove('trail-pin__label--hidden'))
      const boxes = labelled.map((el) => el.getBoundingClientRect())
      selectVisibleLabels(boxes).forEach((keep, i) => {
        if (!keep) labelled[i].classList.add('trail-pin__label--hidden')
      })
    }

    // The markers are in the DOM synchronously, but their transforms settle a
    // frame later; measuring immediately reads stale positions.
    const timer = setTimeout(resolveCollisions, 60)
    map.on('zoomend moveend', resolveCollisions)

    return () => {
      clearTimeout(timer)
      map.off('zoomend moveend', resolveCollisions)
    }
  }, [places, layer])

  const zoomIn = useCallback(() => mapRef.current?.zoomIn(), [])
  const zoomOut = useCallback(() => mapRef.current?.zoomOut(), [])

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      <ZoomButtons
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        canZoomIn={zoomState.canIn}
        canZoomOut={zoomState.canOut}
      />
    </div>
  )
}

/**
 * The map's own zoom control, replacing Leaflet's.
 *
 * WHY NOT LEAFLET'S. Its ZoomControl binds `_refocusOnMap` to the button's
 * click, which calls `.focus()` on the map container — and Leaflet gives that
 * container `tabindex="0"` for keyboard panning, so the browser scrolls it into
 * view. Inside a scroll story where the map IS a full-viewport section, that
 * means every press of + or − yanked the page down to align the section, and
 * `scroll-behavior: smooth` animated the yank. Measured: scrollY 524 → 900 on a
 * single click, a 376px jump nobody asked for, after which the reader had to
 * scroll back up to press the button again.
 *
 * There is no option to turn that off, and suppressing it means overwriting a
 * private method. Plain buttons outside the Leaflet DOM cannot do it at all,
 * which is the difference between fixing the bug and disabling its symptom.
 *
 * Placed on the RIGHT EDGE, VERTICALLY CENTRED. Two separate constraints meet
 * here. The left axis is out because the section's caption, headline and layer
 * switcher all live there — Leaflet's default top-left put the only two buttons
 * on the screen underneath the text. And the map is a FULL-VIEWPORT section, so
 * anchoring to its top or bottom edge puts the buttons off-screen for most of
 * the section's scroll: pinned to the bottom they measured 1212px down a 900px
 * viewport, i.e. not reachable at all without scrolling first. Centring on a
 * one-viewport-tall element keeps them within the viewport for as long as the
 * map meaningfully occupies it — the same problem the caption solves by being
 * sticky.
 */
function ZoomButtons({
  onZoomIn,
  onZoomOut,
  canZoomIn,
  canZoomOut,
}: {
  onZoomIn: () => void
  onZoomOut: () => void
  canZoomIn: boolean
  canZoomOut: boolean
}) {
  // z-900 clears Leaflet's panes (which top out at 700) and the section's
  // bottom scrim, while staying under the sticky caption (800) and the fixed
  // header (1100) — nothing here should ever paint over the chrome.
  return (
    <div className="absolute right-6 top-1/2 z-[900] flex -translate-y-1/2 flex-col gap-1.5 md:right-10">
      <ZoomButton label="Збільшити" onClick={onZoomIn} disabled={!canZoomIn}>
        +
      </ZoomButton>
      <ZoomButton label="Зменшити" onClick={onZoomOut} disabled={!canZoomOut}>
        −
      </ZoomButton>
    </div>
  )
}

function ZoomButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-700 bg-ink-950/80 font-mono text-base leading-none text-ink-200 backdrop-blur-sm transition-colors hover:border-trail-500/60 hover:text-trail-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trail-300 disabled:pointer-events-none disabled:opacity-35"
    >
      {children}
    </button>
  )
}
