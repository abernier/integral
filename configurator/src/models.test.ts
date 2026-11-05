// Every part's model file, found the way models.ts finds them (its `import.meta.glob` does not exist under node, so
// the files are imported directly): the sliders make sense, the variants too, and the part builds from them in each.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Box3, Mesh, type Object3D } from 'three'

import { loadMasters } from '../../scripts/masters.ts'
import { type PartModule, roleOf } from '../../scripts/part.ts'
import { parts } from '../../scripts/paths.ts'
import { RESERVED_KEYS } from './App.url.ts'
import type { Control, Model } from './models.ts'
import { usedIn, variantSchema, variantsOf } from './models.variants.ts'
import { camValues, hasCamValues } from './models.cam.ts'

/** The schema's defaults, by name. */
function defaults(schema: Record<string, Control>) {
  return Object.fromEntries(Object.entries(schema).map(([name, { value }]) => [name, value]))
}

/** Every value the variant uses at one end of its range; the masters it does not use at its defaults. */
function corner(schema: Record<string, Control>, id: string, end: 'min' | 'max') {
  return Object.fromEntries(Object.entries(schema).map(([name, control]) => [name, usedIn(control, id) ? control[end] : control.value]))
}

/** The names of the meshes in a built part. */
function meshNames(shape: Object3D) {
  const names: string[] = []
  shape.traverse((object) => {
    if (object instanceof Mesh) names.push(object.name)
  })
  return names
}

/**
 * A body's name as both kernels spell it, for matching: the ClassCAD solid's (`SeatCleatLeft`) and the mesh's
 * (`seat cleat`) alike, lowercase, no spaces, no side.
 */
const bodyKey = (name: string) => name.toLowerCase().replaceAll(' ', '').replace(/(left|right)$/, '')

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

  test(`${part}: every variant has an id as ?variant= spells it, and its defaults are masters in range`, async () => {
    const { schema, variants }: Model = await import(`../../${part}/${part}.model.ts`)
    for (const [id, { label, hint, values = {} }] of Object.entries(variantsOf(variants))) {
      assert.match(id, /^[a-z0-9-]+$/, `${id}: not lowercase letters, digits and dashes`)
      assert.ok(label.trim() !== '' && hint.trim() !== '', `${id}: no label or no hint`)
      for (const [name, value] of Object.entries(values)) {
        assert.ok(Object.hasOwn(schema, name), `${id}: ${name} is not a master`)
        assert.ok(schema[name].min <= value && value <= schema[name].max, `${id}: ${name} outside its range`)
      }
    }
  })

  test(`${part}: every master's variants are the part's`, async () => {
    const { schema, variants }: Model = await import(`../../${part}/${part}.model.ts`)
    const ids = Object.keys(variantsOf(variants))
    for (const [name, control] of Object.entries(schema)) {
      for (const id of control.variants ?? []) assert.ok(ids.includes(id), `${name}: no variant ${id}`)
    }
  })

  for (const id of Object.keys(variantsOf(await variantsOfPart(part)))) {
    test(`${part}, ${id}: builds from its defaults into named meshes with a finite bounding box and named roles`, async () => {
      const { schema, variants, build }: Model = await import(`../../${part}/${part}.model.ts`)
      const shape = await build(defaults(variantSchema(schema, variants, id)), id)
      const names = meshNames(shape)
      assert.ok(names.length >= 1, 'no mesh')
      for (const name of names) assert.ok(name.trim() !== '', 'mesh without a name')
      shape.traverse((object) => {
        const { role } = object.userData
        if (object instanceof Mesh && role !== undefined) assert.ok(typeof role === 'string' && role.trim() !== '', `${object.name}: a role, but not a name`)
      })
      // The ClassCAD part's roles (ROLES, the build's image shows the wood alone) are the meshes' (wood when unset).
      const { ROLES }: PartModule = await import(`../../${part}/${part}.ts`)
      shape.traverse((object) => {
        if (!(object instanceof Mesh)) return
        const role = object.userData.role ?? 'wood'
        const listed = Object.keys(ROLES ?? {}).filter((name) => bodyKey(name) === bodyKey(object.name))
        if (listed.length === 0) assert.equal(role, 'wood', `${object.name}: ${role}, but not in ${part}.ts ROLES`)
        for (const name of listed) assert.equal(roleOf(ROLES, name), role, `${object.name}: ${role}, but ${name} is ${roleOf(ROLES, name)} in ${part}.ts ROLES`)
      })
      const box = new Box3().setFromObject(shape)
      assert.ok(!box.isEmpty(), 'empty bounding box')
      for (const n of [...box.min.toArray(), ...box.max.toArray()]) assert.ok(Number.isFinite(n), 'bounding box not finite')
    })

    // What the panel builds with "Handwork" off.
    test(`${part}, ${id}: builds as the ShopBot cuts it (the masters' cam values)`, async () => {
      const { schema, variants, build }: Model = await import(`../../${part}/${part}.model.ts`)
      if (!hasCamValues(schema)) return
      await assert.doesNotReject(async () => build(camValues(schema, defaults(variantSchema(schema, variants, id))), id))
    })
  }
}

/** A part's variants, to name a test per variant: read from its model file before the tests are declared. */
async function variantsOfPart(part: string) {
  const { variants }: Model = await import(`../../${part}/${part}.model.ts`)
  return variants
}

// Its JSDoc promises that any combination of the sliders builds, in every variant: the corners of the range are the
// hardest. Each variant's corner moves the masters it uses; the others keep the variant's defaults.
for (const id of Object.keys(variantsOf(await variantsOfPart('compass-armchair')))) {
  for (const end of ['min', 'max'] as const) {
    test(`compass-armchair, ${id}: builds with every slider at its ${end}`, async () => {
      const { schema, variants, build }: Model = await import('../../compass-armchair/compass-armchair.model.ts')
      await assert.doesNotReject(async () => build(corner(variantSchema(schema, variants, id), id, end), id))
    })
  }
}

// The side rail tenons sit under the cane groove: the wood left above and below each one is a wall, thinnest at the
// shallowest rail with the deepest groove and the tallest tenon.
test('compass-armchair: the side rail tenons keep a 2.5 mm wall of wood above and below at every corner', async () => {
  const { schema }: Model = await import('../../compass-armchair/compass-armchair.model.ts')
  const wall = (schema.RAIL_H.min - schema.GROOVE_D.max - schema.TENON_H.max) / 2
  assert.ok(wall >= 2.5, `wall of ${wall} mm, under 2.5 mm`)
})

// GROOVE off, the groove left to the hand: no groove, no spline, the side rail tenons where GROOVE_D puts them.
test('compass-armchair: GROOVE 0 builds the cane without its splines, the rail tenons in place', async () => {
  const { schema, build }: Model = await import('../../compass-armchair/compass-armchair.model.ts')
  const tenons = (shape: Object3D) => {
    const corners: number[][] = []
    shape.traverse((object) => {
      if (object instanceof Mesh && object.name === 'rail tenon') corners.push(new Box3().setFromObject(object).min.toArray())
    })
    return corners
  }
  const on = await build(defaults(schema), 'cane')
  const off = await build({ ...defaults(schema), GROOVE: 0 }, 'cane')
  assert.equal(meshNames(on).filter((name) => name.endsWith('cane spline')).length, 2)
  assert.deepEqual(meshNames(off).filter((name) => name.endsWith('cane spline')), [])
  assert.equal(meshNames(off).length, meshNames(on).length - 2)
  assert.ok(meshNames(off).includes('seat cane') && meshNames(off).includes('back cane'))
  assert.equal(tenons(on).length, 4)
  assert.deepEqual(tenons(off), tenons(on))
})

test('compass-armchair: an unknown variant throws in the browser model, naming the known ones', async () => {
  const { build } = await import('../../compass-armchair/compass-armchair.model.ts')
  await assert.rejects(build({}, 'cushion'), /no variant cushion \(known: cane, leather\)/)
  await assert.rejects(build({}, ''), /no variant '' \(known: cane, leather\)/)
})
