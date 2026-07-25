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

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, { zoomControl: true }).setView(
      [48.7, 31.5],
      6,
    )

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map)

    L.polyline(
      DEMO_POINTS.map((p) => [p.lat, p.lng]),
      {
        color: '#e8853a',
        weight: 3,
        opacity: 0.85,
        dashArray: '1 8',
        lineCap: 'round',
      },
    ).addTo(map)

    DEMO_POINTS.forEach((point) => {
      L.circleMarker([point.lat, point.lng], {
        radius: 7,
        color: '#e8853a',
        weight: 2,
        fillColor: '#12151a',
        fillOpacity: 1,
      })
        .addTo(map)
        .bindTooltip(point.label, { direction: 'top', offset: [0, -8] })
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  return <div ref={containerRef} className="h-full w-full" />
}
