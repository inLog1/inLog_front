import { getLiveApiBaseUrl } from '../../shared/config/runtime'

const ASSET_DESTINATIONS = new Set([
  'document',
  'script',
  'style',
  'image',
  'font',
  'manifest',
  'audio',
  'video',
  'track',
])

export type OutboundDecision = 'gap' | 'block' | 'passthrough'

export function matchesLiveApi(url: URL, liveBase: string): boolean {
  try {
    const base = new URL(liveBase)
    if (url.origin !== base.origin) return false
    const basePath = base.pathname.endsWith('/') ? base.pathname : `${base.pathname}/`
    const path = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`
    if (basePath === '/') return true
    return path.startsWith(basePath)
  } catch {
    return false
  }
}

function isAppModule(url: URL): boolean {
  return url.pathname.startsWith('/@')
    || url.pathname.startsWith('/src/')
    || url.pathname.startsWith('/node_modules/')
    || url.pathname.startsWith('/__vite')
}

export function classifyMockTraffic(input: {
  url: URL
  destination: string
  liveApiBase: string
  appOrigin: string | null
}): OutboundDecision {
  const { url, destination, liveApiBase, appOrigin } = input
  if (url.pathname === '/mock-api' || url.pathname.startsWith('/mock-api/')) return 'gap'
  if (url.protocol === 'ws:' || url.protocol === 'wss:') return 'passthrough'
  if (matchesLiveApi(url, liveApiBase)) return 'block'
  if (ASSET_DESTINATIONS.has(destination) || isAppModule(url)) return 'passthrough'
  if (appOrigin && url.origin === appOrigin) return 'passthrough'
  if (destination === '' || destination === 'empty') return 'block'
  return 'passthrough'
}

function appOriginFromRuntime(): string | null {
  if (typeof location === 'undefined' || !location.origin) return null
  return location.origin
}

export function guardOutboundRequest(
  request: Request,
  options?: { liveApiBase?: string; appOrigin?: string | null },
): Response | null {
  const url = new URL(request.url)
  const decision = classifyMockTraffic({
    url,
    destination: request.destination,
    liveApiBase: options?.liveApiBase ?? getLiveApiBaseUrl(),
    appOrigin: options && 'appOrigin' in options ? options.appOrigin ?? null : appOriginFromRuntime(),
  })
  if (decision === 'passthrough') return null
  const code = decision === 'gap' ? 'mock_coverage_gap' : 'mock_upstream_blocked'
  return Response.json({
    code,
    detail: decision === 'gap'
      ? `No mock handler for ${request.method} ${url.pathname}`
      : 'Mock mode blocked an absolute API request before it left the browser.',
  }, { status: 501 })
}
