import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Ensures both dist/ (for Vercel) and build/ (for HostForge / Docker) exist after build
function syncBuildDirPlugin() {
  return {
    name: 'sync-dist-and-build-dirs',
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist')
      const buildDir = path.resolve(__dirname, 'build')
      try {
        fs.cpSync(distDir, buildDir, { recursive: true, force: true })
      } catch (err) {
        console.warn('Failed to mirror dist to build directory:', err)
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), syncBuildDirPlugin()],
  server: { proxy: { '/api': 'http://localhost:4000', '/health': 'http://localhost:4000' } },
  build: {
    outDir: 'dist',
  },
})
