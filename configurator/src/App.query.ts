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

/** The values that differ from the schema's defaults, in the schema's order: what a link or a values file carries. */
export function changedValues(schema: Model['schema'], values: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.keys(schema).filter((name) => values[name] !== schema[name].value).map((name) => [name, values[name]]))
}

/** The link's parameters: `part` first, then only the values that differ from the schema's defaults, to keep the link short. */
export function changedParams(schema: Model['schema'], values: Record<string, number>, part: string): URLSearchParams {
  const params = new URLSearchParams({ part })
  for (const [name, value] of Object.entries(changedValues(schema, values))) params.set(name, String(value))
  return params
}

/**
 * A values file for `pnpm cam <part> --values <file.json>`, pretty-printed: every value (the file means the same part
 * when a default changes) and the part (scripts/masters.ts).
 * @param schemaUrl The values file's JSON Schema, which the build writes beside the part's files.
 */
export function valuesFile({ schema, values, part, schemaUrl }: { schema: Model['schema']; values: Record<string, number>; part: string; schemaUrl: string }): string {
  const all = Object.fromEntries(Object.keys(schema).map((name) => [name, values[name]]))
  return `${JSON.stringify({ $schema: schemaUrl, model: part, values: all }, null, 2)}\n`
}

/**
 * A values file read back into the sliders, checked as `pnpm cam --values` checks it (scripts/masters.ts, without its
 * Zod): no key but `$schema`, `model` and `values`; the model this part; every slider in `values`, no other, each a
 * number in its range. Either every value, or the problems: a file with any is not loaded at all.
 */
export function parseValuesFile(schema: Model['schema'], part: string, text: string): { values: Record<string, number> } | { problems: string[] } {
  let file: unknown
  try {
    file = JSON.parse(text)
  } catch (error) {
    return { problems: [`not JSON: ${error instanceof Error ? error.message : String(error)}`] }
  }
  if (typeof file !== 'object' || file === null || Array.isArray(file)) return { problems: ['not a values file: { "model", "values" }'] }
  const { $schema, model, values, ...others } = file as Record<string, unknown>
  const problems = Object.keys(others).map((key) => `unknown key "${key}"`)
  if ($schema !== undefined && typeof $schema !== 'string') problems.push('$schema: not a string')
  if (model !== part) return { problems: [typeof model === 'string' ? `the values of ${model}, not ${part}` : 'model: missing, or not a string', ...problems] }
  if (typeof values !== 'object' || values === null || Array.isArray(values)) return { problems: [...problems, 'values: missing, or not an object'] }
  const given = values as Record<string, unknown>
  for (const [name, { min, max }] of Object.entries(schema)) {
    const value = given[name]
    if (value === undefined) problems.push(`values.${name}: missing`)
    else if (typeof value !== 'number' || !Number.isFinite(value)) problems.push(`values.${name}: ${JSON.stringify(value)} is not a number`)
    else if (value < min || value > max) problems.push(`values.${name}: ${value} is out of [${min}, ${max}]`)
  }
  for (const name of Object.keys(given)) if (!Object.hasOwn(schema, name)) problems.push(`values.${name}: unknown key`)
  if (problems.length) return { problems }
  return { values: Object.fromEntries(Object.keys(schema).map((name) => [name, given[name] as number])) }
}
