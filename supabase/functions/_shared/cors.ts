// Browsers may call these functions only from the app's own domains.
// Every response gets Access-Control-Allow-Origin for the caller's origin when it is
// allowed, and the primary domain otherwise (the browser then refuses the answer).
// Calls without an Origin header (server jobs, cron) are not affected.
export const PRIMARY_ORIGIN = 'https://www.limoxis.com'
const ALLOWED_ORIGINS = new Set([
  PRIMARY_ORIGIN,
  'https://limoxis.com',
  'https://limoxis-observer.netlify.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
])
// Netlify deploy previews and branch deploys: https://<name>--limoxis-observer.netlify.app
const PREVIEW_ORIGIN = /^https:\/\/[a-z0-9-]+--limoxis-observer\.netlify\.app$/

export function allowedOrigin(origin: string | null): string {
  if (origin && (ALLOWED_ORIGINS.has(origin) || PREVIEW_ORIGIN.test(origin))) return origin
  return PRIMARY_ORIGIN
}

export function serveWithCors(handler: (req: Request) => Response | Promise<Response>) {
  Deno.serve(async req => {
    const res = await handler(req)
    const headers = new Headers(res.headers)
    headers.set('Access-Control-Allow-Origin', allowedOrigin(req.headers.get('Origin')))
    headers.append('Vary', 'Origin')
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
  })
}
