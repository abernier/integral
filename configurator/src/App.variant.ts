/**
 * Switching variants in the panel: what becomes of the masters' values. Pure, so that it is testable under node.
 * @module
 */
import type { Model } from './models.ts'
import { variantSchema } from './models.variants.ts'

/**
 * The values once the panel switches from one variant to another, the user's tweaks applied on top: a master the user
 * changed (its value differs from the default of the variant left) keeps its value; every other master takes the
 * default of the variant chosen.
 * @param values The masters' current values, by name.
 */
export function switchedValues(model: Pick<Model, 'schema' | 'variants'>, from: string, to: string, values: Record<string, number>) {
  const before = variantSchema(model.schema, model.variants, from)
  const after = variantSchema(model.schema, model.variants, to)
  return Object.fromEntries(
    Object.keys(model.schema).map((name) => [name, values[name] !== before[name].value ? values[name] : after[name].value]),
  )
}
