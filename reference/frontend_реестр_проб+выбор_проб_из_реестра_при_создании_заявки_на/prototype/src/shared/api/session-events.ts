export type LogoutReason = 'user' | 'expired' | 'switch' | 'preset' | 'reset'

export type LogoutRequest = {
  reason: LogoutReason
  callApi?: boolean
  navigate?: boolean
}

type LogoutHandler = (request: LogoutRequest) => Promise<void>

let handler: LogoutHandler | null = null
let inFlight: Promise<void> | null = null

export function registerLogoutHandler(next: LogoutHandler) {
  handler = next
}

export function requestLogout(request: LogoutRequest): Promise<void> {
  if (!handler) return Promise.resolve()
  if (request.reason === 'expired' && inFlight) return inFlight
  const run = handler(request).finally(() => {
    if (inFlight === run) inFlight = null
  })
  inFlight = run
  return run
}
