/**
 * The part as the ShopBot cuts it: the masters' `cam` values (models.ts `Control.cam`), the finishes made by hand on
 * the cut parts left out. The CAM STEP is built with them (scripts/site.ts buildCamStep), and the configurator shows
 * them when its Show folder's "Handwork" is off. Pure, without vite's `import.meta.glob`, so that the scripts can
 * use it under node.
 * @module
 */
import type { Control } from './models.ts'

/** Whether some master has a `cam` value: the part has hand finishing to leave out. */
export function hasCamValues(masters: Record<string, Control>) {
  return Object.values(masters).some(({ cam }) => cam !== undefined)
}

/**
 * The values the cut parts are made with: `values`, but each master that has a `cam` value at that value (a finish
 * the router does not cut, such as an edge round, is 0 there and made by hand). The same object when no master has one.
 */
export function camValues<V extends Record<string, number>>(masters: Record<string, Control>, values: V): V {
  const overrides = Object.entries(masters).filter(([, { cam }]) => cam !== undefined)
  if (!overrides.length) return values
  return { ...values, ...Object.fromEntries(overrides.map(([name, { cam }]) => [name, cam as number])) }
}
