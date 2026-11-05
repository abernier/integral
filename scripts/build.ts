// `nr build`: build the parts that changed with ClassCAD, each of its variants (site.ts), then the configurator and the docs site into dist/, the built files beside its pages.
// `nr build:parts` (`--parts-only`): the parts alone, into .docs/, each variant with its CAM geometry when it has one (buildCamStep).
//
// A part already built from the same sources and values (every variant's files, their CAM STEPs too) is not built
// again (build.cache.ts). `--force` builds every part anyway.

import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { basename, join, relative, sep } from 'node:path'
import { FILES, buildKey, upToDate, writeKey } from './build.cache.ts'
import { type Engine, openEngine } from './classcad.ts'
import { type Values, camStepFile, defaultValues, loadMasters, loadVariants } from './masters.ts'
import { MDX, ROOT, partFile, parts } from './paths.ts'
import { DIST, buildConfigurator, buildVariants, docsEnv, writePages } from './site.ts'

const force = process.argv.includes('--force')

/** The files a part's build writes into .docs/<part>/: every variant's (paths.ts partFile), and its CAM STEP when a master has a `cam` value (camStepFile). */
async function outputs(part: string) {
  const masters = await loadMasters(part)
  const variants = await loadVariants(part)
  return Object.keys(variants).flatMap((variant) => {
    const files = FILES.map((ext) => partFile(part, variants, variant, ext))
    const cam = basename(camStepFile(masters, join(MDX, part), part, variants, variant))
    return files.includes(cam) ? files : [...files, cam]
  })
}

// Empty .docs/ but for the parts' folders, whose files may still be current.
for (const entry of existsSync(MDX) ? readdirSync(MDX) : []) {
  if (!parts().includes(entry)) rmSync(join(MDX, entry), { recursive: true, force: true })
}

// The engine starts only if a part has to be built (a few seconds).
let engine: Engine | undefined
for (const part of parts()) {
  // Every variant's values, by its id (the variants come with the masters' file).
  const values: Record<string, Values> = {}
  for (const variant of Object.keys(await loadVariants(part))) values[variant] = await defaultValues(part, variant)
  const key = buildKey(part, values)
  if (!force && upToDate(part, key, join(MDX, part), await outputs(part))) {
    console.log(`${part}: up to date`)
    continue
  }
  // From a clean folder: no leftovers, nor `pnpm cam` toolpaths (cam/) cut for the old geometry.
  rmSync(join(MDX, part), { recursive: true, force: true })
  engine ??= await openEngine()
  // Every variant, each with its CAM STEP when it has one.
  await buildVariants(engine, part)
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
