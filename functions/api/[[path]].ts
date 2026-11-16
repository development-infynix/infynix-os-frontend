/**
 * Cloudflare Pages Function: forwards every /api/* request to the backend.
 *
 * The browser only ever talks to the frontend's own address, so the sign-in
 * cookie the backend sets is first-party and is sent back on every request
 * (calling the backend's own domain directly would make it a cross-site
 * cookie, which browsers don't send). Vercel does the same with the rewrite
 * in vercel.json.
 *
 * Set API_ORIGIN in the Pages project to point at another backend.
 */
interface Context {
  request: Request
  env: { API_ORIGIN?: string }
}

const DEFAULT_API_ORIGIN = 'https://infynix-os-backend.stackshift.cloud'

export async function onRequest({ request, env }: Context): Promise<Response> {
  const incoming = new URL(request.url)
  const target = new URL(incoming.pathname + incoming.search, env.API_ORIGIN ?? DEFAULT_API_ORIGIN)
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD'

  // Method, headers (cookie, origin, content-type) and body pass through
  // unchanged; the backend's response, Set-Cookie included, comes straight back.
  return fetch(target, {
    method: request.method,
    headers: request.headers,
    body: hasBody ? request.body : undefined,
    redirect: 'manual',
  })
}
