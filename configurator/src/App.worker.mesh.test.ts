// A built part across the worker's boundary: what survives the trip, and what is handed over rather than copied.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh, MeshStandardMaterial, type Object3D } from 'three'

import { fromShapeData, toShapeData } from './App.worker.mesh.ts'

/** A triangle, its normals given or not. */
function triangle(normals: boolean) {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3))
  if (normals) geometry.setAttribute('normal', new BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), 3))
  return geometry
}

/** The meshes of a shape, in order. */
function meshes(shape: Object3D) {
  const found: Mesh[] = []
  shape.traverse((object) => {
    if (object instanceof Mesh) found.push(object)
  })
  return found
}

test('names, roles, materials and arrays survive the trip; the buffers are listed for transfer', () => {
  const wood = new Mesh(triangle(true), new MeshStandardMaterial({ color: '#9b6a3c', roughness: 0.7 }))
  wood.name = 'seat'
  wood.userData.role = 'wood'
  const board = new Mesh(triangle(false), new MeshStandardMaterial({ color: '#a8603a', roughness: 0.6, side: DoubleSide }))
  board.name = 'back'
  const shape = new Group().add(wood, board)
  shape.name = 'chair'
  const position = wood.geometry.getAttribute('position').array

  const { data, transfer } = toShapeData(shape)
  assert.equal(transfer.length, 3, 'two positions and one normal')
  assert.ok(transfer.includes(position.buffer as ArrayBuffer))

  const made = fromShapeData(data)
  assert.equal(made.name, 'chair')
  const [seat, back] = meshes(made)
  assert.equal(seat.name, 'seat')
  assert.equal(seat.userData.role, 'wood')
  assert.equal(back.userData.role, 'wood', 'a mesh that names no role is wood')
  assert.deepEqual([...seat.geometry.getAttribute('normal').array], [0, 0, 1, 0, 0, 1, 0, 0, 1])
  assert.ok(back.geometry.getAttribute('normal'), 'normals computed when the model gave none')
  const material = back.material as MeshStandardMaterial
  assert.equal(material.color.getHexString(), 'a8603a')
  assert.equal(material.roughness, 0.6)
  assert.equal(material.side, DoubleSide)
})

test('a mesh placed in its group crosses in its world placement', () => {
  const mesh = new Mesh(triangle(true), new MeshStandardMaterial())
  mesh.position.set(10, 0, 0)
  const group = new Group().add(mesh)
  group.position.set(0, 5, 0)
  const [made] = meshes(fromShapeData(toShapeData(new Group().add(group)).data))
  assert.deepEqual([...made.geometry.getAttribute('position').array.slice(0, 3)], [10, 5, 0])
})

test('a buffer two meshes share is listed once', () => {
  const geometry = triangle(false)
  const material = new MeshStandardMaterial()
  const { transfer } = toShapeData(new Group().add(new Mesh(geometry, material), new Mesh(geometry, material)))
  assert.equal(transfer.length, 1)
})
