// A model's masters: their defaults, and the values a configurator link names.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { defaultValues, linkValues } from './masters.ts'

test('defaultValues: every master, at its default', async () => {
  const values = await defaultValues('zigzag-chair')
  assert.equal(values.T, 19)
  assert.equal(values.BACK_LEAN, 8)
})

test('linkValues: the link names the model; a changed value is taken, one out of range is clamped, the rest are the defaults', async () => {
  const defaults = await defaultValues('zigzag-chair')
  const { model, values } = await linkValues('https://abernier.github.io/integral/configurator/?part=zigzag-chair&BACK_LEAN=10&T=99&NOPE=1')
  assert.equal(model, 'zigzag-chair')
  assert.deepEqual(values, { ...defaults, BACK_LEAN: 10, T: 30 })
})

test('linkValues: a link without part, or of no model, is refused', async () => {
  await assert.rejects(linkValues('https://abernier.github.io/integral/configurator/?BACK_LEAN=10'), /no part/)
  await assert.rejects(linkValues('https://abernier.github.io/integral/configurator/?part=nope'), /no model nope/)
})
