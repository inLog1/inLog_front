import { getApiMode } from '../../../shared/config/runtime'

export function personnelMode(mode: string | undefined = getApiMode()): 'mock' | 'unavailable' {
  return mode === 'mock' ? 'mock' : 'unavailable'
}
