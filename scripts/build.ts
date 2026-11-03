// `nr build`: build every part with ClassCAD, then the configurator and the docs site into dist/, the built files beside its pages.
// `nr build:parts` (`--parts-only`): the parts alone, into .docs/.

import { cpSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { openEngine } from './classcad.ts'
import { DIST, MDX, ROOT, buildConfigurator, buildPart, docsEnv, parts, writePages } from './site.ts'

rmSync(MDX, { recursive: true, force: true })
const engine = await openEngine()
for (const part of parts()) await buildPart(engine, part)
engine.client.close()

if (!process.argv.includes('--parts-only')) {
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
