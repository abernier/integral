// The parts the configurator knows: a part's model file exports its `schema` (leva controls, keyed by the part's
// parameter names) and `build(values)`, which makes the part as a three.js object.
import type { Object3D } from 'three'

/** What a part's model file exports: its leva `schema` and the `build` that makes the part from the schema's values. */
export type Model = {
  schema: Record<string, { value: number; min: number; max: number; step: number }>
  build: (values: Record<string, number>) => Object3D | Promise<Object3D>
}

/** The parts by name, as the `?part=` parameter spells them; each loads its model file on demand. */
export const models: Record<string, () => Promise<Model>> = {
  'zigzag-chair': () => import('../../zigzag-chair/zigzag-chair.model.ts'),
  'compass-armchair': () => import('../../compass-armchair/compass-armchair.model.ts'),
}
