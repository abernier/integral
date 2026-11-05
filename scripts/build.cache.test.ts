// The build cache: what changes a part's key, and when its built files are up to date.
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'

import { FILES, LOCKFILE, SHARED_SOURCES, buildKey, upToDate, writeKey } from './build.cache.ts'

const PART = 'chair'
const VALUES = { T: 18, BACK_LEAN: 12 }

/** A repository holding the part's script and masters, the shared sources and the lockfile. */
function repository() {
  const root = mkdtempSync(join(tmpdir(), 'build-cache-'))
  for (const source of [`${PART}/${PART}.ts`, `${PART}/${PART}.masters.ts`, ...SHARED_SOURCES, LOCKFILE]) {
    mkdirSync(dirname(join(root, source)), { recursive: true })
    writeFileSync(join(root, source), `// ${source}`)
  }
  return root
}

test('buildKey: the same sources, values and environment give the same key', () => {
  const root = repository()
  assert.equal(buildKey(PART, VALUES, { root, env: {} }), buildKey(PART, VALUES, { root, env: {} }))
})

test('buildKey: changes when a source changes (the part, its masters, a shared one, the lockfile)', () => {
  const root = repository()
  for (const source of [`${PART}/${PART}.ts`, `${PART}/${PART}.masters.ts`, 'scripts/part.ts', LOCKFILE]) {
    const before = buildKey(PART, VALUES, { root, env: {} })
    writeFileSync(join(root, source), '// changed')
    assert.notEqual(buildKey(PART, VALUES, { root, env: {} }), before, source)
  }
})

test('buildKey: changes when a value changes', () => {
  const root = repository()
  assert.notEqual(buildKey(PART, VALUES, { root, env: {} }), buildKey(PART, { ...VALUES, T: 20 }, { root, env: {} }))
})

test('buildKey: changes when an engine variable is set', () => {
  const root = repository()
  const before = buildKey(PART, VALUES, { root, env: {} })
  assert.notEqual(buildKey(PART, VALUES, { root, env: { CLASSCAD_WASM_VERSION: '21.3.0' } }), before)
  assert.notEqual(buildKey(PART, VALUES, { root, env: { CLASSCAD_WASM_URL: 'https://example.com/engine' } }), before)
})

test('upToDate: every file is there and the key matches', () => {
  const dir = mkdtempSync(join(tmpdir(), 'build-cache-'))
  assert.equal(upToDate(PART, 'key', dir), false, 'no key yet')
  for (const ext of FILES) writeFileSync(join(dir, `${PART}.${ext}`), '')
  writeKey(PART, 'key', dir)
  assert.equal(upToDate(PART, 'key', dir), true)
  assert.equal(upToDate(PART, 'another key', dir), false, 'another key')
  for (const ext of FILES) {
    rmSync(join(dir, `${PART}.${ext}`))
    assert.equal(upToDate(PART, 'key', dir), false, `no .${ext}`)
    writeFileSync(join(dir, `${PART}.${ext}`), '')
  }
})

test('upToDate: a part with more files (its CAM STEP) needs each of them', () => {
  const dir = mkdtempSync(join(tmpdir(), 'build-cache-'))
  const files = [...FILES.map((ext) => `${PART}.${ext}`), `${PART}.cam.step`]
  for (const file of files) writeFileSync(join(dir, file), '')
  writeKey(PART, 'key', dir)
  assert.equal(upToDate(PART, 'key', dir, files), true)
  rmSync(join(dir, `${PART}.cam.step`))
  assert.equal(upToDate(PART, 'key', dir, files), false, 'no CAM STEP')
  assert.equal(upToDate(PART, 'key', dir), true, 'not asked for')
})
