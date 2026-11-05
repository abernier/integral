// `pnpm render [<model>...]`: a model's renders, several views in the site's studio style, made by Blender headless
// on this machine (render.blender.py holds the scene: the style, the views) from the GLB the build wrote
// (`.docs/<model>/<model>.glb`, `nr build:parts`). The files go to `<model>/renders/<model>.<view>.webp`, in git
// like `references/`: the site shows them before the model's Intro as a strip (site.ts), from the README's image
// lines, which this script prints when the README lacks them.

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { parseArgs } from 'node:util'
import { MDX, ROOT, parts } from './paths.ts'

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

/** Where GitHub Pages serves the site: the READMEs link the renders by this URL, as every other file. */
const PAGES_URL = 'https://abernier.github.io/integral'
/** The views render.blender.py makes, and how each is said in the README's image alt. */
const VIEWS = { 'three-quarter': 'three-quarter front', front: 'front', side: 'side', back: 'three-quarter back' }
const CANDIDATES = ['/Applications/Blender.app/Contents/MacOS/Blender', 'blender']

const USAGE = `usage: pnpm render [<model>...] [options]      (no model: every model)
  --blender <bin>   Blender's executable (default $BLENDER, else ${CANDIDATES.join(', then ')})
  --samples <n>     Cycles samples per view (default ${flags.samples}; more is smoother and slower)`

if (flags.help) {
  console.log(USAGE)
  process.exit(0)
}

const blender =
  flags.blender ?? process.env.BLENDER ?? CANDIDATES.find((bin) => existsSync(bin) || spawnSync('which', [bin]).status === 0) ?? fail(`no Blender found: pass --blender <bin> or set $BLENDER\n${USAGE}`)

const models = positionals.length ? positionals : parts()
for (const model of models) {
  if (!parts().includes(model)) fail(`no model named ${model}: ${parts().join(', ')}`)
  const glb = join(MDX, model, `${model}.glb`)
  if (!existsSync(glb)) fail(`${shown(glb)} is missing: nr build:parts makes it`)
  const out = join(ROOT, model, 'renders')
  mkdirSync(out, { recursive: true })
  const started = performance.now()
  const result = spawnSync(blender, ['--background', '--factory-startup', '--python', join(ROOT, 'scripts', 'render.blender.py'), '--', glb, out, model, flags.samples], {
    encoding: 'utf8',
  })
  const lines = `${result.stdout}${result.stderr}`.split('\n')
  for (const line of lines) if (line.startsWith('render: ')) console.log(shown(line.replace(/^render: /, `${model}: `)))
  if (result.status !== 0) fail(`Blender failed on ${model}:\n${lines.filter((l) => /error|Error|Traceback/.test(l)).join('\n')}`)
  console.log(`${model}: ${((performance.now() - started) / 1000).toFixed(1)} s, ${shown(out)}/`)

  // The README's image lines (one per view, right before its Intro) the site makes the strip from.
  const readme = readFileSync(join(ROOT, model, 'README.md'), 'utf8')
  const title = readme.match(/^# (.+)$/m)?.[1] ?? model
  const images = Object.entries(VIEWS).map(([view, said]) => `![${title}, ${said}](${PAGES_URL}/${model}/renders/${model}.${view}.webp)`)
  const missing = images.filter((image) => !readme.includes(image))
  if (missing.length) console.log(`${model}: README.md lacks the renders' lines; before <Intro>:\n\n${images.join('\n')}\n`)
}
