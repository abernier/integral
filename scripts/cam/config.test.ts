// A model's CAM config follows its values: the zigzag chair's Seat goes on a wedge of BACK_LEAN (docs/cam.md). Loading
// the model's module here also proves it imports without ClassCAD (scripts/part.ts imports types only).
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { defaultValues } from '../masters.ts'
import { ROOT } from '../paths.ts'
import { configFile, loadConfig } from './config.ts'
import { loadMaterials } from './machining.ts'

const file = configFile(ROOT, 'zigzag-chair')
const materials = loadMaterials()

test('loadConfig: the Seat goes on a wedge of BACK_LEAN', async () => {
  const values = { ...(await defaultValues('zigzag-chair')), BACK_LEAN: 10 }
  const config = await loadConfig(file, materials, values)
  assert.deepEqual(config.parts?.Seat.setups?.[0], { name: 'wedge10', wedge: 10, rotate: [10, 0, 0], cut: 'squared' })
})

test("loadConfig: with the defaults, the wedge is BACK_LEAN's default", async () => {
  const values = await defaultValues('zigzag-chair')
  const lean = values.BACK_LEAN
  const config = await loadConfig(file, materials, values)
  assert.deepEqual(config.parts?.Seat.setups?.[0], { name: `wedge${lean}`, wedge: lean, rotate: [lean, 0, 0], cut: 'squared' })
})
