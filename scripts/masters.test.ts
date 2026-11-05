// A model's masters: their defaults, and the values a configurator link names.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { queryUrl } from '../configurator/src/App.url.ts'
import { MASTERS as COMPASS_ARMCHAIR } from '../compass-armchair/compass-armchair.masters.ts'
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

// The writer of the link (the configurator's queryUrl) and its reader (linkValues) live in two files: this ties them.
test('linkValues: reads back what the configurator writes into a link', async () => {
  const defaults = await defaultValues('zigzag-chair')
  const changed = { BACK_LEAN: 12, W_NOSE: 400 }
  const link = queryUrl(MASTERS, { part: 'zigzag-chair', values: { ...defaults, ...changed } }, 'https://abernier.github.io/integral/configurator/')
  const { model, values } = await linkValues(link)
  assert.equal(model, 'zigzag-chair')
  assert.deepEqual(values, { ...defaults, ...changed })
})

// Some defaults are off their step grid (leva drags from them by whole steps): such values read back exactly.
test('linkValues: reads back, for every master of the real models, a value three steps off its default', async () => {
  for (const [model, masters] of [['zigzag-chair', MASTERS], ['compass-armchair', COMPASS_ARMCHAIR]] as const) {
    const defaults = await defaultValues(model)
    for (const [name, { value, min, max, step }] of Object.entries(masters)) {
      const values = { ...defaults, [name]: Math.min(max, Math.max(min, value + 3 * step)) }
      const link = queryUrl(masters, { part: model, values }, 'https://abernier.github.io/integral/configurator/')
      assert.deepEqual((await linkValues(link)).values, values, `${model} ${name}`)
    }
  }
})

test('linkValues: a link without part, or of no model, is refused', async () => {
  await assert.rejects(linkValues('https://abernier.github.io/integral/configurator/?BACK_LEAN=10'), /no part/)
  await assert.rejects(linkValues('https://abernier.github.io/integral/configurator/?part=nope'), /no model nope/)
})
