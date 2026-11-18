/**
 * Sample endpoints are a proposed mock contract.
 * Live mode has no sample backend. A caller must stop at this boundary
 * and must not treat a network error as an empty registry.
 */
export function samplesMode(apiMode: string | undefined): 'mock' | 'unavailable' {
  return apiMode === 'mock' ? 'mock' : 'unavailable'
}
