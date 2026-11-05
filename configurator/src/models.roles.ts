/**
 * What a part's body is: its role, the one list the browser model's meshes (`userData.role`), the ClassCAD part's
 * `ROLES` (scripts/part.ts), the configurator's Show folder and the build's image all read. Pure, without three or
 * vite, so that the scripts can use it under node.
 * @module
 */

/** The roles, in the Show folder's order: the wood, the cane and its splines, what holds the upholstery, the upholstery. */
export const ROLE_IDS = ['wood', 'cane', 'support', 'cushion'] as const

/** What a body is (`ROLE_IDS`). */
export type Role = (typeof ROLE_IDS)[number]

/**
 * The role of a body that names none: wood. Most bodies are the part's wood, so a part names only the others, and one
 * that names none (the zigzag chair) is all wood: the build's image, the part as cut, wood only, shows all of it, and
 * the Show folder has no toggle for it (one role).
 */
export const DEFAULT_ROLE: Role = 'wood'

/**
 * A body's role: the one it names (a mesh's `userData.role`, a `ROLES` entry), wood when it names none (missing or
 * empty). Throws on a name that is no role, so that a typo is not taken for wood.
 * @param named The role the body names, if any.
 */
export function roleOf(named: unknown): Role {
  if (named === undefined || named === null || named === '') return DEFAULT_ROLE
  if (typeof named === 'string' && (ROLE_IDS as readonly string[]).includes(named)) return named as Role
  throw new Error(`no role ${String(named)} (known: ${ROLE_IDS.join(', ')})`)
}
