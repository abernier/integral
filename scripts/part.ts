// What every part's build shares: the module it is, the script API it is given, and how a part ends.
//
// A part's module, `<part>/<part>.ts`: its default export (`PartBuild`) builds the part with ClassCAD, on an empty
// drawing, from every master's value in one of its variants; its optional `CAM(values, variant)` export
// (scripts/cam.config.ts) says how `pnpm cam` cuts the part so made. The variant is an id of the masters module's
// VARIANTS (`<part>/<part>.masters.ts`, the first the default), or `default` for a part that has none
// (configurator/src/models.variants.ts): the values already hold the variant's defaults, so a build or a CAM reads
// the variant only for what no master says (a cane seat or a cushion). A part of one variant may leave it out.
// Its optional `ROLES` export (`Roles`) says what each body is; the build's image shows the wood alone.
// A part modelled in another CAD system is not built from its masters but imported, its geometry a STEP of named
// solids committed in its folder (`importSolids`); it has no masters then (an empty MASTERS), and no configurator.

import { readFileSync } from 'node:fs'
import type { V1T } from '@classcad/api-js'
import type { Role } from '../configurator/src/models.roles.ts'
import type { Values } from './masters.ts'
import { stepSolidNames } from './step-assembly.ts'

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

/** An RGB colour, 0 to 255 each. */
export type Rgb = [number, number, number]

/**
 * Import the solids of a STEP file into a new part, each named after its solid in the file and coloured by
 * `colorOf`, so that the files the build writes keep the solids by name, as a parametric part's (`nameSolids`);
 * returns the part's id and each solid's volume, by name. ClassCAD's import (`part.importFeature`) keeps the
 * geometry where it was and numbers the solids `<name>_0`, `<name>_1`... in the file's order: they are named again
 * from the file (`stepSolidNames`). Each body also keeps its name from the file, the one ClassCAD writes back into
 * its STEP, prefixed with its product's (`Document: Top_Panel`, from Rhino): the file is imported with its products
 * unnamed, so that the STEP the build writes names each solid as the file did.
 * @param api The script API the build gives the part.
 * @param file The STEP file: every solid of it named, each name once.
 * @param name The part's name, and its import feature's.
 * @param colorOf A solid's colour, by its name.
 */
export async function importSolids(api: Api, file: string, name: string, colorOf: (solid: string) => Rgb) {
  const step = readFileSync(file, 'utf8')
  const names = stepSolidNames(step)
  if (names.includes('')) throw new Error(`${file}: a solid without a name`)
  const twice = names.filter((solid, i) => names.indexOf(solid) !== i)
  if (twice.length) throw new Error(`${file}: solids named twice: ${[...new Set(twice)].join(', ')}`)
  const part = await created(api.v1.part.create({ name }))
  // The engine runs in WebAssembly, out of reach of this machine's files: the file goes as data, its products unnamed.
  const data = Buffer.from(step.replace(/^(#\d+ ?= ?PRODUCT ?\()'(?:[^']|'')*' ?, ?'(?:[^']|'')*'/gm, "$1'', ''")).toString('base64')
  const feature = await created(api.v1.part.importFeature({ id: part, name, data, encoding: 'base64', format: 'STP' }))
  const tree = await api.tree({ refresh: true })
  const solids = (tree[feature].children ?? []).filter((child) => tree[child]?.class === 'CC_Solid')
  if (solids.length !== names.length) throw new Error(`${file}: ${names.length} solids in the file, ${solids.length} imported`)
  const volumes: Record<string, number | undefined> = {}
  for (const [i, solid] of solids.entries()) {
    await api.v1.common.setObjectName({ id: solid, name: names[i] })
    // A solid of the feature by its index, in the import's order.
    await api.v1.part.setAppearance({ target: { id: feature, indices: [i] }, color: colorOf(names[i]) })
    volumes[names[i]] = (await api.v1.part.calculateMassProperties({ id: solid })).result?.volume
  }
  return { part, volumes }
}
