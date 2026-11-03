// Every part's model file, found the way models.ts finds them (its `import.meta.glob` does not exist under node, so
// the files are imported directly): the sliders make sense, and the part builds from them.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Box3, Mesh, type Object3D } from 'three'

import { parts } from '../../scripts/paths.ts'
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
