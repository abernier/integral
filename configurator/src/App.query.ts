/**
 * The query string as the configurator's state: the sliders' initial values come from it, and a shared link carries
 * back only what the user changed. Pure, so that it is testable under node (no `location`, no leva).
 * @module
 */
import type { Model } from './models.ts'

/** The schema with the query's values as initial values: known keys only, numeric, clamped to min/max; a key that is missing, empty or not a number keeps the default. */
export function withQueryValues(schema: Model['schema'], params: URLSearchParams): Model['schema'] {
  return Object.fromEntries(
    Object.entries(schema).map(([name, control]) => {
      const raw = params.get(name)
      const fromQuery = raw === null || raw.trim() === '' ? NaN : Number(raw)
      if (!Number.isFinite(fromQuery)) return [name, control]
      return [name, { ...control, value: Math.min(control.max, Math.max(control.min, fromQuery)) }]
    }),
  )
}

/** The link's parameters: `part` first, then only the values that differ from the schema's defaults, to keep the link short. */
export function changedParams(schema: Model['schema'], values: Record<string, number>, part: string): URLSearchParams {
  const params = new URLSearchParams({ part })
  for (const [name, control] of Object.entries(schema)) {
    if (values[name] !== control.value) params.set(name, String(values[name]))
  }
  return params
}
