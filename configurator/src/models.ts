// The parts the configurator knows: every `<folder>/<folder>.model.ts` at the repository's root, picked up by its
// file, nothing to register. A model file exports its `schema` (leva controls, keyed by the part's parameter
// names) and `build(values)`, which makes the part as a three.js object.
/// <reference types="vite/client" />
import type { Object3D } from 'three'

/** One slider: the default, its range, the step, and what the parameter means. */
export interface Control {
  value: number
  min: number
  max: number
  step: number
  hint: string
  /**
   * Shown at the top level of the configurator; every other master goes in its Details folder. A master is main when
   * it changes what the user sees or feels of the piece, its size or its posture: the dimensions of use (overall width,
   * seat height and depth, arm or back height), the back's lean, the board thickness (the stock bought). It stays under
   * Details when it only changes how the piece is made, or a proportion set once from the original drawing: joinery,
   * the feet's positions, rail offsets, the back's bow, grips and profile details. A handful per model; masters that
   * only make sense together (the four foot positions) stay under Details rather than be separate main sliders.
   */
  main?: true
  /**
   * The value the CAM files' geometry is built with, whatever the configurator's: a finish the router does not cut, made
   * by hand on the cut part (an edge round, 0 there). `pnpm build:parts` writes that geometry as `<part>.cam.step`.
   */
  cam?: number
}

/** What a part's model file exports: its leva `schema` and the `build` that makes the part from the schema's values. */
export type Model = {
  schema: Record<string, Control>
  build: (values: Record<string, number>) => Object3D | Promise<Object3D>
}

/** The model files, keyed by their path relative to this file: `../../<folder>/<folder>.model.ts`. */
const files = import.meta.glob<Model>('../../*/*.model.ts')

/** The parts by name, as the `?part=` parameter spells them (the folder's name); each loads its model file on demand. */
export const models: Record<string, () => Promise<Model>> = Object.fromEntries(
  Object.entries(files).flatMap(([path, load]) => {
    const [, folder, file] = path.split('/').slice(-3)
    // The file is `<folder>/<folder>.model.ts`: anything else in the glob is not a part.
    return file === `${folder}.model.ts` ? [[folder, load]] : []
  }),
)
