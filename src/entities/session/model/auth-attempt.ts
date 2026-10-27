import { writeSession } from '../../../shared/api/session-storage'

let attempt = 0

export function beginAuthAttempt(): number {
  attempt += 1
  return attempt
}

export function invalidateAuthAttempts(): void {
  attempt += 1
}

export function isCurrentAuthAttempt(ticket: number): boolean {
  return ticket === attempt
}

export function commitAccessSession(
  ticket: number,
  data: {
    access_token?: string | null
    refresh_token?: string | null
    user?: { id?: number | null } | null
  },
): boolean {
  if (!isCurrentAuthAttempt(ticket) || !data.access_token) return false
  writeSession({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    subjectId: typeof data.user?.id === 'number' ? data.user.id : null,
  })
  return true
}
