// The build cache: what it keeps, what it frees, and what a failed build shows in its place.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BufferGeometry, Mesh, MeshBasicMaterial, type Object3D } from 'three'

import { buildKey, createBuilds } from './App.build.ts'
import { Superseded } from './App.latest.ts'

const disposed = new WeakSet<Object3D>()

/** A shape that records its own disposal, through its geometry's `dispose` event. */
function shape() {
  const mesh = new Mesh(new BufferGeometry(), new MeshBasicMaterial())
  mesh.geometry.addEventListener('dispose', () => disposed.add(mesh))
  return mesh
}

/**
 * A model whose builds the test settles by hand, one per key, named after its values' first name and, but for the
 * default, its variant (`A`, `A/cane`); `fail` rejects, `throw` throws at once.
 */
function fakeModel() {
  const shapes = new Map<string, Object3D>()
  const settle = new Map<string, { resolve: () => void; reject: () => void }>()
  const model = {
    build: (values: Record<string, number>, variant: string) => {
      const name = Object.keys(values)[0] + (variant === 'default' ? '' : `/${variant}`)
      if (name === 'throw') throw new Error('thrown')
      const built = shape()
      shapes.set(name, built)
      return new Promise<Object3D>((resolve, reject) => {
        settle.set(name, { resolve: () => resolve(built), reject: () => reject(new Error(`${name} failed`)) })
      })
    },
  }
  return { model, shapes, settle }
}

/** A key, as the component makes it, of the default variant unless named. */
const key = (name: string, variant = 'default') => buildKey(variant, { [name]: 1 })

/** Lets every pending `then` run. */
const flush = () => new Promise((resolve) => setTimeout(resolve))

test('the same key gives the same build', () => {
  const build = createBuilds(3)
  const { model } = fakeModel()
  assert.equal(build(model, key('A')), build(model, key('A')))
})

test('the variant is part of the key, and reaches the build', async () => {
  const build = createBuilds(3)
  const { model, shapes, settle } = fakeModel()
  const plain = build(model, key('A'))
  const cane = build(model, key('A', 'cane'))
  assert.notEqual(plain, cane)
  await flush()
  settle.get('A/cane')!.resolve()
  assert.equal((await cane).shape, shapes.get('A/cane'))
})

test('a build that throws at once fails like one that rejects, and borrows the last good shape', async () => {
  const build = createBuilds(3)
  const { model, shapes, settle } = fakeModel()
  const a = build(model, key('A'))
  await flush()
  settle.get('A')!.resolve()
  await a
  const thrown = await build(model, key('throw'))
  assert.equal(thrown.error, 'thrown')
  assert.equal(thrown.shape, shapes.get('A'))
})

test('a hit makes a build the newest: the least recently used one is freed, not the oldest', async () => {
  const build = createBuilds(3)
  const { model, shapes, settle } = fakeModel()
  for (const name of ['A', 'B']) {
    build(model, key(name))
    await flush()
    settle.get(name)!.resolve()
  }
  build(model, key('A'))
  for (const name of ['C', 'D']) {
    build(model, key(name))
    await flush()
    settle.get(name)!.resolve()
  }
  await flush()
  assert.ok(!disposed.has(shapes.get('A')!), 'A, just used, is kept')
  assert.ok(disposed.has(shapes.get('B')!), 'B, the least recently used, is freed')
})

test('a build that resolves after it was pushed out is freed, and never lent to a failed build', async () => {
  const build = createBuilds(1)
  const { model, shapes, settle } = fakeModel()
  build(model, key('A'))
  await flush()
  settle.get('A')!.resolve()
  await flush()
  build(model, key('B'))
  await flush()
  const c = build(model, key('C')) // pushes B out while it is still pending
  await flush()
  settle.get('B')!.resolve()
  await flush()
  settle.get('C')!.reject()
  const failed = await c
  assert.equal(failed.error, 'C failed')
  assert.equal(failed.shape, shapes.get('A'))
  assert.ok(disposed.has(shapes.get('B')!), 'B is freed')
  assert.ok(!disposed.has(shapes.get('A')!), 'A, lent to C, is kept')
})

test('the last good shape is kept while a failed build may borrow it, and freed once another replaces it', async () => {
  const build = createBuilds(1)
  const { model, shapes, settle } = fakeModel()
  build(model, key('A'))
  await flush()
  settle.get('A')!.resolve()
  await flush()
  const b = build(model, key('B')) // pushes A out, the last good shape
  await flush()
  settle.get('B')!.reject()
  assert.equal((await b).shape, shapes.get('A'))
  await flush()
  assert.ok(!disposed.has(shapes.get('A')!), 'A, lent to B, is kept')
  build(model, key('C')) // pushes B out: a failed build frees nothing of its own
  await flush()
  settle.get('C')!.resolve()
  await flush()
  assert.ok(disposed.has(shapes.get('A')!), 'A, replaced by C, is freed')
  assert.ok(!disposed.has(shapes.get('C')!), 'C is on screen')
})

test('a superseded build shows the last good shape without an error, and is built again when asked again', async () => {
  const build = createBuilds(3)
  const { model, shapes, settle } = fakeModel()
  build(model, key('A'))
  await flush()
  settle.get('A')!.resolve()
  await flush()
  let calls = 0
  const superseding = { build: () => (calls++ === 0 ? Promise.reject(new Superseded()) : model.build({ B: 1 }, 'default')) }
  const b = await build(superseding, key('B'))
  assert.equal(b.error, undefined)
  assert.equal(b.shape, shapes.get('A'))
  const again = build(superseding, key('B'))
  await flush()
  settle.get('B')!.resolve()
  assert.equal((await again).shape, shapes.get('B'))
})
