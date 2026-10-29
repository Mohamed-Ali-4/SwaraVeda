import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// `npm run build:preview` makes a self-contained preview that answers API
// calls with sample data (see src/preview), bundled as one script.
const preview = process.env.VITE_PREVIEW === '1'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: preview ? './' : '/',
  build: preview
    ? { outDir: 'dist-preview', rollupOptions: { output: { inlineDynamicImports: true } } }
    : undefined,
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
