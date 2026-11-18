/** Decisions for leaving a dirty form screen. The hook applies them; it does not save. */

export function locationKey(parts: { pathname: string; search: string; hash: string }): string {
  return `${parts.pathname}${parts.search}${parts.hash}`
}

export function internalLinkTarget(input: {
  href: string | null
  target: string
  button: number
  modified: boolean
  defaultPrevented: boolean
  origin: string
  current: string
  base: string
}): string | null {
  if (input.defaultPrevented || input.button !== 0 || input.modified) return null
  if (input.target && input.target !== '_self') return null
  if (!input.href || input.href.startsWith('#')) return null
  const url = new URL(input.href, input.base)
  if (url.origin !== input.origin) return null
  const next = locationKey(url)
  if (next === input.current) return null
  if (isOrganizationSwitch(input.current, next)) return null
  return next
}

/** Same path, and the only search difference is the organization parameter. */
export function isOrganizationSwitch(current: string, next: string): boolean {
  const here = new URL(current, 'http://inlog.local')
  const there = new URL(next, 'http://inlog.local')
  if (here.pathname !== there.pathname || here.hash !== there.hash) return false
  const keys = new Set([...here.searchParams.keys(), ...there.searchParams.keys()])
  let orgChanged = false
  for (const key of keys) {
    if (here.searchParams.get(key) === there.searchParams.get(key)) continue
    if (key !== 'org') return false
    orgChanged = true
  }
  return orgChanged
}

export function historyIndex(state: unknown): number | null {
  if (!state || typeof state !== 'object' || !('idx' in state)) return null
  const idx = (state as { idx?: unknown }).idx
  return typeof idx === 'number' && Number.isInteger(idx) ? idx : null
}

export function historyHold(input: {
  active: boolean
  here: string
  destination: string
  hereIndex: number | null
  destinationIndex: number | null
}): { hold: false } | { hold: true; undo: number; prompt: string } {
  if (!input.active) return { hold: false }
  if (input.here === input.destination) return { hold: false }
  if (isOrganizationSwitch(input.here, input.destination)) return { hold: false }
  const undo = input.hereIndex != null && input.destinationIndex != null && input.hereIndex !== input.destinationIndex
    ? input.hereIndex - input.destinationIndex
    : 1
  if (undo === 0) return { hold: false }
  return { hold: true, undo, prompt: input.destination }
}

/**
 * What to do with one browser back/forward event.
 * `stop` means the router must not see it. Delivering the undo step
 * reloads the editor and drops both the dialog and the unsaved values.
 */
export function applyPopstate(input: {
  skipping: number
  active: boolean
  here: string
  destination: string
  hereIndex: number | null
  destinationIndex: number | null
}): { action: 'ignore'; skipping: number } | { action: 'stop'; skipping: number; undo?: number; prompt?: string } {
  if (input.skipping > 0) return { action: 'stop', skipping: input.skipping - 1 }
  const decision = historyHold(input)
  if (!decision.hold) return { action: 'ignore', skipping: input.skipping }
  return { action: 'stop', skipping: input.skipping + 1, undo: decision.undo, prompt: decision.prompt }
}

/** A save started earlier must not move the screen the user has since left. */
export function settleSavedLeave(input: {
  ticket: number
  currentTicket: number
  mounted: boolean
  saved: boolean
}): 'navigate' | 'remain' {
  if (!input.mounted || input.ticket !== input.currentTicket || !input.saved) return 'remain'
  return 'navigate'
}

/** The draft write always names the organization that was open when editing started. */
export function draftWriteTarget(
  lockedOrganizationId: number,
  formId: string,
  urlOrganizationId: number,
): { organizationId: number; formId: string } {
  void urlOrganizationId
  return { organizationId: lockedOrganizationId, formId }
}
