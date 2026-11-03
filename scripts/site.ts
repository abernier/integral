// What `build` and `dev` share: how each part is built, and the MDX pages the docs site is made from (the parts and
// the MDX folder themselves: paths.ts).
//
// A part is a folder at the repository root holding `<folder>/<folder>.ts`, whose default export builds it with
// ClassCAD from its masters' values (`<folder>/<folder>.masters.ts`), and a README.md.
// Building it writes `<folder>.ofb`, `<folder>.step`, `<folder>.glb` and `<folder>.png` into `.docs/<folder>/`, or a
// variant's folder, and the JSON Schema of its values files (masters.ts), `<folder>.values.schema.json`, into
// `.docs/<folder>/`;
// `buildConfigurator` builds the configurator app into `.docs/configurator/`, and each part's page embeds it. The MDX folder also
// gets one page per README, where the sidebar wants it: the root one as `integral/introduction.mdx`, each part's
// as `things/<folder>.mdx` (@pmndrs/docs groups the sidebar by folder: "Integral", then "Things"), and one per
// `docs/<name>.md`, a page that belongs to no part (how a tool works), as `integral/<name>.mdx`.
//
// The READMEs link the built files and the pages by their GitHub Pages URL, so they read right on GitHub too;
// for a local site those URLs are rewritten to the local servers, for a built site to root-relative paths.

import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { join, relative } from 'node:path'
import { build as vite } from 'vite'
import { type Engine, glb, render, run, save } from './classcad.ts'
import { type Values, defaultValues, valuesJsonSchema } from './masters.ts'
import { MDX, ROOT, parts } from './paths.ts'

export const DIST = join(ROOT, 'dist')

/** Where GitHub Pages serves the site: the READMEs link pages and files by this URL. */
const PAGES_URL = 'https://abernier.github.io/integral'
/** Where this build is served: GitHub Pages, or on Vercel the preview's branch URL, at its root. */
const VERCEL_HOST = process.env.VERCEL_BRANCH_URL ?? process.env.VERCEL_URL
export const SITE_URL = process.env.SITE_URL ?? (VERCEL_HOST ? `https://${VERCEL_HOST}` : PAGES_URL)
/** The path the site is served under: `/integral` on GitHub Pages, nothing on Vercel. */
const BASE_PATH = new URL(SITE_URL).pathname.replace(/\/$/, '')
export const HOME = '/integral/introduction'

/**
 * Where a page's links point: `site` for its pages, `files` for the built files, `shared` for a file another site
 * fetches (Buerligons' `?url=`), which must be absolute: GitHub Pages (but see `buerligonsUrl`).
 * Built, pages and files are root-relative, so that they load from whichever host serves the build: a Vercel
 * preview answers on its deployment URL and its branch URL, and its sign-in cookie holds for one host only.
 */
export type Urls = { site: string; files: string; shared: string }

/**
 * The file Buerligons opens, encoded for its `?url=`. On a Vercel preview, this deployment's own file, through the
 * preview's sign-in by the project's protection bypass for automation (a secret Vercel gives the build; it ends up
 * in the preview's pages, which are behind that sign-in themselves); elsewhere, `shared`'s.
 */
function buerligonsUrl(shared: string, path: string) {
  const bypass = process.env.VERCEL_ENV === 'preview' ? process.env.VERCEL_AUTOMATION_BYPASS_SECRET : undefined
  if (!bypass) return `${shared}${path}`
  return encodeURIComponent(`https://${process.env.VERCEL_URL}${path}?x-vercel-protection-bypass=${bypass}`)
}

/** A part's page, under "Things" in the sidebar. */
const partPage = (part: string) => `things/${part}`

/** The pages of no part: `docs/<name>.md`, under "Integral" in the sidebar, after the introduction. */
const DOC_PAGES = join(ROOT, 'docs')
function docPages() {
  if (!existsSync(DOC_PAGES)) return []
  return readdirSync(DOC_PAGES)
    .filter((file) => file.endsWith('.md'))
    .sort()
    .map((file) => file.replace(/\.md$/, ''))
}
const docPage = (name: string) => `integral/${name}`

/**
 * Build a part and write its files into `out`.
 * @param values Every master's value (masters.ts); the defaults when omitted.
 * @param out The folder of its files: `.docs/<part>/` by default, a variant's (`variantDir`) for other values.
 */
export async function buildPart(engine: Engine, part: string, values?: Values, out = join(MDX, part)) {
  const started = performance.now()
  // A fresh URL each time: `dev` imports a part again after its file changes.
  const url = `${pathToFileURL(join(ROOT, part, `${part}.ts`)).href}?t=${Date.now()}`
  const { default: build } = await import(url)
  const resolved = values ?? (await defaultValues(part))
  const returned = await run(engine, (api) => build(api, resolved))
  mkdirSync(out, { recursive: true })
  const ofb = await save(engine, 'OFB', join(out, `${part}.ofb`))
  const step = await save(engine, 'STP', join(out, `${part}.step`))
  const model = await glb(engine, join(out, `${part}.glb`))
  await render(engine, join(out, `${part}.png`))
  // Beside the model's own files, whatever `out`: the configurator's values files point at it.
  writeFileSync(join(MDX, part, `${part}.values.schema.json`), `${JSON.stringify(await valuesJsonSchema(part), null, 2)}\n`)
  const seconds = ((performance.now() - started) / 1000).toFixed(1)
  console.log(`${relative(MDX, out)}: ${seconds} s, ofb ${ofb} B, step ${step} B, glb ${model} B`, JSON.stringify(returned))
}

/**
 * Build the configurator (a Vite app) into the MDX folder, where the pages' iframes load it; `watch` rebuilds it as
 * its files change. Resolves once the (first) build is done, so that what follows can serve its files.
 * @param watch true keeps vite watching and rebuilds the app on every change, instead of building once.
 */
export async function buildConfigurator(watch = false) {
  const result = await vite({
    configFile: join(ROOT, 'configurator', 'vite.config.ts'),
    logLevel: 'warn',
    // In watch mode the folder is being served: a rebuild must not empty it (stale hashed chunks are harmless in dev).
    build: { outDir: join(MDX, 'configurator'), emptyOutDir: !watch, watch: watch ? {} : null },
  })
  if (!watch) return
  // In watch mode vite returns as soon as the watcher exists, before the first build ran: wait for its end.
  const watcher = result as Extract<typeof result, { on: unknown }>
  await new Promise<void>((done) => {
    watcher.on('event', (event) => {
      if (event.code === 'ERROR') console.error(String(event.error))
      if (event.code === 'END' || event.code === 'ERROR') done()
    })
  })
}

/**
 * A part's render, as the site shows it: tabs with the render itself, its configurator (the `configurator/` app:
 * the part rebuilt in the browser as sliders move), and the part open in Buerligons. On GitHub the README shows the render alone (it prints iframes as text).
 */
function views(part: string, alt: string) {
  const file = (ext: string) => `${PAGES_URL}/${part}/${part}.${ext}`
  const frame = (src: string, title: string, height: number, allow = 'fullscreen') =>
    `<iframe src="${src}" title="${title}" className="w-full rounded-lg" style={{ height: ${height}, border: 0, marginTop: 12 }} allow="${allow}" />`
  return [
    // syncKey: the pick is kept in localStorage, the same on every part's page.
    '<Tabs defaultValue="render" syncKey="part-view">',
    '<TabsList>',
    '<TabsTrigger value="render">Render</TabsTrigger>',
    '<TabsTrigger value="3d">Model</TabsTrigger>',
    '<TabsTrigger value="buerligons">Buerligons</TabsTrigger>',
    '</TabsList>',
    `<TabsContent value="render"><img src="${file('png')}" alt="${alt}" style={{ marginTop: 12 }} /></TabsContent>`,
    // The directory URL, not index.html: Vercel's clean URLs redirect the file to its directory, and the app's
    // relative base resolves against the trailing slash on every host.
    `<TabsContent value="3d">${frame(`${PAGES_URL}/configurator/?part=${part}`, `${alt}, configurator`, 600, 'fullscreen; clipboard-write')}</TabsContent>`,
    `<TabsContent value="buerligons">${frame(`https://buerligons.io/editor/?url=${file('ofb')}`, `${alt}, in Buerligons`, 600)}</TabsContent>`,
    '</Tabs>',
  ].join('\n')
}

/**
 * Turn a README into an MDX page: its first heading becomes the title, the line under it the description, links
 * to the site become local ones, and "Edit this page" opens the README on GitHub.
 * A part's page also gets its source, its render as the page's image, and the render's tabs (`views`).
 */
function page(readme: string, nav: number, urls: Urls, part?: string) {
  const edit = `https://github.com/abernier/integral/edit/main/${relative(ROOT, readme)}`
  const source = readFileSync(readme, 'utf8')
  const title = source.match(/^# (.+)$/m)?.[1] ?? 'Untitled'
  // The line under the heading: short, shown under the title; the <Intro> after it says more.
  const description = source.match(/^# .+\n+([^<\n].*)\n/m)?.[1]
  const meta = [
    `title: ${JSON.stringify(title)}`,
    description && `description: ${JSON.stringify(description)}`,
    part && `sourcecode: ${part}/${part}.ts`,
    part && `image: ${urls.shared}/${part}/${part}.png`, // for link previews: absolute
    `edit: ${edit}`,
    `nav: ${nav}`,
  ]
  const render = part && `${PAGES_URL}/${part}/${part}.png`
  const body = source
    .replace(/^# .+\n+/m, '')
    .replace(description ? `${description}\n` : '', '')
    .replace(/^!\[([^\]]*)\]\((\S+)\)$/m, (image, alt, src) => (part && src === render ? views(part, alt) : image))
    // The parts table's thumbnails: a fixed size the table can't squeeze, and a small radius (the theme's is 2xl).
    // GitHub reads `width`; the site, the style.
    .replaceAll(`width="${THUMB}" />`, `width="${THUMB}" style={{ width: '${THUMB / 16}rem', minWidth: '${THUMB / 16}rem', height: 'auto', borderRadius: '0.375rem' }} />`)
  // A page link goes to the site, any other link to the site's files to where the files are served, Buerligons'
  // `?url=` to the absolute URL. A link's root-relative URL (markdown or `<a href>`) loses the base path: Next.js
  // puts it back; an `src` keeps it.
  const pages = [HOME, ...docPages().map((d) => `/${docPage(d)}`), ...parts().map((p) => `/${partPage(p)}`)]
  const linked = body.replace(new RegExp(`(\\]\\(|href="|\\?url=)?${PAGES_URL.replaceAll('.', '\\.')}(/[^\\s)"']*)`, 'g'), (_, before = '', path: string) => {
    if (before === '?url=') return `${before}${buerligonsUrl(urls.shared, path)}`
    const url = `${pages.includes(path) ? urls.site : urls.files}${path}`
    return before && BASE_PATH && url.startsWith(`${BASE_PATH}/`) ? `${before}${url.slice(BASE_PATH.length)}` : `${before}${url}`
  })
  return `---\n${meta.filter(Boolean).join('\n')}\n---\n\n${linked}`
}

/**
 * The root README's parts table, one row per part: its render (linking to its page), and the description line
 * under its heading with a link to the page. Taken from the parts' READMEs, so the table is never edited by hand:
 * `writePages` rewrites the `## Parts` section of README.md when a part changes.
 */
/** The parts table's thumbnail width, in px. */
const THUMB = 72

function partsTable() {
  const rows = parts().map((part) => {
    const source = readFileSync(join(ROOT, part, 'README.md'), 'utf8')
    const title = source.match(/^# (.+)$/m)?.[1] ?? part
    const description = source.match(/^# .+\n+([^<\n].*)\n/m)?.[1] ?? ''
    const page = `${PAGES_URL}/${partPage(part)}`
    const image = `<a href="${page}"><img src="${PAGES_URL}/${part}/${part}.png" alt="${title}" width="${THUMB}" /></a>`
    return `| ${image} | **[${title}](${page})**: ${description} |`
  })
  return ['| | Part |', '|---|---|', ...rows].join('\n')
}

function syncReadme() {
  const readme = join(ROOT, 'README.md')
  const source = readFileSync(readme, 'utf8')
  const synced = source.replace(/(^## Parts\n\n)[\s\S]*?(\n\n## )/m, `$1${partsTable()}$2`)
  if (synced !== source) {
    writeFileSync(readme, synced)
    console.log('README.md: parts table updated')
  }
}

/** Write the MDX pages. `urls` default to the built site; `dev` points them at its local servers. */
export function writePages(urls: Urls = { site: BASE_PATH, files: BASE_PATH, shared: PAGES_URL }) {
  syncReadme()
  mkdirSync(MDX, { recursive: true })
  mkdirSync(join(MDX, 'integral'), { recursive: true })
  writeFileSync(join(MDX, 'integral', 'introduction.mdx'), page(join(ROOT, 'README.md'), 0, urls))
  docPages().forEach((name, i) => {
    writeFileSync(join(MDX, `${docPage(name)}.mdx`), page(join(DOC_PAGES, `${name}.md`), i + 1, urls))
    // The page's own files (`docs/<name>/`, its images), served beside it.
    const files = join(DOC_PAGES, name)
    if (existsSync(files)) cpSync(files, join(MDX, docPage(name)), { recursive: true })
  })
  mkdirSync(join(MDX, 'things'), { recursive: true })
  parts().forEach((part, i) => {
    writeFileSync(join(MDX, `${partPage(part)}.mdx`), page(join(ROOT, part, 'README.md'), i + 1, urls, part))
  })
  return relative(ROOT, MDX)
}

/** The @pmndrs/docs configuration, as environment variables. */
export function docsEnv(overrides: Record<string, string> = {}) {
  return {
    ...process.env,
    MDX,
    NEXT_PUBLIC_LIBNAME: 'integral',
    NEXT_PUBLIC_LIBNAME_SHORT: 'integral',
    BASE_PATH,
    HOME_REDIRECT: HOME,
    // Unset: @pmndrs/docs would make every image URL absolute on it, the pages' root-relative ones included.
    MDX_BASEURL: '',
    NEXT_PUBLIC_URL: SITE_URL,
    SOURCECODE_BASEURL: 'https://github.com/abernier/integral/tree/main',
    // No base: the pages do not sit at their READMEs' paths, so each page gives its own `edit` URL.
    EDIT_BASEURL: '',
    // Not a pmndrs library: no "Sponsor Poimandres" card, no menu of the pmndrs libraries.
    SPONSOR_CARD: 'false',
    LIBS_MENU: 'false',
    GITHUB: 'https://github.com/abernier/integral',
    ...overrides,
  }
}
