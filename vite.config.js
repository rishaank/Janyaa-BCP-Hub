import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// __BUILD_SHA__ is the commit this bundle was built from. Vercel sets
// VERCEL_GIT_COMMIT_SHA at build time. It exists so "is the phone running an old
// build?" is a question with an answer instead of a guess — see /whoami.
export default defineConfig({
  define: {
    __BUILD_SHA__: JSON.stringify(
      (process.env.VERCEL_GIT_COMMIT_SHA || 'local').slice(0, 7),
    ),
  },
  plugins: [react(), tailwindcss()],
})
