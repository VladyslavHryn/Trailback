// Serverless entry for GET /api/place?lat=..&lng=..
//
// Vercel picks up files in /api with zero configuration, which is why it is the
// default here — the project had no backend at all before this, so the cheapest
// correct answer was the one that needs no deploy config to exist.
//
// PORTABILITY. All the logic is in ../server/handler.ts as a Web-standard
// Request -> Response function, so moving to Netlify Functions v2, Cloudflare
// Workers or Deno Deploy is a matter of re-exporting it from their entry file;
// nothing platform-specific lives below this line except the env lookup.
//
// THE KEY LIVES HERE AND NOWHERE ELSE. `FOURSQUARE_API_KEY` is read from the
// server environment. It is never returned in a response, never logged, and —
// critically — is NOT prefixed `VITE_`, because Vite inlines every `VITE_*`
// variable into the client bundle at build time. A key named `VITE_FOURSQUARE_...`
// would be published to every visitor, which is the exact failure this whole
// endpoint exists to prevent.

import { handlePlaceRequest } from '../server/handler.js'

export const config = { runtime: 'edge' }

export default function handler(request: Request): Promise<Response> {
  return handlePlaceRequest(request, {
    FOURSQUARE_API_KEY: process.env.FOURSQUARE_API_KEY,
  })
}
