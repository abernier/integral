// `nr build`: build every part with ClassCAD, then the configurator and the docs site into dist/, the built files beside its pages.
// `nr build:parts` (`--parts-only`): the parts alone, into .docs/.
//
// A part whose files in .docs/<part>/ were built from the same sources and values is not built again: its key
// (buildKey) is stored beside them as `<part>.key`. `--force` builds every part anyway.

import { createHash } from 'node:crypto'
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, relative, sep } from 'node:path'
import { type Engine, openEngine } from './classcad.ts'
import { defaultValues } from './masters.ts'
import { MDX, ROOT, parts } from './paths.ts'
import { DIST, buildConfigurator, buildPart, docsEnv, writePages } from './site.ts'

const force = process.argv.includes('--force')
const packageVersion = (name: string) => JSON.parse(readFileSync(join(ROOT, 'node_modules', name, 'package.json'), 'utf8')).version as string

/** The files a part's built files depend on, besides its own script and masters. */
const SHARED_SOURCES = ['scripts/part.ts', 'scripts/classcad.ts', 'scripts/step-assembly.ts', 'scripts/site.ts']
/** The packages that build them; the patch on @classcad/mcp is hashed with its file. */
const ENGINE_PACKAGES = ['@classcad/mcp', '@classcad/script', '@classcad/renderer', '@classcad/skill']

/**
 * What a part's built files are made from: its sources, the shared ones, the engine and the values.
 * CLASSCAD_WASM_VERSION and CLASSCAD_WASM_URL are hashed too: they let @classcad/mcp pick another engine release.
 */
async function buildKey(part: string) {
  const hash = createHash('sha256')
  const sources = [`${part}/${part}.ts`, `${part}/${part}.masters.ts`, ...SHARED_SOURCES]
  if (existsSync(join(ROOT, 'patches'))) sources.push(...readdirSync(join(ROOT, 'patches')).map((file) => `patches/${file}`))
  for (const source of sources) hash.update(source).update(readFileSync(join(ROOT, source)))
  for (const name of ENGINE_PACKAGES) hash.update(`${name}@${packageVersion(name)}`)
  hash.update(`CLASSCAD_WASM_VERSION=${process.env.CLASSCAD_WASM_VERSION ?? ''}`)
  hash.update(`CLASSCAD_WASM_URL=${process.env.CLASSCAD_WASM_URL ?? ''}`)
  hash.update(JSON.stringify(await defaultValues(part)))
  return hash.digest('hex')
}

const keyFile = (part: string) => join(MDX, part, `${part}.key`)
const FILES = ['ofb', 'step', 'glb', 'png']

/** Whether a part's files are there and were built with this key. */
function upToDate(part: string, key: string) {
  if (force || !existsSync(keyFile(part))) return false
  if (FILES.some((ext) => !existsSync(join(MDX, part, `${part}.${ext}`)))) return false
  return readFileSync(keyFile(part), 'utf8') === key
}

// Empty .docs/ but for the parts' folders, whose files may still be current.
for (const entry of existsSync(MDX) ? readdirSync(MDX) : []) {
  if (!parts().includes(entry)) rmSync(join(MDX, entry), { recursive: true, force: true })
}

// The engine starts only if a part has to be built (a few seconds).
let engine: Engine | undefined
for (const part of parts()) {
  const key = await buildKey(part)
  if (upToDate(part, key)) {
    console.log(`${part}: up to date`)
    continue
  }
  // From a clean folder: no leftovers, nor `pnpm cam` toolpaths (cam/) cut for the old geometry.
  rmSync(join(MDX, part), { recursive: true, force: true })
  engine ??= await openEngine()
  await buildPart(engine, part)
  writeFileSync(keyFile(part), key)
}
engine?.client.close()

if (!process.argv.includes('--parts-only')) {
  await buildConfigurator()
  writePages()
  rmSync(DIST, { recursive: true, force: true })
  execFileSync(join(ROOT, 'node_modules', '.bin', 'pmndrs-docs'), ['build', MDX, DIST, '--format', 'website'], {
    cwd: ROOT,
    env: docsEnv(),
    stdio: 'inherit',
  })
  // The built files, at the URLs the pages link them by (not the pages, the parts' keys, nor `pnpm cam`'s .docs/<part>/cam/).
  cpSync(MDX, DIST, {
    recursive: true,
    filter: (path) => {
      if (path === MDX) return true
      const segments = relative(MDX, path).split(sep)
      if (segments[1] === 'cam') return false
      return !/\.(mdx|key)$/.test(path)
    },
  })
  console.log(`site: ${DIST}`)
}

process.exit(0)
