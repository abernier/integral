// The build cache: a part whose files in .docs/<part>/ were built from the same sources and values is not built
// again. Its key (buildKey) is stored beside them as `<part>.key`. Nothing here builds or loads ClassCAD.

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Values } from './masters.ts'
import { MDX, ROOT } from './paths.ts'

/** The files a part's built files depend on, besides its own script and masters. */
export const SHARED_SOURCES = ['scripts/part.ts', 'scripts/classcad.ts', 'scripts/step-assembly.ts', 'scripts/site.ts']

/**
 * The lockfile: every package's resolved version (ClassCAD's, sharp's and their dependencies'), and the hash of
 * each patch in patches/.
 */
export const LOCKFILE = 'pnpm-lock.yaml'

/** The environment variables that let @classcad/mcp pick another engine release. */
export const ENGINE_ENV = ['CLASSCAD_WASM_VERSION', 'CLASSCAD_WASM_URL']

/** The files a part's build writes, by extension. */
export const FILES = ['ofb', 'step', 'glb', 'png']

/**
 * What a part's built files are made from: its script and masters, the shared sources, the lockfile, the engine's
 * environment variables and the values it is built with.
 * @param root The repository: ROOT by default.
 * @param env The environment: process.env by default.
 */
export function buildKey(part: string, values: Values, { root = ROOT, env = process.env } = {}) {
  const hash = createHash('sha256')
  const sources = [`${part}/${part}.ts`, `${part}/${part}.masters.ts`, ...SHARED_SOURCES, LOCKFILE]
  for (const source of sources) {
    hash.update(source)
    hash.update(readFileSync(join(root, source)))
  }
  for (const name of ENGINE_ENV) {
    hash.update(`${name}=${env[name] ?? ''}`)
  }
  hash.update(JSON.stringify(values))
  return hash.digest('hex')
}

/**
 * Where a part's key is stored: beside its built files.
 * @param dir The folder of its files: `.docs/<part>/` by default.
 */
export function keyFile(part: string, dir = join(MDX, part)) {
  return join(dir, `${part}.key`)
}

/** Whether every file of a part is in `dir` and was built with this key. */
export function upToDate(part: string, key: string, dir = join(MDX, part)) {
  if (!existsSync(keyFile(part, dir))) return false
  if (FILES.some((ext) => !existsSync(join(dir, `${part}.${ext}`)))) return false
  return readFileSync(keyFile(part, dir), 'utf8') === key
}

/** Store the key a part's files in `dir` were just built with. */
export function writeKey(part: string, key: string, dir = join(MDX, part)) {
  writeFileSync(keyFile(part, dir), key)
}
