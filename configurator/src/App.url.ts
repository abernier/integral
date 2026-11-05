/**
 * The configurator's URL state, through nuqs: `?part=<p>&<MASTER>=<v>...`. Every parser is derived here, at runtime,
 * from a part's schema (each master's value, min, max and step): nothing per part, nothing in the models. The hook
 * keeps the address bar on the state, the serializer makes Copy link's URL, and the loader reads a link outside
 * React (scripts/masters.ts). A value at its default is never written, so that a link carries only what was changed.
 *
 * The address bar is replaced, never pushed: a slider is not a page, and Back leaves the configurator instead of
 * stepping through every drag. In the docs site's iframe this matters twice: an entry pushed by the iframe joins the
 * docs page's own history, so that its Back button would rewind the sliders before leaving the page. A replace only
 * rewrites the iframe's current entry; the docs page's URL is never touched.
 * @module
 */
import { useMemo } from 'react'
import { createLoader, createParser, createSerializer, debounce, type LoaderInput, parseAsString, useQueryStates } from 'nuqs'
import type { Control, Model } from './models.ts'

/** How long the state stays still before the address bar follows: a drag writes once, when it pauses. */
const URL_DEBOUNCE_MS = 250

/** The masters' values, by name. */
export type Values = Record<string, number>

/**
 * A master's parser: a number, clamped to its range, otherwise kept as given; a value that is empty or not a number
 * reads as the default. It is not snapped to the step: leva's step grid is anchored on the slider's initial value
 * (here the URL's own value), not on the default, and its typed input does not snap at all, so that the URL keeps
 * the value leva wrote, exactly (`String` round-trips any number).
 */
function parseAsMaster({ value, min, max }: Control) {
  return createParser({
    parse(raw) {
      const number = raw.trim() === '' ? NaN : Number(raw)
      if (!Number.isFinite(number)) return null
      return Math.min(max, Math.max(min, number))
    },
    serialize: String,
  }).withDefault(value)
}

/** The parsers of the query: `part` first, then one per master of the part's schema (none before the model loads). */
function queryParsers(schema: Model['schema'] = {}) {
  const masters = Object.fromEntries(Object.entries(schema).map(([name, control]) => [name, parseAsMaster(control)]))
  return { part: parseAsString.withDefault(''), ...masters }
}

/**
 * The query as two fields: the part, and the masters' values. The masters' keys are only known at runtime, so that
 * the parsers' type cannot tell `part` from a master: the parsers above make `part` a string and every other a number.
 */
function split(query: Record<string, string | number>) {
  const { part, ...values } = query
  return { part: part as string, values: values as Values }
}

/**
 * The part and the masters' values a URL (or a bare query) names; a master it leaves out, or gets wrong, is its default.
 * @param schema The part's masters, whose parsers read the values.
 * @param input The URL, its query, or its search params.
 */
export function loadQuery(schema: Model['schema'], input: LoaderInput) {
  return split(createLoader(queryParsers(schema))(input))
}

/**
 * The URL for a part and its values: `base` with its query updated (`?part=` first when it has none), the values at
 * their defaults left out. With no base, the query alone (`?part=...`).
 * @param schema The part's masters, whose defaults are left out.
 * @param base The URL whose query is updated; empty for the query alone.
 */
export function queryUrl(schema: Model['schema'], { part, values }: { part: string; values: Values }, base = '') {
  return createSerializer(queryParsers(schema))(base, { part, ...values })
}

/**
 * The part and its masters' values, as the URL holds them, and a setter that writes the values back to the URL (by
 * replace, once they stay still). Without a schema (the model not loaded yet), only the part.
 * @param schema The part's masters; undefined until its model loads.
 */
export function useQuery(schema?: Model['schema']) {
  const parsers = useMemo(() => queryParsers(schema), [schema])
  const [query, setQuery] = useQueryStates(parsers, { history: 'replace', clearOnDefault: true, limitUrlUpdates: debounce(URL_DEBOUNCE_MS) })
  const setValues = (values: Values) => setQuery(values)
  return { ...split(query), setValues }
}
