// `nr build`: build every part with ClassCAD, then the configurator and the docs site into dist/, the built files beside its pages.
// `nr build:parts` (`--parts-only`): the parts alone, into .docs/.
// `node scripts/build.ts --parts-only <model> --values <file.json>`: that model alone, with the values of the file
// (masters.ts), into .docs/<model>/variants/<hash of the values>/; the rest of .docs/ stays.

import { cpSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { openEngine } from './classcad.ts'
import { loadValues } from './masters.ts'
import { MDX, ROOT, parts, variantDir } from './paths.ts'
import { DIST, buildConfigurator, buildPart, docsEnv, writePages } from './site.ts'

const USAGE = 'usage: node scripts/build.ts [--parts-only] | --parts-only <model> --values <file.json>'
const fail = (message: string): never => {
  console.error(`build: ${message}\n${USAGE}`)
  process.exit(2)
}

const { values: flags, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    'parts-only': { type: 'boolean', default: false },
    values: { type: 'string' },
  },
})

if (flags.values !== undefined) {
  const [model] = positionals
  if (!flags['parts-only'] || positionals.length !== 1) fail('--values builds one model\'s parts only')
  if (!parts().includes(model)) fail(`no model ${model} (no ${model}/${model}.ts)`)
  // Checked before the engine opens: a wrong value costs nothing.
  const variant = await loadValues(model, flags.values).catch((error: Error) => fail(error.message))
  console.log(`build: ${model} variant ${variant.hash}, into ${variantDir(model, variant.name)}`)
  const engine = await openEngine()
  await buildPart(engine, model, variant.values, variantDir(model, variant.name))
  engine.client.close()
  process.exit(0)
}
if (positionals.length) fail(`a model (${positionals.join(' ')}) is built alone with --values only`)

rmSync(MDX, { recursive: true, force: true })
const engine = await openEngine()
for (const part of parts()) await buildPart(engine, part)
engine.client.close()

if (!flags['parts-only']) {
  await buildConfigurator()
  writePages()
  rmSync(DIST, { recursive: true, force: true })
  execFileSync(join(ROOT, 'node_modules', '.bin', 'pmndrs-docs'), ['build', MDX, DIST, '--format', 'website'], {
    cwd: ROOT,
    env: docsEnv(),
    stdio: 'inherit',
  })
  // The built files, at the URLs the pages link them by.
  cpSync(MDX, DIST, { recursive: true, filter: (path) => path === MDX || !path.endsWith('.mdx') })
  console.log(`site: ${DIST}`)
}

process.exit(0)
