// The Show folder: the roles a part's meshes play, and hiding them by role.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BufferGeometry, Group, Mesh, type Object3D } from 'three'

import { roleOf, rolesOf, showRoles } from './App.show.ts'

/** A mesh of that role; none, or an empty one, for a mesh that names none. */
function mesh(role?: string) {
  const mesh = new Mesh(new BufferGeometry())
  if (role !== undefined) mesh.userData.role = role
  return mesh
}

/** Two wood meshes, one nested, a cane one, and two without a role. */
function chair() {
  const nested = new Group().add(mesh('wood'), mesh(''))
  return new Group().add(mesh('wood'), mesh('cane'), nested, mesh())
}

/** The visibility of the shape's meshes of that role, in order. */
function visible(shape: Object3D, role: string) {
  const found: boolean[] = []
  shape.traverse((object) => {
    if (object instanceof Mesh && roleOf(object) === role) found.push(object.visible)
  })
  return found
}

test('rolesOf: the distinct roles, in order, a mesh without one (or with an empty one) being part', () => {
  assert.deepEqual(rolesOf(chair()), ['wood', 'cane', 'part'])
  assert.deepEqual(rolesOf(new Group().add(mesh(), mesh())), ['part'])
  assert.deepEqual(rolesOf(new Group()), [])
})

test('showRoles: hides the meshes of a role off, shows the others, and a role it does not name stays on', () => {
  const shape = chair()
  showRoles(shape, { wood: true, cane: false })
  assert.deepEqual(visible(shape, 'wood'), [true, true])
  assert.deepEqual(visible(shape, 'cane'), [false])
  assert.deepEqual(visible(shape, 'part'), [true, true])
  showRoles(shape, { cane: true, part: false })
  assert.deepEqual(visible(shape, 'cane'), [true])
  assert.deepEqual(visible(shape, 'part'), [false, false])
})
