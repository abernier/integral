/**
 * The panel's Show folder: the roles a built part's meshes play (`userData.role`, models.ts), and which of them are on
 * screen. Pure of React, so that it is testable under node.
 * @module
 */
import { Mesh, type Object3D } from 'three'

/** The role of a mesh that names none. */
export const PART_ROLE = 'part'

/** A mesh's role: its `userData.role` when that is a non-empty string, else `part`. */
export function roleOf(mesh: Object3D) {
  const role: unknown = mesh.userData.role
  return typeof role === 'string' && role !== '' ? role : PART_ROLE
}

/** The distinct roles of a shape's meshes, in the order the shape first shows them. */
export function rolesOf(shape: Object3D) {
  const roles = new Set<string>()
  shape.traverse((object) => {
    if (object instanceof Mesh) roles.add(roleOf(object))
  })
  return [...roles]
}

/**
 * Shows the meshes whose role is on, hides the rest; a role `shown` does not name stays on.
 * @param shown On or off, by role.
 */
export function showRoles(shape: Object3D, shown: Record<string, boolean>) {
  shape.traverse((object) => {
    if (object instanceof Mesh) object.visible = shown[roleOf(object)] ?? true
  })
}
