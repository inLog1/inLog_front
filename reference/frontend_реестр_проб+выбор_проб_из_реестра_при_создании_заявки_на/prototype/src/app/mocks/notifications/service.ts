import { principal, toLegacyUser, type FlowResult } from '../auth/flow'
import type { MockNotificationRecord, MockState } from '../db/types'

function done(state: MockState, status: number, body: unknown): FlowResult {
  return { state, status, body }
}

function notificationDto(state: MockState, item: MockNotificationRecord) {
  const user = state.users.find((entry) => entry.id === item.userId)
  return {
    id: item.id,
    type: item.type,
    is_read: item.isRead,
    is_deleted: item.isDeleted,
    deleted: item.isDeleted,
    data: item.data,
    created_at: item.createdAt,
    receiver: user ? toLegacyUser(user) : { id: item.userId, email: '' },
  }
}

export function listNotifications(state: MockState, token: string | null): FlowResult {
  const who = principal(state, token)
  if (!who.ok) return who.result
  const items = state.notifications
    .filter((item) => item.userId === who.user.id && !item.isDeleted)
    .map((item) => notificationDto(state, item))
  return done(state, 200, items)
}

export function updateNotification(state: MockState, token: string | null, id: number, body: Record<string, unknown>): FlowResult {
  const who = principal(state, token)
  if (!who.ok) return who.result
  const current = state.notifications.find((item) => item.id === id && item.userId === who.user.id && !item.isDeleted)
  if (!current) return done(state, 404, { code: 'not_found' })
  if ('is_read' in body && typeof body.is_read !== 'boolean') return done(state, 400, { code: 'invalid_notification' })
  const nextItem: MockNotificationRecord = {
    ...current,
    isRead: typeof body.is_read === 'boolean' ? body.is_read : current.isRead,
  }
  const next: MockState = {
    ...state,
    notifications: state.notifications.map((item) => item.id === nextItem.id ? nextItem : item),
  }
  return done(next, 200, notificationDto(next, nextItem))
}

export function deleteNotification(state: MockState, token: string | null, id: number): FlowResult {
  const who = principal(state, token)
  if (!who.ok) return who.result
  const current = state.notifications.find((item) => item.id === id && item.userId === who.user.id && !item.isDeleted)
  if (!current) return done(state, 404, { code: 'not_found' })
  const next: MockState = {
    ...state,
    notifications: state.notifications.map((item) => item.id === current.id ? { ...item, isDeleted: true } : item),
  }
  return done(next, 204, null)
}
