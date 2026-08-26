import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // Aspire's AddNpmApp sets PORT when it allocates the endpoint; falls back to the usual Vite default
    // for a plain `npm run dev`. No dev-server proxy - the app calls Storefront.Api directly via the
    // absolute VITE_API_URL (see src/lib/api.ts), it doesn't go through this dev server at all.
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : 5173,
  },
})
