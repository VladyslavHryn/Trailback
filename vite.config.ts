import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { handlePlaceRequest } from './server/handler.js'

/**
 * Serves /api/place in `npm run dev` using the SAME handler the deployed
 * serverless function uses.
 *
 * Vite's dev server knows nothing about /api, so without this the endpoint
 * would 404 locally and the client would fall back to Nominatim on every
 * lookup — meaning the Foursquare path was only ever exercised in production,
 * where it is hardest to debug and where mistakes cost money.
 *
 * The key is passed in rather than read from `process.env` here — see the
 * config below for why that distinction is the whole bug this fixes. It stays
 * in the Node process: nothing here reaches the browser bundle.
 */
function placeApiDevServer(apiKey: string | undefined): Plugin {
  return {
    name: 'trailback-place-api-dev',
    apply: 'serve',
    configureServer(server) {
      // A missing key is not an error — the handler degrades to Nominatim on
      // purpose — but it degrades SILENTLY, answering 200 with `{place:null}`
      // exactly like a genuine "no venue here". That is indistinguishable
      // from working, which is how an unconfigured key went unnoticed while
      // every lookup quietly skipped Foursquare. One line at startup makes
      // the difference visible.
      if (!apiKey) {
        server.config.logger.warn(
          '[trailback] FOURSQUARE_API_KEY is not set — /api/place will always ' +
            'return no venue and place names will come from Nominatim only. ' +
            'Copy .env.example to .env and fill the key in.',
        )
      }

      server.middlewares.use('/api/place', (req, res) => {
        // connect strips the mount path from req.url, so the query string is
        // rebuilt onto the route the handler expects.
        const search = new URL(req.url ?? '/', 'http://localhost').search
        const request = new Request(`http://localhost/api/place${search}`, {
          method: req.method ?? 'GET',
        })

        handlePlaceRequest(request, { FOURSQUARE_API_KEY: apiKey })
          .then(async (response) => {
            res.statusCode = response.status
            response.headers.forEach((value, key) => res.setHeader(key, value))
            res.end(await response.text())
          })
          .catch(() => {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ place: null }))
          })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  /**
   * THE KEY HAS TO BE LOADED EXPLICITLY. Vite reads .env files, but only to
   * populate `import.meta.env` for the CLIENT, and only for variables
   * prefixed `VITE_`. It never writes them into `process.env`. So a
   * deliberately unprefixed server-side secret — which is what keeps this key
   * out of the browser bundle — is invisible to the dev middleware, and
   * `process.env.FOURSQUARE_API_KEY` reads as undefined no matter what .env
   * contains.
   *
   * The failure mode was silent: the handler treats a missing key as "no
   * venue found" and answers 200, so the app looked healthy while every
   * lookup fell through to Nominatim and Foursquare recorded zero calls.
   *
   * `loadEnv(mode, cwd, '')` — the empty third argument is the point: it
   * disables the prefix filter, so unprefixed variables are returned too.
   * `process.env` is still consulted as a fallback, because that is where the
   * key comes from in CI and on the deployed platform, which have no .env
   * file at all.
   */
  const env = loadEnv(mode, process.cwd(), '')
  const foursquareKey = env.FOURSQUARE_API_KEY || process.env.FOURSQUARE_API_KEY

  return {
    plugins: [react(), tailwindcss(), placeApiDevServer(foursquareKey)],
    server: {
      port: Number(process.env.PORT) || 5173,
      strictPort: true,
    },
  }
})
