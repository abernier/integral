// What every part's build shares: the module it is, the script API it is given, and how a part ends.
//
// A part's module, `<part>/<part>.ts`: its default export (`PartBuild`) builds the part with ClassCAD, on an empty
// drawing, from every master's value in one of its variants; its optional `CAM(values, variant)` export
// (scripts/cam.config.ts) says how `pnpm cam` cuts the part so made. The variant is an id of the masters module's
// VARIANTS (`<part>/<part>.masters.ts`, the first the default), or `default` for a part that has none
// (configurator/src/models.variants.ts): the values already hold the variant's defaults, so a build or a CAM reads
// the variant only for what no master says (a cane seat or a cushion). A part of one variant may leave it out.
// Its optional `ROLES` export (`Roles`) says what each body is; the build's image shows the wood alone.

import type { V1T } from '@classcad/api-js'
import type { Role } from '../configurator/src/models.roles.ts'
import type { Values } from './masters.ts'

/** The ClassCAD script API a part's build is given: its methods, and the structure tree. */
export type Api = {
  v1: V1T
  tree: (options?: { refresh?: boolean }) => Promise<Record<string, { class: string; children?: number[] }>>
}

/**
 * A part module's default export: build the part in the drawing from every master's `values` in `variant`; what it
 * returns is printed after the build (ids, volumes).
 */
export type PartBuild = (api: Api, values: Values, variant: string) => Promise<unknown>

/**
 * A part module's optional `ROLES` export: the role of each body not of wood, by its solid's name (`nameSolids`);
 * any name not listed is wood (`roleOf`, configurator/src/models.roles.ts).
 */
export type Roles = Record<string, Role>

/** A part's module, `<part>/<part>.ts`, as the build imports it. */
export type PartModule = { default: PartBuild; ROLES?: Roles }

/** The id a call created; the engine answers null when it created nothing. */
export async function created(call: Promise<{ result: number | null }>) {
  const { result } = await call
  if (result === null) throw new Error('ClassCAD created nothing')
  return result
}

/**
 * Name each board's last feature and its solid after the board, so the model tree, Buerligons and the STEP show
 * the boards by name; returns each board's volume.
 */
export async function nameSolids(api: Api, boards: Record<string, number>) {
  const tree = await api.tree({ refresh: true })
  const volumes: Record<string, number | undefined> = {}
  for (const [name, feature] of Object.entries(boards)) {
    const solid = tree[feature].children?.find((child) => tree[child]?.class === 'CC_Solid')
    if (solid === undefined) throw new Error(`${name}: no solid`)
    await api.v1.common.setObjectName({ id: feature, name })
    await api.v1.common.setObjectName({ id: solid, name })
    volumes[name] = (await api.v1.part.calculateMassProperties({ id: solid })).result?.volume
  }
  return volumes
}
