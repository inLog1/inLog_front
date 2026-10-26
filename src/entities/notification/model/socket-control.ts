let stopSocket: (() => void) | null = null

export function registerNotificationSocketStop(stop: () => void) {
  stopSocket = stop
  return () => {
    if (stopSocket === stop) stopSocket = null
  }
}

export function stopNotificationSocket() {
  stopSocket?.()
  stopSocket = null
}
