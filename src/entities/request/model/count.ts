type PartyRow = {
  customerOrganizationId: number
  executorOrganizationId: number
}

type LegacyRow = {
  organizationId: number
}

/**
 * Corporate card total.
 * Once the request collection is stored, it is the only source.
 * The older single-organization list is used only while that collection is absent.
 */
export function organizationRequestTotal(
  requests: readonly PartyRow[] | null | undefined,
  legacy: readonly LegacyRow[] | null | undefined,
  organizationId: number,
): number {
  if (requests) {
    return requests.filter((item) =>
      item.customerOrganizationId === organizationId || item.executorOrganizationId === organizationId,
    ).length
  }
  return (legacy ?? []).filter((item) => item.organizationId === organizationId).length
}
