import { defineConfig, loadEnv, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import tsconfigPaths from 'vite-tsconfig-paths'

function apiProxy(apiBaseUrl: string | undefined): Record<string, ProxyOptions> | undefined {
  const raw = apiBaseUrl || 'http://localhost:8000/'
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return undefined
  }

  const pathname = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`
  if (pathname === '/') return undefined

  const prefix = pathname.replace(/\/$/, '')

  return {
    [prefix]: {
      target: url.origin,
      changeOrigin: true,
      secure: true,
      configure: (proxy) => {
        proxy.on('proxyRes', (proxyRes) => {
          const setCookie = proxyRes.headers['set-cookie']
          if (!setCookie) return
          // Ответ приходит на http://localhost. SameSite=None; Secure браузер
          // для этого ответа не сохранит, и логин снова уйдёт без csrftoken.
          proxyRes.headers['set-cookie'] = setCookie.map((cookie) =>
            cookie
              .replace(/;\s*Secure/gi, '')
              .replace(/;\s*SameSite=None/gi, '; SameSite=Lax')
              .replace(/;\s*Partitioned/gi, ''),
          )
        })
      },
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      tailwindcss(),
      tsconfigPaths(),
    ],
    server: {
      proxy: apiProxy(env.VITE_API_BASE_URL),
    },
  }
})