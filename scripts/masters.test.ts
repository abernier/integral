// A values file's schema, made from a model's masters: every value in range, nothing else, the right model.
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { defaultValues, loadValues, valuesSchema, variantHash } from './masters.ts'

const masters = {
  T: { value: 19, min: 12, max: 30, hint: 'board thickness' },
  BACK_LEAN: { value: 8, min: 0, max: 20, hint: "the back's lean" },
}
const schema = valuesSchema('zigzag-chair', masters)
const file = { $schema: 'https://example.com/s.json', model: 'zigzag-chair', values: { T: 19, BACK_LEAN: 10 } }

test('valuesSchema: a file with every master in range passes; $schema is optional', () => {
  assert.deepEqual(schema.parse(file), file)
  assert.deepEqual(schema.parse({ model: 'zigzag-chair', values: { T: 30, BACK_LEAN: 0 } }).values, { T: 30, BACK_LEAN: 0 })
})

test('valuesSchema: an unknown key, a missing key, a value out of range or not a number fails', () => {
  assert.equal(schema.safeParse({ ...file, values: { ...file.values, LEAN: 10 } }).success, false)
  assert.equal(schema.safeParse({ ...file, values: { T: 19 } }).success, false)
  assert.equal(schema.safeParse({ ...file, values: { T: 19, BACK_LEAN: 25 } }).success, false)
  assert.equal(schema.safeParse({ ...file, values: { T: '19', BACK_LEAN: 10 } }).success, false)
  assert.equal(schema.safeParse({ ...file, extra: true }).success, false)
})

test('valuesSchema: another model, or any other key such as a commit, fails', () => {
  assert.equal(schema.safeParse({ ...file, model: 'compass-armchair' }).success, false)
  assert.equal(schema.safeParse({ ...file, commit: '00f924b' }).success, false)
})

test('variantHash: the same values, the same hash, whatever their order; other values, another', () => {
  const hash = variantHash(masters, { T: 19, BACK_LEAN: 10 })
  assert.match(hash, /^[0-9a-f]{64}$/)
  assert.equal(variantHash(masters, { BACK_LEAN: 10, T: 19 }), hash)
  assert.notEqual(variantHash(masters, { T: 19, BACK_LEAN: 10.5 }), hash)
})

test('loadValues: two files of the same values, named apart, are one variant; other values, another', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'masters-'))
  const values = { ...(await defaultValues('zigzag-chair')), BACK_LEAN: 10 }
  const write = (name: string, file: unknown) => {
    writeFileSync(join(dir, name), JSON.stringify(file))
    return loadValues('zigzag-chair', join(dir, name))
  }
  const a = await write('a.json', { model: 'zigzag-chair', values })
  const b = await write('my chair.json', { model: 'zigzag-chair', values })
  const c = await write('a2.json', { model: 'zigzag-chair', values: { ...values, BACK_LEAN: 12 } })
  assert.equal(a.name, b.name)
  assert.equal(a.name, a.hash.slice(0, 8))
  assert.notEqual(c.hash, a.hash)
})
