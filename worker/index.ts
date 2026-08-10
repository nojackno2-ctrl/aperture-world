/** Cloudflare Worker entry point for Aperture World. */
import handler from "vinext/server/app-router-entry";
import { withSecurityHeaders } from "./security.mjs";

type HandlerFetch = typeof handler.fetch;

const worker = {
  async fetch(
    request: Parameters<HandlerFetch>[0],
    env: Parameters<HandlerFetch>[1],
    ctx: Parameters<HandlerFetch>[2],
  ): Promise<Response> {
    const response = await handler.fetch(request, env, ctx);
    return withSecurityHeaders(response);
  },
} satisfies { fetch: HandlerFetch };

export default worker;
