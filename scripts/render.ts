// `pnpm render [<model>...]`: a model's renders, several views in the site's studio style, made by Blender headless
// on this machine (render.blender.py holds the scene: the style; render.readme.ts the views) from the GLB the build
// wrote (`.docs/<model>/<model>.glb`, `nr build:parts`). The files go to `<model>/renders/<model>.<view>.webp`, in git
// like `references/`: the site shows them before the model's Intro as a strip (site.ts), from the README's image
// lines, which this script prints when the README lacks them.

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { parseArgs } from 'node:util'
import { MDX, ROOT, parts } from './paths.ts'
import { VIEWS, readmeLines } from './render.readme.ts'

const shown = (path: string) => (path.startsWith(ROOT) ? relative(ROOT, path) : path)
const fail = (message: string): never => {
  console.error(`render: ${message}`)
  process.exit(2)
}

const { values: flags, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    blender: { type: 'string' },
    samples: { type: 'string', default: '64' },
    help: { type: 'boolean', short: 'h', default: false },
  },
})

/** Where Blender may be when neither --blender nor $BLENDER says: the macOS app, then the command on the PATH. */
const CANDIDATES = ['/Applications/Blender.app/Contents/MacOS/Blender', 'blender', 'blender.exe']
const SCRIPT = join(ROOT, 'scripts', 'render.blender.py')

const USAGE = `usage: pnpm render [<model>...] [options]      (no model: every model)
  --blender <bin>   Blender's executable (default $BLENDER, else ${CANDIDATES.join(', then ')})
  --samples <n>     Cycles samples per view (default ${flags.samples}; more is smoother and slower)`

if (flags.help) {
  console.log(USAGE)
  process.exit(0)
}

/** Whether `bin` runs: Blender's --version returns at once, and no `error` means the executable was found. */
function runs(bin: string) {
  const probe = spawnSync(bin, ['--version'], { encoding: 'utf8' })
  return probe.error === undefined
}

/** Blender's executable: --blender, else $BLENDER, else the first of CANDIDATES that runs. */
function findBlender(): string {
  if (flags.blender !== undefined) return flags.blender
  if (process.env.BLENDER) return process.env.BLENDER
  for (const candidate of CANDIDATES) {
    if (runs(candidate)) return candidate
  }
  return fail(`no Blender found: pass --blender <bin> or set $BLENDER\n${USAGE}`)
}

// Everything checked before the first render: a bad flag or a missing GLB fails at once, not after a model's minute.
const samples = Number(flags.samples)
if (!Number.isInteger(samples) || samples < 1) fail(`--samples ${flags.samples}: a positive integer`)
const models = positionals.length ? positionals : parts()
for (const model of models) {
  if (!parts().includes(model)) fail(`no model named ${model}: ${parts().join(', ')}`)
  const glb = join(MDX, model, `${model}.glb`)
  if (!existsSync(glb)) fail(`${shown(glb)} is missing: nr build:parts makes it`)
}
const blender = findBlender()
// The views as render.blender.py reads them: each name its azimuth.
const views = JSON.stringify(Object.fromEntries(Object.entries(VIEWS).map(([view, { azimuth }]) => [view, azimuth])))

for (const model of models) {
  const glb = join(MDX, model, `${model}.glb`)
  const out = join(ROOT, model, 'renders')
  mkdirSync(out, { recursive: true })
  const started = performance.now()
  const result = spawnSync(blender, ['--background', '--factory-startup', '--python', SCRIPT, '--', glb, out, model, String(samples), views], {
    encoding: 'utf8',
    // Blender prints a progress line per sample
    maxBuffer: 64 * 1024 * 1024,
  })
  if (result.error) fail(`Blender did not run (${blender}): ${result.error.message}`)
  const stdout = result.stdout ?? ''
  const stderr = result.stderr ?? ''
  for (const line of `${stdout}${stderr}`.split('\n')) {
    if (line.startsWith('render: ')) console.log(shown(line.replace(/^render: /, `${model}: `)))
  }
  // The traceback is on stderr; Blender's own noise on stdout
  if (result.status !== 0) fail(`Blender failed on ${model}:\n${stderr}`)
  console.log(`${model}: ${((performance.now() - started) / 1000).toFixed(1)} s, ${shown(out)}/`)

  // The README's image lines (one per view, right before its Intro) the site makes the strip from.
  const readme = readFileSync(join(ROOT, model, 'README.md'), 'utf8')
  const { images, missing } = readmeLines(readme, model)
  if (missing.length) console.log(`${model}: README.md lacks the renders' lines; before <Intro>:\n\n${images.join('\n')}\n`)
}
