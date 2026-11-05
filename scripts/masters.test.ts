// A model's masters and variants: their defaults, and the variant and values a configurator link names.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { queryUrl } from '../configurator/src/App.url.ts'
import { MASTERS as COMPASS_ARMCHAIR } from '../compass-armchair/compass-armchair.masters.ts'
import type { Control, Variants } from '../configurator/src/models.ts'
import { IMPLICIT_VARIANT } from '../configurator/src/models.variants.ts'
import { MASTERS } from '../zigzag-chair/zigzag-chair.masters.ts'
import { camValues } from '../configurator/src/models.cam.ts'
import { camStepFile, checkedVariant, defaultValues, linkValues, loadVariants, queryValues } from './masters.ts'

/** A model of two variants, for the variant path: no part of the repository is needed for it. */
const masters = {
  T: { value: 19, min: 12, max: 30, step: 1, hint: 'thickness' },
  SEAT: { value: 10, min: 5, max: 40, step: 1, hint: "the seat's thickness" },
} satisfies Record<string, Control>
const variants = {
  cane: { label: 'Cane', hint: 'a cane seat' },
  cushion: { label: 'Cushion', hint: 'a leather cushion', values: { SEAT: 30 } },
} satisfies Variants

test('defaultValues: every master, at its default', async () => {
  const values = await defaultValues('zigzag-chair')
  assert.equal(values.T, MASTERS.T.value)
  assert.equal(values.BACK_LEAN, MASTERS.BACK_LEAN.value)
})

test('loadVariants: a model without VARIANTS has the implicit one alone', async () => {
  assert.deepEqual(Object.keys(await loadVariants('zigzag-chair')), [IMPLICIT_VARIANT])
  assert.deepEqual(await defaultValues('zigzag-chair', IMPLICIT_VARIANT), await defaultValues('zigzag-chair'))
  await assert.rejects(defaultValues('zigzag-chair', 'cushion'), /no variant cushion \(known: default\)/)
})

test('checkedVariant: the default when none is named, the one named when known; an unknown one throws, naming the known', () => {
  assert.equal(checkedVariant(variants, null), 'cane')
  assert.equal(checkedVariant(variants, ''), 'cane')
  assert.equal(checkedVariant(variants, 'cushion'), 'cushion')
  assert.throws(() => checkedVariant(variants, 'nope'), /no variant nope \(known: cane, cushion\)/)
})

test("queryValues: the values are relative to the variant's defaults", () => {
  assert.deepEqual(queryValues(masters, variants, new URLSearchParams('T=20')), { variant: 'cane', values: { T: 20, SEAT: 10 } })
  assert.deepEqual(queryValues(masters, variants, new URLSearchParams('variant=cushion&T=20')), { variant: 'cushion', values: { T: 20, SEAT: 30 } })
  assert.deepEqual(queryValues(masters, variants, new URLSearchParams('variant=cushion&SEAT=99')), { variant: 'cushion', values: { T: 19, SEAT: 40 } })
  assert.throws(() => queryValues(masters, variants, new URLSearchParams('variant=nope')), /known: cane, cushion/)
})

test('linkValues: the link names the model; a changed value is taken, one out of range is clamped, the rest are the defaults', async () => {
  const defaults = await defaultValues('zigzag-chair')
  const { model, variant, values } = await linkValues('https://abernier.github.io/integral/configurator/?part=zigzag-chair&BACK_LEAN=10&T=99&NOPE=1')
  assert.equal(model, 'zigzag-chair')
  assert.equal(variant, IMPLICIT_VARIANT)
  assert.deepEqual(values, { ...defaults, BACK_LEAN: 10, T: MASTERS.T.max })
})

test('linkValues: a bare query is read like the full link', async () => {
  const full = await linkValues('https://abernier.github.io/integral/configurator/?part=zigzag-chair&BACK_LEAN=10')
  const bare = await linkValues('?part=zigzag-chair&BACK_LEAN=10')
  assert.deepEqual(bare, full)
})

test('linkValues: a link with its separators escaped (&amp;), copied out of HTML or Markdown, reads as the plain one', async () => {
  const plain = await linkValues('https://abernier.github.io/integral/configurator/?part=zigzag-chair&BACK_LEAN=10&T=20')
  const escaped = await linkValues('https://abernier.github.io/integral/configurator/?part=zigzag-chair&amp;BACK_LEAN=10&amp;T=20')
  assert.deepEqual(escaped, plain)
})

// The writer of the link (the configurator's queryUrl) and its reader (linkValues) live in two files: this ties them.
test('linkValues: reads back what the configurator writes into a link', async () => {
  const defaults = await defaultValues('zigzag-chair')
  const changed = { BACK_LEAN: 12, W_NOSE: 400 }
  const link = queryUrl({ schema: MASTERS }, { part: 'zigzag-chair', values: { ...defaults, ...changed } }, 'https://abernier.github.io/integral/configurator/')
  const { model, values } = await linkValues(link)
  assert.equal(model, 'zigzag-chair')
  assert.deepEqual(values, { ...defaults, ...changed })
})

// Some defaults are off their step grid (leva drags from them by whole steps): such values read back exactly.
test('linkValues: reads back, for every master of the real models in every variant, a value three steps off its default', async () => {
  for (const [model, masters] of [['zigzag-chair', MASTERS], ['compass-armchair', COMPASS_ARMCHAIR]] as const) {
    const variants = await loadVariants(model)
    for (const variant of Object.keys(variants)) {
      const defaults = await defaultValues(model, variant)
      for (const [name, { min, max, step }] of Object.entries(masters)) {
        const values = { ...defaults, [name]: Math.min(max, Math.max(min, defaults[name] + 3 * step)) }
        const link = queryUrl({ schema: masters, variants }, { part: model, variant, values }, 'https://abernier.github.io/integral/configurator/')
        assert.deepEqual(await linkValues(link), { model, variant, values }, `${model} ${variant} ${name}`)
      }
    }
  }
})

test('linkValues: a link without part, of no model, or of a variant the model lacks, is refused', async () => {
  await assert.rejects(linkValues('https://abernier.github.io/integral/configurator/?BACK_LEAN=10'), /no part/)
  await assert.rejects(linkValues('https://abernier.github.io/integral/configurator/?part=nope'), /no model nope/)
  await assert.rejects(linkValues('?part=zigzag-chair&variant=cushion'), /zigzag-chair: no variant cushion \(known: default\)/)
  assert.equal((await linkValues('?part=zigzag-chair&variant=default')).variant, IMPLICIT_VARIANT)
})

test('camValues: a master with a `cam` value takes it, the others keep theirs; none has one: the same values', () => {
  const masters = { A: { value: 2, min: 0, max: 4, step: 1, hint: 'a', cam: 0 }, B: { value: 5, min: 0, max: 9, step: 1, hint: 'b' } }
  assert.deepEqual(camValues(masters, { A: 3, B: 7 }), { A: 0, B: 7 })
  const values = { T: 18 }
  assert.equal(camValues({ T: { value: 18, min: 15, max: 25, step: 1, hint: 't' } }, values), values)
})

test('camStepFile: <model>.cam.step when a master has a `cam` value, else <model>.step', () => {
  assert.equal(camStepFile({ A: { value: 2, min: 0, max: 4, step: 1, hint: 'a', cam: 0 } }, '/d', 'm'), '/d/m.cam.step')
  assert.equal(camStepFile(MASTERS, '/d', 'm'), '/d/m.step')
})

test('camStepFile: a variant other than the default names its files, the default does not', () => {
  const cam = { A: { value: 2, min: 0, max: 4, step: 1, hint: 'a', cam: 0 } }
  assert.equal(camStepFile(cam, '/d', 'm', variants, 'cane'), '/d/m.cam.step')
  assert.equal(camStepFile(cam, '/d', 'm', variants, 'cushion'), '/d/m.cushion.cam.step')
  assert.equal(camStepFile(MASTERS, '/d', 'm', variants, 'cushion'), '/d/m.cushion.step')
})
