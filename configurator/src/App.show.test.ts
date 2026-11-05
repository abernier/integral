// The Show folder: the roles a part's meshes play, and hiding them by role; and the one roleOf they are read by.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BufferGeometry, Group, Mesh, type Object3D } from 'three'

import { rolesOf, showRoles } from './App.show.ts'
import { roleOf } from './models.roles.ts'

/** A mesh of that role; none, or an empty one, for a mesh that names none. */
function mesh(role?: string) {
  const mesh = new Mesh(new BufferGeometry())
  if (role !== undefined) mesh.userData.role = role
  return mesh
}

/** A cane mesh, and wood ones: named, nested, empty, unnamed. */
function chair() {
  const nested = new Group().add(mesh('wood'), mesh(''))
  return new Group().add(mesh('cane'), mesh('wood'), nested, mesh())
}

/** The visibility of the shape's meshes of that role, in order. */
function visible(shape: Object3D, role: string) {
  const found: boolean[] = []
  shape.traverse((object) => {
    if (object instanceof Mesh && roleOf(object.userData.role) === role) found.push(object.visible)
  })
  return found
}

test('roleOf: the role named; wood when none is (missing or empty); a name that is no role throws', () => {
  assert.equal(roleOf('cushion'), 'cushion')
  assert.equal(roleOf(undefined), 'wood')
  assert.equal(roleOf(''), 'wood')
  assert.throws(() => roleOf('part'), /no role part \(known: wood, cane, support, cushion\)/)
  assert.throws(() => roleOf('Cane'), /no role Cane/)
})

test('rolesOf: the distinct roles, in order, a mesh without one (or with an empty one) being wood', () => {
  assert.deepEqual(rolesOf(chair()), ['cane', 'wood'])
  assert.deepEqual(rolesOf(new Group().add(mesh(), mesh())), ['wood'])
  assert.deepEqual(rolesOf(new Group()), [])
})

test('showRoles: hides the meshes of a role off, shows the others, and a role it does not name stays on', () => {
  const shape = chair()
  showRoles(shape, { wood: true, cane: false })
  assert.deepEqual(visible(shape, 'wood'), [true, true, true, true])
  assert.deepEqual(visible(shape, 'cane'), [false])
  showRoles(shape, { cane: true })
  assert.deepEqual(visible(shape, 'cane'), [true])
  assert.deepEqual(visible(shape, 'wood'), [true, true, true, true])
  showRoles(shape, { wood: false })
  assert.deepEqual(visible(shape, 'wood'), [false, false, false, false])
})
