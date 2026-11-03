// The configurator: a Vite app, built into the docs site's MDX folder (`nr build`, watched by `nr dev`) or served on
// its own (`nr dev:configurator`). `base: './'` holds everywhere (standalone, dev watch, site build): the page is
// addressed by its directory URL, which its relative URLs resolve against.
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
