/**
 * A part's variants (`Variants`, models.ts): the implicit one of a part that declares none, the default, and the
 * schema a variant starts from. Pure, without vite's `import.meta.glob`, so that the scripts can use it under node.
 * @module
 */
import type { Control, Variants } from './models.ts'

/** The id of the one variant of a part that declares none: its masters' defaults, as they are. */
export const IMPLICIT_VARIANT = 'default'

/** A part's variants: its own, or the implicit one when it declares none (or an empty set). */
export function variantsOf(variants: Variants | undefined): Variants {
  if (variants && Object.keys(variants).length > 0) return variants
  return { [IMPLICIT_VARIANT]: { label: 'Default', hint: 'The part as its masters make it' } }
}

/** The default variant's id: the first. */
export function defaultVariant(variants: Variants | undefined) {
  return Object.keys(variantsOf(variants))[0]
}

/** The schema with the variant's defaults in place of the masters' (clamped to each range); every other key as it was. */
export function variantSchema<S extends Record<string, Control>>(schema: S, variants: Variants | undefined, id: string): S {
  const values = variantsOf(variants)[id]?.values ?? {}
  return Object.fromEntries(
    Object.entries(schema).map(([name, control]) => {
      const value = values[name]
      if (value === undefined) return [name, control]
      return [name, { ...control, value: Math.min(control.max, Math.max(control.min, value)) }]
    }),
  ) as S
}

/** Whether a master means something in the variant: it names none, or names this one. */
export function usedIn(control: Control, id: string) {
  return !control.variants || control.variants.includes(id)
}
