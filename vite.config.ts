import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // /api/* are Vercel serverless functions, which `vite dev` cannot run. In development they
  // are forwarded to the deployed site so AI generation, payments and runtime config work on
  // localhost too. Point VITE_DEV_API_PROXY elsewhere (e.g. http://localhost:3000 under
  // `vercel dev`) to override.
  const apiTarget = env.VITE_DEV_API_PROXY || 'https://aspire-e-learning.site'
  return {
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
  server: {
    proxy: {
      '/api/ollama': {
        target: 'http://localhost:11434',
        changeOrigin: true,
        timeout: 120000,
        proxyTimeout: 120000,
        rewrite: (path) => path.replace(/^\/api\/ollama/, ''),
      },
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        secure: true,
        timeout: 120000,
        proxyTimeout: 120000,
      },
    },
  },
  }
})
