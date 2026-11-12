import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Agent worktrees (.claude/worktrees) carry their own copy of tests/.
  test: {
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
  server: {
    watch: {
      usePolling: true,
      interval: 250,
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('lucide-react')) return 'icons'
          if (id.includes('react')) return 'react-vendor'
          // Every other package (jspdf, html2canvas and their pako, canvg,
          // core-js, fflate, dompurify…, qrcode-generator) stays with the lazy
          // chunk that imports it: a catch-all eager "vendor" chunk pulled the
          // PDF libraries into every page's first load.
          return undefined
        },
      },
    },
  },
})
