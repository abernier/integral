// The parts the configurator knows: every `<folder>/<folder>.model.ts` at the repository's root, picked up by its
// file, nothing to register. A model file exports its `schema` (leva controls, keyed by the part's parameter
// names), its `variants` when it has more than one (models.variants.ts), and `build(values, variant)`, which makes
// the part as a three.js object.
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
   * by hand on the cut part (an edge round, 0 there). `pnpm build:parts` writes that geometry as
   * `<part>[.<variant>].cam.step`.
   */
  cam?: number
  /**
   * The variants this master means something in (their ids, models.variants.ts); every variant when omitted. A master
   * of no use in the current variant (the cane's thickness on a cushioned seat) is hidden from the panel, and its value
   * goes on unchanged.
   */
  variants?: readonly string[]
}

/**
 * A named version of a part (the chair with a cane seat, or with a leather cushion): its own defaults for some
 * masters, on top of the masters' own; what else it changes, the build reads from the variant's id.
 */
export interface Variant {
  /** Its name in the panel's list. */
  label: string
  /** What sets it apart, one line. */
  hint: string
  /** Its defaults, where they differ from the masters'. */
  values?: Record<string, number>
}

/**
 * A part's variants, by id (as `?variant=` spells it: lowercase letters, digits and dashes): the masters module's
 * `VARIANTS` export, the first one the default. A part that exports none has one, implicit (models.variants.ts).
 */
export type Variants = Record<string, Variant>

/**
 * What a part's model file exports: its leva `schema`, its `variants` (the masters module's `VARIANTS`, when it has
 * any), and the `build` that makes the part from the schema's values in one of its variants. Each mesh of the built
 * part may name its role in `userData.role` (`wood`, `cane`, `cushion`...): the panel's Show folder hides or shows
 * the meshes by role; a mesh without one is `part`.
 */
export type Model = {
  schema: Record<string, Control>
  variants?: Variants
  build: (values: Record<string, number>, variant: string) => Object3D | Promise<Object3D>
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
