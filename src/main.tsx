import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Leaflet's stylesheet FIRST, then ours. Order matters and is easy to get
// wrong: when leaflet.css was imported down in MapView it landed after
// index.css in the bundle, so Leaflet's own `.leaflet-container {
// background: #ddd }` beat our dark override on equal specificity — the map
// rendered as a light grey box wherever a tile hadn't painted over it.
// Pinning both imports here, in load order, keeps our overrides last no
// matter which component happens to pull Leaflet in.
import 'leaflet/dist/leaflet.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
