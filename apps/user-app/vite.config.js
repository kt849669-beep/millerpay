import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const loginEntry = fileURLToPath(new URL('./login.html', import.meta.url))
const cleanLoginPaths = new Set(['/', '/login', '/login/'])

function cleanLoginRoute() {
  const routeLogin = (req, _res, next) => {
    const [pathname, query] = (req.url || '/').split('?')
    if (cleanLoginPaths.has(pathname)) {
      req.url = `/login.html${query ? `?${query}` : ''}`
    }
    next()
  }

  return {
    name: 'miller-pay-clean-login-route',
    configureServer(server) {
      server.middlewares.use(routeLogin)
    },
    configurePreviewServer(server) {
      server.middlewares.use(routeLogin)
    },
  }
}

export default defineConfig({
  plugins: [cleanLoginRoute(), react()],
  build: {
    rollupOptions: {
      input: loginEntry,
    },
  },
})
