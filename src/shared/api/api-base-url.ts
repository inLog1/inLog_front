function normalizeBase(url: string) {
  return url.endsWith('/') ? url : `${url}/`
}

export function getConfiguredApiBaseUrl() {
  return normalizeBase(import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/')
}

// В dev API вызывается с того же origin, что и страница. Иначе CSRF-cookie
// с бэкенда на другом сайте браузер не сохраняет, и логин получает
// "CSRF cookie not set". Vite проксирует этот префикс на VITE_API_BASE_URL.
export function getApiBaseUrl() {
  const configured = getConfiguredApiBaseUrl()
  if (!import.meta.env.DEV || typeof window === 'undefined') return configured

  try {
    const url = new URL(configured)
    const path = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`
    if (path !== '/' && url.origin !== window.location.origin) return path
  } catch {
    return configured
  }

  return configured
}
