import type { CorporateKind } from '../../../entities/personnel/model/overview'

const kindLabelKey = {
  laboratory: 'corporation.kind-laboratory',
  customer: 'corporation.kind-customer',
} as const

export function organizationKindLabelKey(kind: CorporateKind) {
  return kindLabelKey[kind]
}
