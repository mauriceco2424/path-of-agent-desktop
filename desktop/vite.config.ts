import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
// https://tauri.app/develop/

// Use a fixed loopback host to keep dev server/module URLs consistent.
const host = process.env.TAURI_DEV_HOST || '127.0.0.1'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },

  // Tauri-specific configuration
  // Prevent vite from obscuring Rust errors
  clearScreen: false,

  server: {
    // Port can be overridden via VITE_PORT env var for multi-session dev
    port: Number(process.env.VITE_PORT) || 5174,
    strictPort: true,
    // Tauri expects a fixed port, fail if already in use
    host,
    hmr: {
      protocol: 'ws',
      host,
      port: Number(process.env.VITE_PORT) || 5174,
    },
    watch: {
      // Watch for changes in src-tauri to trigger rebuild
      ignored: ['**/src-tauri/**'],
    },
  },

  // Environment variables available to frontend
  envPrefix: ['VITE_', 'TAURI_'],

  build: {
    // Tauri uses Chromium on Windows and WebKit on macOS/Linux
    target: process.env.TAURI_ENV_PLATFORM === 'windows'
      ? 'chrome105'
      : 'safari14',
    // Produce sourcemaps for debugging
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    // Output to dist for Tauri to bundle
    outDir: 'dist',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
  },
})
