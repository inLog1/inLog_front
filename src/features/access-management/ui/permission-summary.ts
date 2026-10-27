import type { AccessGrantView } from '../../../entities/access'

export function permissionSummary(grants: readonly AccessGrantView[]): string {
  const codes = grants.map((grant) => `${grant.resource}.${grant.action}`)
  if (codes.length <= 4) return codes.join(', ')
  return `${codes.slice(0, 4).join(', ')} +${codes.length - 4}`
}
