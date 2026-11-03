// Each browser model's sliders must be the ClassCAD part's MASTERS, same names and defaults: the Model tab and
// the Buerligons tab show the same chair only as long as they do.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MASTERS as compassMasters } from '../compass-armchair/compass-armchair.ts'
import { schema as compass } from '../compass-armchair/compass-armchair.model.ts'
import { MASTERS as zigzagMasters } from '../zigzag-chair/zigzag-chair.ts'
import { schema as zigzag } from '../zigzag-chair/zigzag-chair.model.ts'

const parts = {
  'compass-armchair': { masters: compassMasters, schema: compass },
  'zigzag-chair': { masters: zigzagMasters, schema: zigzag },
}

for (const [name, { masters, schema }] of Object.entries(parts)) {
  test(`${name}: the sliders are the part's MASTERS`, () => {
    const controls: Record<string, { value: number; min: number; max: number; step: number }> = schema
    assert.deepEqual(Object.keys(controls).sort(), Object.keys(masters).sort())
    for (const [key, { value, min, max, step }] of Object.entries(controls)) {
      assert.ok(Math.abs(value - masters[key as keyof typeof masters]) < 1e-9, `${key}: default differs`)
      assert.ok(min <= value && value <= max, `${key}: default outside its range`)
      assert.ok(step > 0, `${key}: step must be positive`)
    }
  })
}
