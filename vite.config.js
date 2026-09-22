import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
          // jspdf/html2canvas are only ever loaded via dynamic import() from
          // the PDF export utility — keep them out of the eager "vendor"
          // chunk so they don't add ~800kB to every page's initial load.
          if (id.includes('jspdf') || id.includes('html2canvas')) return undefined
          return 'vendor'
        },
      },
    },
  },
})
