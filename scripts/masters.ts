// A model's masters (`<model>/<model>.masters.ts`) and its variants (its optional VARIANTS export, the first the
// default; none: the one implicit variant, configurator/src/models.variants.ts): their defaults, and a model made
// with values of one's own, given as the configurator's share link ("Copy link"):
// `?part=<model>&variant=<id>&<MASTER>=<value>...`, only the values that differ from the variant's defaults, and
// `variant` only when it is not the default. The link is read as the configurator reads it
// (configurator/src/App.url.ts loadQuery): the same link, the same part in the browser and on the CLI.
// Nothing here loads ClassCAD, so `pnpm cam` can use it.

import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { LoaderInput } from 'nuqs'
import { loadQuery } from '../configurator/src/App.url.ts'
import { hasCamValues } from '../configurator/src/models.cam.ts'
import type { Control, Variants } from '../configurator/src/models.ts'
import { defaultVariant, variantSchema, variantsOf } from '../configurator/src/models.variants.ts'
import { ROOT, partFile, parts } from './paths.ts'

/** Every master's value of the model whose masters are `M`: what its `build` and `CAM` are given. */
export type Values<M extends Record<string, Control> = Record<string, Control>> = Record<keyof M, number>

/** A model's masters module: `<model>/<model>.masters.ts`. */
export function mastersFile(model: string) {
  return join(ROOT, model, `${model}.masters.ts`)
}

/** A model's masters module, imported: its MASTERS and its optional VARIANTS. */
async function mastersModule(model: string) {
  return (await import(pathToFileURL(mastersFile(model)).href)) as { MASTERS?: Record<string, Control>; VARIANTS?: Variants }
}

/** The MASTERS export of a model's masters module. */
export async function loadMasters(model: string) {
  const { MASTERS } = await mastersModule(model)
  if (!MASTERS) throw new Error(`${model}/${model}.masters.ts exports no MASTERS`)
  return MASTERS
}

/**
 * A model's variants, by id, the default first: its masters module's VARIANTS, or the implicit one without it.
 * @param model The model's name (its folder).
 */
export async function loadVariants(model: string) {
  return variantsOf((await mastersModule(model)).VARIANTS)
}

/**
 * The variant `id` names among `variants`, the default when `id` is missing (null, undefined or empty). Throws on an
 * id that is none of them, naming the known ones: unlike the configurator (App.url.ts), which falls back, a CLI
 * asked for a variant it cannot make says so.
 * @param variants The model's variants (variantsOf).
 * @param id The variant asked for: a link's `?variant=`, or `--variant`.
 */
export function checkedVariant(variants: Variants, id: string | null | undefined) {
  if (!id) return defaultVariant(variants)
  if (!Object.hasOwn(variants, id)) throw new Error(`no variant ${id} (known: ${Object.keys(variants).join(', ')})`)
  return id
}

/** Each master's current value, by name. */
function valuesOf(masters: Record<string, Control>): Values {
  return Object.fromEntries(Object.entries(masters).map(([name, { value }]) => [name, value]))
}

/**
 * Every master's default value of a model in one of its variants: the variant's own defaults (clamped to each
 * master's range), the masters' elsewhere. Throws on a variant the model does not have.
 * @param model The model's name (its folder).
 * @param variant The variant's id; the model's default variant when omitted.
 */
export async function defaultValues(model: string, variant?: string): Promise<Values> {
  const masters = await loadMasters(model)
  const variants = await loadVariants(model)
  return valuesOf(variantSchema(masters, variants, checkedVariant(variants, variant)))
}

/**
 * The variant and every master's value a link's query names, for a model of `masters` and `variants`: the variant
 * of `variant` (the default when missing), each master's value the query's, clamped to its range, or the variant's
 * default when the query has none (unknown keys are ignored). Read by the configurator's own loader (loadQuery), but
 * strict: an unknown variant throws, naming the known ones, where the configurator falls back to the default.
 * @param masters The model's MASTERS.
 * @param variants The model's variants (variantsOf).
 * @param params The link's query.
 */
export function queryValues(masters: Record<string, Control>, variants: Variants, params: LoaderInput) {
  const { variant, values } = loadQuery({ schema: masters, variants }, params, { strict: true })
  return { variant, values }
}

/**
 * The model, its variant and every master's value a configurator link names, the full link or its bare query
 * (`?part=<model>&variant=<id>&<MASTER>=<value>...`): `part` is the model, `variant` its variant (queryValues).
 * Throws on a link without `part`, whose part is no model, or whose variant is not one of the model's.
 * @param link The configurator's "Copy link", or its query.
 */
export async function linkValues(link: string) {
  // The base makes a bare query parse too; a full link ignores it.
  const url = new URL(link, 'http://localhost')
  const model = loadQuery({}, url).part
  if (!model) throw new Error(`${link}: no part (a configurator link: ?part=<model>&<MASTER>=<value>...)`)
  if (!parts().includes(model)) throw new Error(`${link}: no model ${model} (no ${model}/${model}.ts)`)
  const masters = await loadMasters(model)
  const variants = await loadVariants(model)
  try {
    return { model, ...queryValues(masters, variants, url) }
  } catch (error) {
    throw new Error(`${link}: ${model}: ${(error as Error).message}`)
  }
}

/**
 * The STEP `pnpm cam` reads for a model built into `folder` in one of its variants: `<model>[.<variant>].cam.step`
 * when some master has a `cam` value (`nr build:parts` writes it beside the plain STEP), else `<model>[.<variant>].step`
 * (paths.ts partFile: the default variant's names carry no variant).
 * @param variants The model's variants (loadVariants); the implicit one when omitted.
 * @param variant The variant's id; the default when omitted.
 */
export function camStepFile(masters: Record<string, Control>, folder: string, model: string, variants?: Variants, variant?: string) {
  const all = variantsOf(variants)
  return join(folder, partFile(model, all, variant ?? defaultVariant(all), hasCamValues(masters) ? 'cam.step' : 'step'))
}
