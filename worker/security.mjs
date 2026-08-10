/**
 * Low-risk response hardening that does not constrain React's streamed markup,
 * WebGL, dynamic scene imports, fonts, or the Fullscreen API.
 */
export const SECURITY_HEADERS = Object.freeze({
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
});

/** @param {Response} response */
export function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
