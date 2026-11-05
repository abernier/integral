// `nr build`: build the parts that changed with ClassCAD, then the configurator and the docs site into dist/, the built files beside its pages.
// `nr build:parts` (`--parts-only`): the parts alone, into .docs/.
//
// A part already built from the same sources and values is not built again (build.cache.ts). `--force` builds
// every part anyway.

import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, relative, sep } from 'node:path'
import { buildKey, upToDate, writeKey } from './build.cache.ts'
import { type Engine, openEngine } from './classcad.ts'
import { defaultValues } from './masters.ts'
import { MDX, ROOT, parts } from './paths.ts'
import { DIST, buildConfigurator, buildPart, docsEnv, writePages } from './site.ts'

const force = process.argv.includes('--force')

// Empty .docs/ but for the parts' folders, whose files may still be current.
for (const entry of existsSync(MDX) ? readdirSync(MDX) : []) {
  if (!parts().includes(entry)) rmSync(join(MDX, entry), { recursive: true, force: true })
}

// The engine starts only if a part has to be built (a few seconds).
let engine: Engine | undefined
for (const part of parts()) {
  const key = buildKey(part, await defaultValues(part))
  if (!force && upToDate(part, key)) {
    console.log(`${part}: up to date`)
    continue
  }
  // From a clean folder: no leftovers, nor `pnpm cam` toolpaths (cam/) cut for the old geometry.
  rmSync(join(MDX, part), { recursive: true, force: true })
  engine ??= await openEngine()
  await buildPart(engine, part)
  writeKey(part, key)
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
