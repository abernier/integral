// Where things are, for every script: the repository, the folder the build writes into, the models, and how a
// variant's built files and CAM folder are named. Nothing here
// loads ClassCAD, so `pnpm cam` can use it.

import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Variants } from '../configurator/src/models.ts'
import { defaultVariant } from '../configurator/src/models.variants.ts'

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

/**
 * How a variant's outputs are named: the part's default variant keeps the part's plain names (its built files, its
 * CAM folder), so that the READMEs, the pages and the links made before the part had variants keep working; any
 * other variant is named by its id. Undefined for the default.
 */
function variantName(variants: Variants, variant: string) {
  return variant === defaultVariant(variants) ? undefined : variant
}

/**
 * The name of a part's built file in one of its variants: `<part>.<ext>` for the default variant,
 * `<part>.<variant>.<ext>` for another, all in `.docs/<part>/`.
 * @param part The part's name (its folder).
 * @param variants The part's variants (masters.ts loadVariants).
 * @param variant The variant's id.
 * @param ext The file's extension: `ofb`, `step`, `glb`, `png`.
 * @example partFile('compass-armchair', VARIANTS, 'leather', 'step') // 'compass-armchair.leather.step'
 */
export function partFile(part: string, variants: Variants, variant: string, ext: string) {
  const name = variantName(variants, variant)
  return name ? `${part}.${name}.${ext}` : `${part}.${ext}`
}

/**
 * The folder of a model's CAM files in one of its variants: `.docs/<model>/cam/` for the default variant,
 * `.docs/<model>/cam/<variant>/` for another, so that both can coexist.
 * @param model The model's name (its folder).
 * @param variants The model's variants (masters.ts loadVariants).
 * @param variant The variant's id.
 */
export function camFolder(model: string, variants: Variants, variant: string) {
  const name = variantName(variants, variant)
  return name ? join(MDX, model, 'cam', name) : join(MDX, model, 'cam')
}
