/**
 * The panel's Show folder: the roles a built part's meshes play (`userData.role`, models.roles.ts `roleOf`), and which
 * of them are on screen. Pure of React, so that it is testable under node.
 * @module
 */
import { Mesh, type Object3D } from 'three'

import { type Role, roleOf } from './models.roles.ts'

/** The distinct roles of a shape's meshes, in the order the shape first shows them; a mesh naming none is wood. */
export function rolesOf(shape: Object3D) {
  const roles = new Set<Role>()
  shape.traverse((object) => {
    if (object instanceof Mesh) roles.add(roleOf(object.userData.role))
  })
  return [...roles]
}

/**
 * Shows the meshes whose role is on, hides the rest; a role `shown` does not name stays on.
 * @param shown On or off, by role.
 */
export function showRoles(shape: Object3D, shown: Partial<Record<Role, boolean>>) {
  shape.traverse((object) => {
    if (object instanceof Mesh) object.visible = shown[roleOf(object.userData.role)] ?? true
  })
}
