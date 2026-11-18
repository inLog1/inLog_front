export function getNotificationsWsUrl(token: string): string {
  const customWsBase = import.meta.env.VITE_WSS_BASE_URL as string | undefined

  if (customWsBase) {
    const base = customWsBase.endsWith('/') ? customWsBase : `${customWsBase}/`
    return `${base}notifications/?token=${encodeURIComponent(token)}`
  }

  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/'
  const httpBase = apiBase.replace(/\/api\/?$/, '/')
  const wsBase = httpBase.replace(/^http/, 'ws')

  return `${wsBase}notifications/?token=${encodeURIComponent(token)}`
}
