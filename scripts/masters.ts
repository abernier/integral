// A model made with values of one's own: a values file, every master's value, for one model, as the configurator's
// "Copy values" gives it:
//
//   { "$schema": "…/zigzag-chair/zigzag-chair.values.schema.json", "model": "zigzag-chair",
//     "values": { "T": 19, …, "BACK_LEAN": 10, … } }
//
// Every value, not the changed ones: the file means the same chair when a default changes later. The chair is always
// built by the current code, and its Zod schema, made from the model's MASTERS (`<model>/<model>.masters.ts`), is the
// one check: it refuses a file the code cannot build. A variant is named by the hash of its values, not by the file's
// name: the same values, the same folder (`variantHash`). The build writes the schema as JSON Schema beside the
// model's files, for editors. Shared by the build (`build.ts --values`) and `pnpm cam --values`. Nothing here loads
// ClassCAD, so `pnpm cam` can use it.

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import * as z from 'zod'
import { ROOT } from './paths.ts'

/** A master as the values need it: its default, its range and what it means (a configurator `Control`). */
export type Master = { value: number; min: number; max: number; hint: string }

/**
 * The schema of a values file for `model`, from its masters: every master a number in its range, no other key, the
 * model named.
 */
export function valuesSchema<M extends Record<string, Master>>(model: string, masters: M) {
  const values = Object.fromEntries(Object.entries(masters).map(([name, { min, max, hint }]) => [name, z.number().min(min).max(max).describe(hint)]))
  return z.strictObject({
    $schema: z.string().optional(),
    model: z.literal(model),
    values: z.strictObject(values as { [K in keyof M]: z.ZodNumber }),
  })
}

/** A values file of the model whose masters are `M`. */
export type ValuesFile<M extends Record<string, Master> = Record<string, Master>> = z.infer<ReturnType<typeof valuesSchema<M>>>

/** Every master's value of the model whose masters are `M`: what its `build` and `CAM` are given. */
export type Values<M extends Record<string, Master> = Record<string, Master>> = ValuesFile<M>['values']

/** A model's masters module: `<model>/<model>.masters.ts`. */
export function mastersFile(model: string) {
  return join(ROOT, model, `${model}.masters.ts`)
}

/** The MASTERS export of a model's masters module. */
export async function loadMasters(model: string) {
  const { MASTERS } = (await import(pathToFileURL(mastersFile(model)).href)) as { MASTERS?: Record<string, Master> }
  if (!MASTERS) throw new Error(`${model}/${model}.masters.ts exports no MASTERS`)
  return MASTERS
}

/** A model's values file schema as JSON Schema, for editors: the build writes it as `<model>.values.schema.json`. */
export async function valuesJsonSchema(model: string) {
  return z.toJSONSchema(valuesSchema(model, await loadMasters(model)))
}

/** Every master's default value of a model. */
export async function defaultValues(model: string): Promise<Values> {
  const masters = await loadMasters(model)
  return Object.fromEntries(Object.entries(masters).map(([name, { value }]) => [name, value]))
}

/**
 * A variant's identity: the sha256 of its values as JSON, keys in the masters' order, numbers as JSON numbers. Its
 * first 8 hex digits name its folder (`variantDir`).
 */
export function variantHash(masters: Record<string, Master>, values: Values) {
  const canonical = JSON.stringify(Object.fromEntries(Object.keys(masters).map((name) => [name, values[name]])))
  return createHash('sha256').update(canonical).digest('hex')
}

/**
 * A model's values file, checked: the file, its variant's hash and name (`variantHash`), every master's value.
 * Throws on a file that cannot be read, is not JSON, or that
 * the model's schema refuses.
 */
export async function loadValues(model: string, file: string) {
  const masters = await loadMasters(model)
  const schema = valuesSchema(model, masters)
  let json: unknown
  try {
    json = JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    throw new Error(`${file}: ${(error as Error).message}`)
  }
  // Another model's file would fail on every value: say so alone.
  const named = (json as { model?: unknown } | null)?.model
  if (typeof named === 'string' && named !== model) throw new Error(`${file}: the values of ${named}, not ${model}`)
  const parsed = schema.safeParse(json)
  if (!parsed.success) throw new Error(`${file}:\n${z.prettifyError(parsed.error)}`)
  const { values } = parsed.data
  const hash = variantHash(masters, values)
  return { file: resolve(file), hash, name: hash.slice(0, 8), values: values as Values }
}
