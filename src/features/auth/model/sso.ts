import type { ApiMode } from '../../../shared/config/runtime'

export type SsoStart =
  | { kind: 'mock' }
  | { kind: 'live'; href: string }
  | { kind: 'unconfigured' }

export function resolveSsoStart(apiMode: ApiMode, configuredUrl: string | null): SsoStart {
  if (apiMode === 'mock') return { kind: 'mock' }
  if (configuredUrl) return { kind: 'live', href: configuredUrl }
  return { kind: 'unconfigured' }
}
