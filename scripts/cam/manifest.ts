// A model's CAM manifest: what Fusion cannot know from the STEP. Optional: without one, every part is cut on the
// sheets, with the defaults.
//
// One format, two places: the build may generate `.docs/<model>/<model>.cam.json` beside the STEP; until it does, or
// to override it, a hand-written `<model>/cam.config.json`. `loadManifest` reads the first that exists.
//
// {
//   "version": 1,
//   "defaults": { "post": "shopbot", "sheet": [2440, 1220], "tabs": { "count": 4 } },   // all optional
//   "parts": [
//     { "part": "SeatCleat", "skip": true, "note": "the table saw" },   // no CAM for this part
//     { "part": "Back", "flip": true },                                  // laid largest planar face up, not down
//     {
//       "part": "Seat",
//       "setups": [{ "name": "wedge8", "wedge": 8, "rotate": [8, 0, 0], "cut": "squared" }]
//     }
//   ]
// }
//
// `part` is the STEP component's name. `defaults` holds the machining values (see cam/machining.ts) and the post.
//
// `setups`: setups of the part alone, each to its own file `<Part>_<name>.sbp`, beside its sheet (what Arrange
// cannot do: a part on a wedge). `rotate` is [x, y, z] in degrees, applied in that order about the part's box centre:
// the part as it lies on a wedge of `wedge` degrees (for the maker; the wedge is not modelled). `cut: "squared"`
// cuts only the faces the turn squares (upright turned, not as modelled; the part must be modelled flat); without
// it, the setup cuts the part's pockets and outline.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MACHINING_KEYS, machiningProblems, type MachiningOptions } from './machining.ts'

export type Setup = { name: string; wedge?: number; rotate?: [number, number, number]; cut?: 'squared' }

export type PartEntry = {
  part: string
  skip?: boolean
  flip?: boolean
  note?: string
  setups?: Setup[]
}

export type Manifest = {
  version: 1
  defaults?: MachiningOptions & { post?: string }
  parts: PartEntry[]
}

const DEFAULTS_KEYS = ['post', ...MACHINING_KEYS]
const PART_KEYS = ['part', 'skip', 'flip', 'note', 'setups']
const SETUP_KEYS = ['name', 'wedge', 'rotate', 'cut']

/** Where a model's manifest is read from, in order: the generated one, then the hand-written one. */
export function manifestPaths(root: string, docs: string, model: string) {
  return [join(docs, model, `${model}.cam.json`), join(root, model, 'cam.config.json')]
}

export function loadManifest(paths: string[]): { manifest: Manifest; from?: string } {
  const from = paths.find((path) => existsSync(path))
  if (!from) return { manifest: { version: 1, parts: [] } }
  const manifest = JSON.parse(readFileSync(from, 'utf8')) as Manifest
  const unknown = (where: string, entry: object, keys: string[]) => {
    for (const key of Object.keys(entry)) if (!keys.includes(key)) throw new Error(`${from}: ${where}: unknown key "${key}" (${keys.join(', ')})`)
  }
  if (manifest.version !== 1) throw new Error(`${from}: version ${manifest.version}, expected 1`)
  if (manifest.defaults) {
    unknown('defaults', manifest.defaults, DEFAULTS_KEYS)
    const problems = machiningProblems(manifest.defaults as Record<string, unknown>)
    if (problems.length) throw new Error(`${from}: defaults: ${problems.join('; ')}`)
  }
  if (!Array.isArray(manifest.parts)) throw new Error(`${from}: no "parts" array`)
  for (const part of manifest.parts) {
    if (typeof part.part !== 'string') throw new Error(`${from}: an entry of "parts" without "part"`)
    unknown(part.part, part, PART_KEYS)
    for (const setup of part.setups ?? []) {
      unknown(`${part.part}/${setup.name}`, setup, SETUP_KEYS)
      if (!/^[\w-]+$/.test(setup.name)) throw new Error(`${from}: ${part.part}: setup name "${setup.name}" (letters, digits, - and _)`)
      const rotate = setup.rotate
      if (rotate && (rotate.length !== 3 || rotate.some((a) => typeof a !== 'number'))) {
        throw new Error(`${from}: ${part.part}/${setup.name}: rotate must be [x, y, z] degrees`)
      }
      if (setup.cut !== undefined && setup.cut !== 'squared') {
        throw new Error(`${from}: ${part.part}/${setup.name}: cut "${setup.cut}", expected "squared" or none`)
      }
    }
  }
  return { manifest, from }
}

/**
 * The parts of an assembly STEP: the products its assembly uses (`NEXT_ASSEMBLY_USAGE_OCCURRENCE`'s related
 * `PRODUCT_DEFINITION`, its formation, its `PRODUCT`), in the file's order, each once. Read from the text: no CAD
 * kernel needed for a plan. Fusion names each component after its product.
 */
export function stepParts(stepFile: string) {
  const text = readFileSync(stepFile, 'utf8')
  const entities = new Map<string, string>()
  for (const m of text.matchAll(/#(\d+)\s*=\s*([A-Z_0-9]+\s*\([^;]*\))\s*;/g)) entities.set(m[1], m[2])
  const references = (entity: string | undefined) => [...(entity ?? '').matchAll(/#(\d+)/g)].map((m) => m[1])
  const names: string[] = []
  for (const entity of entities.values()) {
    if (!entity.startsWith('NEXT_ASSEMBLY_USAGE_OCCURRENCE')) continue
    // NEXT_ASSEMBLY_USAGE_OCCURRENCE(id, name, description, #relating, #related, ...)
    const definition = entities.get(references(entity)[1])
    const formation = entities.get(references(definition)[0])
    const product = entities.get(references(formation)[0])
    const name = /^PRODUCT\s*\(\s*'((?:[^']|'')*)'/.exec(product ?? '')?.[1].replace(/''/g, "'")
    if (name && !names.includes(name)) names.push(name)
  }
  return names
}
