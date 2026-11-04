// A model's masters: their defaults, and the values a configurator link names.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { changedParams } from '../configurator/src/App.query.ts'
import { MASTERS } from '../zigzag-chair/zigzag-chair.masters.ts'
import { defaultValues, linkValues } from './masters.ts'

test('defaultValues: every master, at its default', async () => {
  const values = await defaultValues('zigzag-chair')
  assert.equal(values.T, MASTERS.T.value)
  assert.equal(values.BACK_LEAN, MASTERS.BACK_LEAN.value)
})

test('linkValues: the link names the model; a changed value is taken, one out of range is clamped, the rest are the defaults', async () => {
  const defaults = await defaultValues('zigzag-chair')
  const { model, values } = await linkValues('https://abernier.github.io/integral/configurator/?part=zigzag-chair&BACK_LEAN=10&T=99&NOPE=1')
  assert.equal(model, 'zigzag-chair')
  assert.deepEqual(values, { ...defaults, BACK_LEAN: 10, T: MASTERS.T.max })
})

test('linkValues: a bare query is read like the full link', async () => {
  const full = await linkValues('https://abernier.github.io/integral/configurator/?part=zigzag-chair&BACK_LEAN=10')
  const bare = await linkValues('?part=zigzag-chair&BACK_LEAN=10')
  assert.deepEqual(bare, full)
})

// The writer of the link (the configurator's changedParams) and its reader (linkValues) live in two files: this ties them.
test('linkValues: reads back what the configurator writes into a link', async () => {
  const defaults = await defaultValues('zigzag-chair')
  const changed = { BACK_LEAN: 12, W_NOSE: 400 }
  const params = changedParams(MASTERS, { ...defaults, ...changed }, 'zigzag-chair')
  const { model, values } = await linkValues(`https://abernier.github.io/integral/configurator/?${params}`)
  assert.equal(model, 'zigzag-chair')
  assert.deepEqual(values, { ...defaults, ...changed })
})

test('linkValues: a link without part, or of no model, is refused', async () => {
  await assert.rejects(linkValues('https://abernier.github.io/integral/configurator/?BACK_LEAN=10'), /no part/)
  await assert.rejects(linkValues('https://abernier.github.io/integral/configurator/?part=nope'), /no model nope/)
})
