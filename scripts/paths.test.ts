// How a variant's outputs are named: the default variant keeps the part's plain names, any other is named by its id.
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'

import type { Variants } from '../configurator/src/models.ts'
import { variantsOf } from '../configurator/src/models.variants.ts'
import { MDX, camFolder, partFile } from './paths.ts'

const variants = {
  cane: { label: 'Cane', hint: 'a cane seat' },
  cushion: { label: 'Cushion', hint: 'a leather cushion' },
} satisfies Variants

test("partFile: the default variant's file has the part's name, another's the variant's too", () => {
  assert.equal(partFile('armchair', variants, 'cane', 'step'), 'armchair.step')
  assert.equal(partFile('armchair', variants, 'cushion', 'step'), 'armchair.cushion.step')
  assert.equal(partFile('chair', variantsOf(undefined), 'default', 'glb'), 'chair.glb')
})

test("camFolder: the default variant's is the model's cam/, another's a folder in it", () => {
  assert.equal(camFolder('armchair', variants, 'cane'), join(MDX, 'armchair', 'cam'))
  assert.equal(camFolder('armchair', variants, 'cushion'), join(MDX, 'armchair', 'cam', 'cushion'))
})
