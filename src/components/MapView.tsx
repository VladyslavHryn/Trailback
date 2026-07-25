import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Placeholder points until Step 2 wires up real Google Takeout parsing.
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

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, { zoomControl: true })

    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTRIBUTION,
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map)

    const latLngs = DEMO_POINTS.map((p) => [p.lat, p.lng] as [number, number])
    map.fitBounds(L.latLngBounds(latLngs), { padding: [64, 64] })

    // Soft blurred glow line beneath the crisp dashed line, for depth.
    L.polyline(latLngs, {
      color: '#e8853a',
      weight: 10,
      opacity: 0.25,
      className: 'trail-route-glow',
    }).addTo(map)

    L.polyline(latLngs, {
      color: '#f2a35e',
      weight: 3,
      opacity: 0.9,
      lineCap: 'round',
      className: 'trail-route-line',
    }).addTo(map)

    DEMO_POINTS.forEach((point) => {
      L.marker([point.lat, point.lng], { icon: createPulseIcon() })
        .addTo(map)
        .bindTooltip(point.label, { direction: 'top', offset: [0, -10] })
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  return <div ref={containerRef} className="h-full w-full" />
}
