// A model's CAM config: what Fusion cannot know from the STEP, the `CAM` export of the model's own module
// (`<model>/<model>.ts`), typed `CamConfig`. Optional: without one, every part is cut on the sheets, with the
// defaults.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { machiningProblems, type MachiningOptions } from './machining.ts'

/**
 * A setup of a part alone, to its own file `<Part>_<name>.sbp`, beside its sheet: what Arrange cannot do, a part on a
 * wedge.
 */
export type Setup = {
  /** The file's suffix: letters, digits, - and _. */
  name: string
  /** The wedge the part lies on, degrees: for the maker, it is not modelled. */
  wedge?: number
  /** [x, y, z] degrees, applied in that order about the part's box centre: the part as it lies on the wedge. */
  rotate?: [number, number, number]
  /**
   * `squared`: only the faces the turn squares (upright turned, not as modelled; the part must be modelled flat).
   * Without it, the part's pockets and outline.
   */
  cut?: 'squared'
}

/** How one part is cut, when not as the others. */
export type PartConfig = {
  /** No CAM for this part. */
  skip?: boolean
  /** Laid largest planar face up, not down. */
  flip?: boolean
  /** Its own material (materials.json), instead of the model's. */
  material?: string
  /** Degrees its grain is turned off its length (0, the default: along its longest side), for a material with grain. */
  grain?: number
  /** Setups of the part alone, each to its own file. */
  setups?: Setup[]
}

/** A model's CAM config: its `CAM` export. */
export type CamConfig = {
  /** The machining values (see machining.ts) and the post, for every part. */
  defaults?: MachiningOptions & { post?: string }
  /** Per part, by its STEP component's name. */
  parts?: Record<string, PartConfig>
}

/** A model's module: where its `CAM` is exported. */
export function configFile(root: string, model: string) {
  return join(root, model, `${model}.ts`)
}

/**
 * The `CAM` export of a model's module (none: every part, the defaults), checked for what its type cannot say:
 * machining values in range, materials of materials.json, setup names fit for a file name.
 */
export async function loadConfig(file: string): Promise<CamConfig> {
  const { CAM: config = {} } = (await import(pathToFileURL(file).href)) as { CAM?: CamConfig }
  if (config.defaults) {
    const problems = machiningProblems(config.defaults)
    if (problems.length) throw new Error(`${file}: CAM.defaults: ${problems.join('; ')}`)
  }
  for (const [name, part] of Object.entries(config.parts ?? {})) {
    const problems = machiningProblems({ material: part.material })
    if (problems.length) throw new Error(`${file}: CAM.parts.${name}: ${problems.join('; ')}`)
    for (const setup of part.setups ?? []) {
      if (!/^[\w-]+$/.test(setup.name)) throw new Error(`${file}: CAM.parts.${name}: setup name "${setup.name}" (letters, digits, - and _)`)
    }
  }
  return config
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
