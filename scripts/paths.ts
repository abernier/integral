// Where things are, for every script: the repository, the folder the build writes into, the models. Nothing here
// loads ClassCAD, so `pnpm cam` can use it.

import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

/** The repository's root. */
export const ROOT = resolve(import.meta.dirname, '..')

/**
 * Where the build writes each model's files (`.docs/<model>/`) and the docs site's MDX pages. Not named `.mdx`:
 * @pmndrs/docs takes every file whose path contains `.md` for a page.
 */
export const MDX = join(ROOT, '.docs')

/** The models (parts): each folder at the root holding its `<folder>/<folder>.ts`, by name. */
export function parts() {
  return readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(ROOT, entry.name, `${entry.name}.ts`)))
    .map((entry) => entry.name)
}

/** Where the build writes a model's variant, built with other values: `.docs/<model>/variants/<name>/`, the first 8 hex digits of its hash. */
export function variantDir(model: string, name: string) {
  return join(MDX, model, 'variants', name)
}

/** The JSON Schema of a model's values files (masters.ts), beside the model's own files whatever the variant: the configurator's files point at it. */
export function valuesSchemaFile(model: string) {
  return join(MDX, model, `${model}.values.schema.json`)
}
