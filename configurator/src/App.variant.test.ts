// Switching variants: the user's tweaks stay, every other master takes the new variant's default.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { switchedValues } from './App.variant.ts'

const model = {
  schema: {
    T: { value: 19, min: 12, max: 30, step: 0.5, hint: 'board thickness' },
    SEAT: { value: 450, min: 400, max: 500, step: 1, hint: 'seat height' },
    CANE: { value: 3, min: 2, max: 5, step: 0.5, hint: 'cane thickness' },
  },
  variants: {
    cane: { label: 'Cane', hint: 'a cane seat' },
    cushion: { label: 'Cushion', hint: 'a leather cushion', values: { SEAT: 470, T: 22 } },
  },
}

test('switchedValues: an untouched master takes the new variant default', () => {
  assert.deepEqual(switchedValues(model, 'cane', 'cushion', { T: 19, SEAT: 450, CANE: 3 }), { T: 22, SEAT: 470, CANE: 3 })
  assert.deepEqual(switchedValues(model, 'cushion', 'cane', { T: 22, SEAT: 470, CANE: 3 }), { T: 19, SEAT: 450, CANE: 3 })
})

test('switchedValues: a master the user changed keeps its value', () => {
  assert.deepEqual(switchedValues(model, 'cane', 'cushion', { T: 25, SEAT: 450, CANE: 4 }), { T: 25, SEAT: 470, CANE: 4 })
  // Changed back to the default of the variant left: untouched, as far as the panel can tell.
  assert.deepEqual(switchedValues(model, 'cushion', 'cane', { T: 22, SEAT: 455, CANE: 3 }), { T: 19, SEAT: 455, CANE: 3 })
})
