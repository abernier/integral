// The configurator: a Vite app, built into the docs site's MDX folder (`nr build`) or served on its own (`nr dev`).
// `base: './'` is for `nr dev`; the site build sets an absolute one (see `buildConfigurator`).
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  root,
  base: './',
  plugins: [react()],
  // Prebundling the kernel would lose its WebAssembly file next to it.
  optimizeDeps: { exclude: ['@classcad/smlibwasm'] },
  // The parts' model files sit outside this folder.
  server: { fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] } },
  worker: { format: 'es' },
  build: { target: 'es2022' },
})
