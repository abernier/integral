// A model's CAM config follows its values and its variant: the zigzag chair's Seat goes on a wedge of BACK_LEAN
// (docs/cam.md). Loading the models' modules here also proves they import without ClassCAD (scripts/part.ts imports
// types only from it): the zigzag chair's, the compass armchair's in each of its variants, and the desk's.
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { camValues } from '../configurator/src/models.cam.ts'
import { defaultValues, loadMasters } from './masters.ts'
import { ROOT } from './paths.ts'
import { configFile, loadConfig } from './cam.config.ts'
import { loadMaterials } from './cam.machining.ts'
import { stepSolidNames } from './step-assembly.ts'

const file = configFile(ROOT, 'zigzag-chair')
const materials = loadMaterials()
const masters = await loadMasters('compass-armchair')

test('loadConfig: the Seat goes on a wedge of BACK_LEAN', async () => {
  const values = { ...(await defaultValues('zigzag-chair')), BACK_LEAN: 10 }
  const config = await loadConfig(file, materials, values, 'default')
  assert.deepEqual(config.parts?.Seat.setups?.[0], { name: 'wedge10', wedge: 10, rotate: [10, 0, 0], cut: 'squared' })
})

test("loadConfig: with the defaults, the wedge is BACK_LEAN's default", async () => {
  const values = await defaultValues('zigzag-chair')
  const lean = values.BACK_LEAN
  const config = await loadConfig(file, materials, values, 'default')
  assert.deepEqual(config.parts?.Seat.setups?.[0], { name: `wedge${lean}`, wedge: lean, rotate: [lean, 0, 0], cut: 'squared' })
})

const compass = configFile(ROOT, 'compass-armchair')

test('loadConfig: the compass armchair is teak, its cane and its rattan splines skipped', async () => {
  // The `cam` values, as `pnpm cam` gives them: GROOVE is 0 there, yet a finished STEP (--step) has the splines.
  const values = camValues(masters, await defaultValues('compass-armchair', 'cane'))
  const config = await loadConfig(compass, materials, values, 'cane')
  assert.equal(config.defaults?.material, 'teak')
  for (const name of ['SeatCane', 'BackCane', 'SeatCaneSpline', 'BackCaneSpline']) assert.equal(config.parts?.[name]?.skip, true, name)
})

test('loadConfig: the leather compass armchair skips its upholstery and plywood, mills its cleats and fillets', async () => {
  const values = camValues(masters, await defaultValues('compass-armchair', 'leather'))
  const config = await loadConfig(compass, materials, values, 'leather')
  for (const name of ['SeatCushion', 'BackPad', 'SeatBoard', 'BackBoard']) assert.equal(config.parts?.[name]?.skip, true, name)
  assert.equal(config.parts?.SeatCane, undefined)
  for (const name of ['SeatCleatLeft', 'SeatCleatRight', 'FrontSeatCleat', 'RearSeatCleat', 'LowBackFillet', 'HighBackFillet']) {
    assert.notEqual(config.parts?.[name]?.skip, true, name)
  }
})

// A module of its own, written for the test, whose config says what its CAM was given.
test('loadConfig: CAM is given the values and the variant', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'integral-cam-config-'))
  try {
    const module = join(dir, 'fixture.ts')
    writeFileSync(module, "export const CAM = (values, variant) => ({ defaults: { material: variant === 'teak' ? 'teak' : 'cherry' }, parts: { [`Board${values.T}`]: { skip: true } } })\n")
    assert.deepEqual(await loadConfig(module, materials, { T: 19 }, 'teak'), { defaults: { material: 'teak' }, parts: { Board19: { skip: true } } })
    assert.deepEqual(await loadConfig(module, materials, { T: 19 }, 'default'), { defaults: { material: 'cherry' }, parts: { Board19: { skip: true } } })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// The desk's parts are its Rhino STEP's solids: a solid renamed or added in Rhino and missed by the config would be
// cut as oak.
test('loadConfig: every solid of the desk is of one stock, oak unless plywood, its turned legs skipped', async () => {
  const { SOURCE, STOCK } = await import('../desk/desk.ts')
  const solids = stepSolidNames(readFileSync(SOURCE, 'utf8'))
  const listed = Object.values(STOCK).flat()
  assert.deepEqual([...listed].sort(), [...solids].sort())
  const config = await loadConfig(configFile(ROOT, 'desk'), materials, {}, 'default')
  assert.equal(config.defaults?.material, 'oak')
  for (const name of [...STOCK.ply18, ...STOCK.ply12, ...STOCK.ply6]) assert.equal(config.parts?.[name]?.material, 'birch-ply', name)
  for (const name of [...STOCK.oak30, ...STOCK.oak18]) assert.equal(config.parts?.[name], undefined, name)
  for (const name of STOCK.turned) assert.equal(config.parts?.[name]?.skip, true, name)
})
