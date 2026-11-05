// Every part's model file, found the way models.ts finds them (its `import.meta.glob` does not exist under node, so
// the files are imported directly): the sliders make sense, and the part builds from them.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Box3, Mesh, type Object3D } from 'three'

import { loadMasters } from '../../scripts/masters.ts'
import { parts } from '../../scripts/paths.ts'
import { RESERVED_KEYS } from './App.url.ts'
import type { Control, Model } from './models.ts'

/** The schema's defaults, by name. */
function defaults(schema: Record<string, Control>) {
  return Object.fromEntries(Object.entries(schema).map(([name, { value }]) => [name, value]))
}

/** Every value at one end of its range. */
function corner(schema: Record<string, Control>, end: 'min' | 'max') {
  return Object.fromEntries(Object.entries(schema).map(([name, control]) => [name, control[end]]))
}

/** The names of the meshes in a built part. */
function meshNames(shape: Object3D) {
  const names: string[] = []
  shape.traverse((object) => {
    if (object instanceof Mesh) names.push(object.name)
  })
  return names
}

for (const part of parts()) {
  test(`${part}: every slider has its default in range, a positive step and a hint`, async () => {
    const { schema }: Model = await import(`../../${part}/${part}.model.ts`)
    assert.ok(Object.keys(schema).length > 0, 'no sliders')
    for (const [name, { value, min, max, step, hint }] of Object.entries(schema)) {
      assert.ok(min <= value && value <= max, `${name}: default outside its range`)
      assert.ok(step > 0, `${name}: step must be positive`)
      assert.ok(typeof hint === 'string' && hint.trim() !== '', `${name}: no hint`)
    }
  })

  // A master named after a fixed key of the URL would be read and written as that key, not as a slider.
  test(`${part}: no slider takes a name the URL reserves`, async () => {
    const { schema }: Model = await import(`../../${part}/${part}.model.ts`)
    for (const name of RESERVED_KEYS) assert.ok(!Object.hasOwn(schema, name), `${name}: reserved by the URL`)
  })

  test(`${part}: at least one slider is main, and every main one is a master`, async () => {
    const { schema }: Model = await import(`../../${part}/${part}.model.ts`)
    const masters = await loadMasters(part)
    const main = Object.keys(masters).filter((name) => masters[name].main)
    assert.ok(main.length > 0, 'no main master')
    for (const name of main) assert.ok(Object.hasOwn(schema, name), `${name}: main, but not one of the sliders`)
  })

  test(`${part}: builds from its defaults into named meshes with a finite bounding box`, async () => {
    const { schema, build }: Model = await import(`../../${part}/${part}.model.ts`)
    const shape = await build(defaults(schema))
    const names = meshNames(shape)
    assert.ok(names.length >= 1, 'no mesh')
    for (const name of names) assert.ok(name.trim() !== '', 'mesh without a name')
    const box = new Box3().setFromObject(shape)
    assert.ok(!box.isEmpty(), 'empty bounding box')
    for (const n of [...box.min.toArray(), ...box.max.toArray()]) assert.ok(Number.isFinite(n), 'bounding box not finite')
  })
}

// Its JSDoc promises that any combination of the sliders builds: the corners of the range are the hardest.
for (const end of ['min', 'max'] as const) {
  test(`compass-armchair: builds with every slider at its ${end}`, async () => {
    const { schema, build }: Model = await import('../../compass-armchair/compass-armchair.model.ts')
    await assert.doesNotReject(async () => build(corner(schema, end)))
  })
}

// The side rail tenons sit under the cane groove: the wood left above and below each one is a wall, thinnest at the
// shallowest rail with the deepest groove and the tallest tenon.
test('compass-armchair: the side rail tenons keep a 2.5 mm wall of wood above and below at every corner', async () => {
  const { schema }: Model = await import('../../compass-armchair/compass-armchair.model.ts')
  const wall = (schema.RAIL_H.min - schema.GROOVE_D.max - schema.TENON_H.max) / 2
  assert.ok(wall >= 2.5, `wall of ${wall} mm, under 2.5 mm`)
})
