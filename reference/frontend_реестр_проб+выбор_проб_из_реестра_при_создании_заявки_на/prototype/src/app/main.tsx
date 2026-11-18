import React from 'react'
import ReactDOM from 'react-dom/client'
import { I18nextProvider } from 'react-i18next'
import { Provider } from 'react-redux'
import { Toaster } from 'sonner'
import { ThemeProvider } from 'next-themes'
import i18n from '../shared/i18n/locales/i18n'
import '../shared/styles/index.css'
import { TooltipProvider } from '../shared/ui/tooltip'
import { registerLogoutHandler } from '../shared/api/session-events'
import { AppRouter } from './routing/AppRouter'
import { performLogout } from './session/perform-logout'
import { store } from './store/store'

async function prepareRuntime() {
  registerLogoutHandler(performLogout)
  if (import.meta.env.VITE_API_MODE === 'mock') {
    const { startMockWorker } = await import('./mocks/browser')
    await startMockWorker()
    return
  }
  const { stopOwnMockWorker } = await import('./mocks/worker-lifecycle')
  await stopOwnMockWorker()
}

void prepareRuntime().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <Provider store={store}>
        <I18nextProvider i18n={i18n}>
          <TooltipProvider>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
              <AppRouter />
              <Toaster richColors position="top-center" />
            </ThemeProvider>
          </TooltipProvider>
        </I18nextProvider>
      </Provider>
    </React.StrictMode>,
  )
})
