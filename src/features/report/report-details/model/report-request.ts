export function reportResponseIsCurrent(
  request: { organizationId: number; serial: number },
  current: { organizationId: number; serial: number },
): boolean {
  return request.organizationId === current.organizationId && request.serial === current.serial
}
