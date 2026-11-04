// A model's masters (`<model>/<model>.masters.ts`): their defaults, and a model made with values of one's own, given
// as the configurator's share link ("Copy link"): `?part=<model>&<MASTER>=<value>...`, only the values that differ
// from the defaults. The link is read as the configurator reads it (configurator/src/App.query.ts withQueryValues):
// the same link, the same part in the browser and on the CLI. Nothing here loads ClassCAD, so `pnpm cam` can use it.

import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { withQueryValues } from '../configurator/src/App.query.ts'
import type { Control } from '../configurator/src/models.ts'
import { ROOT, parts } from './paths.ts'

/** Every master's value of the model whose masters are `M`: what its `build` and `CAM` are given. */
export type Values<M extends Record<string, Control> = Record<string, Control>> = Record<keyof M, number>

/** A model's masters module: `<model>/<model>.masters.ts`. */
export function mastersFile(model: string) {
  return join(ROOT, model, `${model}.masters.ts`)
}

/** The MASTERS export of a model's masters module. */
export async function loadMasters(model: string) {
  const { MASTERS } = (await import(pathToFileURL(mastersFile(model)).href)) as { MASTERS?: Record<string, Control> }
  if (!MASTERS) throw new Error(`${model}/${model}.masters.ts exports no MASTERS`)
  return MASTERS
}

/** Every master's default value of a model. */
export async function defaultValues(model: string): Promise<Values> {
  const masters = await loadMasters(model)
  return Object.fromEntries(Object.entries(masters).map(([name, { value }]) => [name, value]))
}

/**
 * The model and every master's value a configurator link names: `part` is the model; each master's value is the
 * link's, clamped to its range, or the default when the link has none (unknown keys are ignored). Throws on a link
 * without `part`, or whose part is no model.
 */
export async function linkValues(link: string) {
  const url = new URL(link)
  const model = url.searchParams.get('part')
  if (!model) throw new Error(`${link}: no part (a configurator link: ?part=<model>&<MASTER>=<value>...)`)
  if (!parts().includes(model)) throw new Error(`${link}: no model ${model} (no ${model}/${model}.ts)`)
  const masters = withQueryValues(await loadMasters(model), url.searchParams)
  const values: Values = Object.fromEntries(Object.entries(masters).map(([name, { value }]) => [name, value]))
  return { model, values }
}
