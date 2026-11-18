import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig(({ mode }) => {
  // Railway copies service variables into the image and .dockerignore drops .env.mock.
  // Vite keeps an already-set VITE_API_MODE, so a live value would compile the test panel out.
  if (mode === 'mock') {
    process.env.VITE_API_MODE = 'mock'
    process.env.VITE_AUTH_MODE = 'mixed'
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      tsconfigPaths(),
    ],
  }
})