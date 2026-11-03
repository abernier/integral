// A model's CAM config: what Fusion cannot know from the STEP, the `CAM` export of the model's own module
// (`<model>/<model>.ts`), a function of the masters' values returning a `CamConfig`: a wedge follows the angle the
// part was built with. Optional: without one, every part is cut on the sheets, with the defaults.

import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Values } from '../masters.ts'
import { machiningProblems, type MachiningOptions, type Material } from './machining.ts'

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
   * `all`, the default: the part's pockets and outline.
   */
  cut?: 'squared' | 'all'
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

/** A model's CAM config: what its `CAM` export returns. */
export type CamConfig = {
  /** The machining values (see machining.ts) and the post (default DEFAULT_POST), for every part. */
  defaults?: MachiningOptions & { post?: string }
  /** Per part, by its STEP component's name. */
  parts?: Record<string, PartConfig>
}

/** A model's module: where its `CAM` is exported. */
export function configFile(root: string, model: string) {
  return join(root, model, `${model}.ts`)
}

/**
 * The CAM config of a model's module for the model made with `values` (no `CAM` export: every part, the defaults),
 * checked for what its type cannot say: machining values in range, materials of `materials` (materials.json), setup
 * names fit for a file name.
 */
export async function loadConfig(file: string, materials: Record<string, Material>, values: Values): Promise<CamConfig> {
  const { CAM } = (await import(pathToFileURL(file).href)) as { CAM?: (values: Values) => CamConfig }
  const config = CAM?.(values) ?? {}
  if (config.defaults) {
    const problems = machiningProblems(config.defaults, materials)
    if (problems.length) throw new Error(`${file}: CAM.defaults: ${problems.join('; ')}`)
  }
  for (const [name, part] of Object.entries(config.parts ?? {})) {
    const problems = machiningProblems({ material: part.material }, materials)
    if (problems.length) throw new Error(`${file}: CAM.parts.${name}: ${problems.join('; ')}`)
    for (const setup of part.setups ?? []) {
      if (!/^[\w-]+$/.test(setup.name)) throw new Error(`${file}: CAM.parts.${name}: setup name "${setup.name}" (letters, digits, - and _)`)
    }
  }
  return config
}
