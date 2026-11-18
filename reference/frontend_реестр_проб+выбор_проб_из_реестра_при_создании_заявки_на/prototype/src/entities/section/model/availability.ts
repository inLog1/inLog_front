/**
 * Section endpoints are a proposed mock contract.
 * Live mode does not call them and does not treat a network error as "not implemented".
 */
export function sectionsMode(apiMode: string | undefined): 'mock' | 'unavailable' {
  return apiMode === 'mock' ? 'mock' : 'unavailable'
}
