import L from 'leaflet'

// leaflet.heat is an old UMD-style plugin written for a global `L` (as if
// loaded via a <script> tag) rather than an ES import — its code patches
// `L.heatLayer` onto whatever it finds as the global `L`. Bundlers don't
// set `window.L` just because something else does `import L from 'leaflet'`,
// so without this the plugin throws immediately on load. Importing this
// module (for its side effect) before calling `L.heatLayer(...)` fixes it.
;(window as unknown as { L: typeof L }).L = L

import 'leaflet.heat'
