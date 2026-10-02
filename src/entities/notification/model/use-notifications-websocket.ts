import { useEffect, useRef } from 'react'
import { useDispatch } from 'react-redux'
import type { AppDispatch } from '../../../app/store/store'
import { useAccessToken } from '../../../shared/api/auth-session'
import { notificationApi } from './notificationSlice'
import type { Notification } from './types'
import { getNotificationsWsUrl } from '../lib/get-notifications-ws-url'

const RECONNECT_DELAY_MS = 5000

export function useNotificationsWebSocket(enabled = true) {
  const dispatch = useDispatch<AppDispatch>()
  const token = useAccessToken()
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!enabled || !token) return

    let cancelled = false

    const connect = () => {
      if (cancelled || wsRef.current?.readyState === WebSocket.OPEN) return

      const ws = new WebSocket(getNotificationsWsUrl(token))
      wsRef.current = ws

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as Notification
          if (!message || message.is_deleted || message.deleted) return

          dispatch(
            notificationApi.util.updateQueryData('getNotifications', undefined, (draft) => {
              const existingIndex = draft.findIndex((item) => item.id === message.id)
              if (existingIndex >= 0) {
                draft[existingIndex] = message
                return
              }

              draft.unshift(message)
            })
          )
        } catch {
          // Ignore malformed websocket payloads.
        }
      }

      ws.onclose = () => {
        wsRef.current = null
        if (!cancelled) {
          reconnectTimeoutRef.current = setTimeout(connect, RECONNECT_DELAY_MS)
        }
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()

    return () => {
      cancelled = true
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }

      wsRef.current?.close()
      wsRef.current = null
    }
  }, [dispatch, enabled, token])
}
