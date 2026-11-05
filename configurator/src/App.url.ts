/**
 * The configurator's URL state, through nuqs: `?part=<p>&variant=<id>&<MASTER>=<v>...`. Every parser is derived here,
 * at runtime, from a part's schema (each master's value, min, max and step) and its variants: nothing per part,
 * nothing in the models. The hook keeps the address bar on the state, the serializer makes Copy link's URL, and the
 * loader reads a link outside React (scripts/masters.ts). A value at its default is never written, so that a link
 * carries only what was changed: the default variant is left out, and each master's default is the selected variant's.
 *
 * The address bar is replaced, never pushed: a slider is not a page, and Back leaves the configurator instead of
 * stepping through every drag. In the docs site's iframe this matters twice: an entry pushed by the iframe joins the
 * docs page's own history, so that its Back button would rewind the sliders before leaving the page. A replace only
 * rewrites the iframe's current entry; the docs page's URL is never touched.
 * @module
 */
import { useMemo } from 'react'
import {
  createLoader,
  createParser,
  createSerializer,
  debounce,
  type LoaderInput,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from 'nuqs'
import { useEventCallback } from 'usehooks-ts'
import type { Control, Model } from './models.ts'
import { defaultVariant, variantSchema, variantsOf } from './models.variants.ts'

/** How long the state stays still before the address bar follows: a drag writes once, when it pauses. */
const URL_DEBOUNCE_MS = 250

/** The nuqs options of the configurator's state: replaced, never pushed, once it stays still; defaults left out. */
const OPTIONS = { history: 'replace', clearOnDefault: true, limitUrlUpdates: debounce(URL_DEBOUNCE_MS) } as const

/** The masters' values, by name. */
export type Values = Record<string, number>

/** What the URL's parsers are derived from: a part's masters and its variants (none: the one implicit variant). */
type Part = Pick<Model, 'schema' | 'variants'>

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

/**
 * The query's fixed keys, the ones that are not a master, for a part of `variants`: `part`, and `variant`, one of the
 * part's variant ids (an unknown one reads as the default, the first). This is their one record: their names are
 * reserved, so that no part may name a master after one (models.test.ts checks every part), and a new fixed key is
 * added here, and nowhere else.
 * @param variants The part's variants; none, the implicit one alone.
 */
function fixedParsers(variants?: Model['variants']) {
  return {
    part: parseAsString.withDefault(''),
    variant: parseAsStringLiteral(Object.keys(variantsOf(variants))).withDefault(defaultVariant(variants)),
  }
}

/** The names a master may not take: the query's fixed keys. */
export const RESERVED_KEYS = Object.keys(fixedParsers())

/**
 * The parsers of the query: the fixed keys first (the URL is written in this order: `?part=` first, then `variant`),
 * then one per master, its default the variant's (none before the model loads). A master named after a fixed key
 * would replace its parser: the reserved names keep that from happening.
 * @param variant The selected variant, whose defaults the masters' parsers take (variantSchema).
 */
function queryParsers({ schema = {}, variants }: Partial<Part>, variant: string) {
  const masters = Object.fromEntries(Object.entries(variantSchema(schema, variants, variant)).map(([name, control]) => [name, parseAsMaster(control)]))
  return { ...fixedParsers(variants), ...masters }
}

/**
 * The query as three fields: the fixed keys (the part, its variant), and the masters' values. The masters' names are
 * only known at runtime, so that the query's type has every other key as a string or a number: a master's parser makes
 * it a number, which is checked here rather than assumed.
 */
function split({ part, variant, ...rest }: { part: string; variant: string; [master: string]: string | number }) {
  const values: Values = {}
  for (const [name, value] of Object.entries(rest)) {
    if (typeof value === 'number') values[name] = value
  }
  return { part, variant, values }
}

/**
 * A link as it is read: a link copied out of HTML or Markdown may carry its separators escaped, `&amp;`. Read raw,
 * `amp;variant` and `amp;W` would be unknown keys, and the link would open the default variant at its defaults, its
 * part alone right. Each `&amp;` of a link given as text or a URL is taken as the `&` it stands for.
 */
function unescaped(input: LoaderInput): LoaderInput {
  if (typeof input === 'string') return input.replace(/&amp;/gi, '&')
  if (input instanceof URL) return new URL(input.href.replace(/&amp;/gi, '&'))
  return input
}

/**
 * The part, its variant and the masters' values a URL (or a bare query) names; a master it leaves out, or gets wrong,
 * is the variant's default. The variant is read first, then the masters on top of its defaults. A link with its
 * separators escaped (`&amp;`) reads as the plain one.
 * @param part The part's masters, whose parsers read the values, and its variants.
 * @param input The URL, its query, or its search params.
 * @param options `strict`: an unknown variant throws, naming the known ones, instead of reading as the default (the
 * CLI, which cannot make a variant it does not know: scripts/masters.ts).
 */
export function loadQuery(part: Partial<Part>, input: LoaderInput, { strict = false } = {}) {
  const link = unescaped(input)
  let variant: string
  try {
    variant = createLoader(fixedParsers(part.variants))(link, { strict }).variant
  } catch {
    const asked = createLoader({ variant: parseAsString })(link).variant
    throw new Error(`no variant ${asked} (known: ${Object.keys(variantsOf(part.variants)).join(', ')})`)
  }
  return split(createLoader(queryParsers(part, variant))(link))
}

/**
 * The URL for a part, its variant and its values: `base` with its query updated (`?part=` first when it has none),
 * the default variant and the values at that variant's defaults left out. With no base, the query alone (`?part=...`).
 * @param part The part's masters and variants, whose defaults are left out.
 * @param state The part's name, its variant (the default when omitted) and its masters' values.
 * @param base The URL whose query is updated; empty for the query alone.
 */
export function queryUrl(part: Partial<Part>, { part: name, variant, values }: { part: string; variant?: string; values: Values }, base = '') {
  const selected = variant ?? defaultVariant(part.variants)
  return createSerializer(queryParsers(part, selected))(base, { part: name, variant: selected, ...values })
}

/**
 * The part, its variant and its masters' values, as the URL holds them, and the setters that write them back to the
 * URL (by replace, once they stay still). The variant is read first, from the URL or the panel's select, then the
 * masters' parsers are built from its schema, so that a value at that variant's default is the one left out. Without
 * a model (not loaded yet), the part and no values.
 * @param part The part's masters and variants; undefined until its model loads.
 */
export function useQuery(part?: Part) {
  const fixed = useMemo(() => fixedParsers(part?.variants), [part])
  const [{ variant }, setFixed] = useQueryStates(fixed, OPTIONS)
  const parsers = useMemo(() => queryParsers(part ?? {}, variant), [part, variant])
  const [query, setQuery] = useQueryStates(parsers, OPTIONS)
  // Stable, and always the current parsers': leva keeps the `onChange` it was first given, and nuqs' `clearOnDefault`
  // compares against the defaults of the parsers the setter was made with, the variant's.
  const setValues = useEventCallback((values: Values) => setQuery(values))
  // The variant alone: the masters' values follow through leva, once the new variant's parsers are in place.
  const setVariant = (id: string) => setFixed({ variant: id })
  return { ...split(query), setValues, setVariant }
}
