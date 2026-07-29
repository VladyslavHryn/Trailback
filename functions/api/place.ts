import type { EventContext } from '@cloudflare/workers-types';
import { handlePlaceRequest } from '../../server/handler.js';

interface Env {
  FOURSQUARE_API_KEY?: string;
}

export async function onRequestGet(context: EventContext<Env, any, any>): Promise<Response> {
  return handlePlaceRequest(context.request as any, {
    FOURSQUARE_API_KEY: context.env.FOURSQUARE_API_KEY,
  }) as any;
}
