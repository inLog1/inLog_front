interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_WEBSOCKET_URL?: string
  readonly VITE_WSS_BASE_URL?: string
  readonly VITE_API_MODE?: 'mock' | 'live'
  readonly VITE_AUTH_MODE?: 'local' | 'sso' | 'mixed'
  readonly VITE_SSO_START_URL?: string
  readonly VITE_SSO_PROVIDER_LABEL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
