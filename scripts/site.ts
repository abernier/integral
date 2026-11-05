// What `build` and `dev` share: how each part is built, and the MDX pages the docs site is made from (the parts and
// the MDX folder themselves: paths.ts).
//
// A part is a folder at the repository root holding `<folder>/<folder>.ts`, whose default export builds it with
// ClassCAD from its masters' values (`<folder>/<folder>.masters.ts`) in one of its variants (scripts/part.ts), and a
// README.md; `<folder>/references/` holds the images its README's `## References` shows (a strip to scroll sideways,
// on the site), `<folder>/renders/` the views `pnpm render` makes of it (render.ts), shown before its Intro (a strip,
// on the site); both served beside the built files.
// Building it writes `<folder>.ofb`, `<folder>.step`, `<folder>.glb` and `<folder>.png` into `.docs/<folder>/` for
// its default variant, `<folder>.<variant>.<ext>` beside them for each other one (paths.ts partFile), or into the
// folder `buildPart` is given (`pnpm cam '<link>'` builds into a temporary one); `buildCamStep` writes
// `<folder>[.<variant>].cam.step` beside them when a master has a `cam` value: the geometry `pnpm cam` cuts, square.
// The PNG is the part as cut, wood only (its module's ROLES, scripts/part.ts): rendered from that CAM build when there
// is one, else from the build; the OFB, STEP and GLB are the finished part, every body in it;
// `buildConfigurator` builds the configurator app into `.docs/configurator/`, and each part's page embeds it. The MDX folder also
// gets one page per README, where the sidebar wants it: the root one as `integral/introduction.mdx`, each part's
// as `things/<folder>.mdx` (@pmndrs/docs groups the sidebar by folder: "Integral", then "Things"), and one per
// `docs/<name>.md`, a page that belongs to no part (how a tool works), as `integral/<name>.mdx`.
//
// The READMEs link the built files and the pages by their GitHub Pages URL, so they read right on GitHub too;
// for a local site those URLs are rewritten to the local servers, for a built site to root-relative paths.

import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { join, relative } from 'node:path'
import { build as vite } from 'vite'
import { queryUrl } from '../configurator/src/App.url.ts'
import { keyFile } from './build.cache.ts'
import { type Engine, glb, render, run, save } from './classcad.ts'
import { camValues, hasCamValues } from '../configurator/src/models.cam.ts'
import { type Values, camStepFile, checkedVariant, defaultValues, loadMasters, loadVariants } from './masters.ts'
import { roleOf } from '../configurator/src/models.roles.ts'
import type { PartModule } from './part.ts'
import { MDX, ROOT, partFile, parts } from './paths.ts'

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

/** A part's module (scripts/part.ts), at a fresh URL each time: `dev` imports a part again after its file changes. */
async function loadPart(part: string) {
  return (await import(`${pathToFileURL(join(ROOT, part, `${part}.ts`)).href}?t=${Date.now()}`)) as PartModule
}

/** Render the drawing, the part's wood alone, to `path` (classcad.ts render). */
function renderWood(engine: Engine, path: string, { ROLES }: PartModule) {
  return render(engine, path, (name) => roleOf(ROLES?.[name]) === 'wood')
}

/** How `buildPart` builds a part: in which variant, with which values, into which folder. */
export type BuildOptions = {
  /** The variant's id; the part's default variant when omitted. */
  variant?: string
  /** Every master's value (masters.ts); the variant's defaults when omitted. */
  values?: Values
  /** The folder of its files: `.docs/<part>/` by default; `pnpm cam '<link>'` builds into a temporary one. */
  out?: string
}

/**
 * Build a part in one of its variants and write its files into `out`, named by the variant (paths.ts partFile);
 * returns their absolute paths. The part's default export is given the script API, the values and the variant.
 * The PNG, wood only, is rendered here only when no master has a `cam` value: else `buildCamStep` renders it, as cut.
 * @param engine The ClassCAD engine (classcad.ts openEngine).
 * @param part The part's name (its folder).
 */
export async function buildPart(engine: Engine, part: string, { variant, values, out = join(MDX, part) }: BuildOptions = {}) {
  const started = performance.now()
  const module = await loadPart(part)
  const masters = await loadMasters(part)
  const variants = await loadVariants(part)
  const id = checkedVariant(variants, variant)
  const resolved = values ?? (await defaultValues(part, id))
  const returned = await run(engine, (api) => module.default(api, resolved, id))
  mkdirSync(out, { recursive: true })
  // The files about to be written no longer match a build key: build.ts writes it again after a build it keyed.
  rmSync(keyFile(part, out), { force: true })
  const file = (ext: string) => join(out, partFile(part, variants, id, ext))
  const files: { ofb: string; step: string; glb: string; png?: string } = { ofb: file('ofb'), step: file('step'), glb: file('glb') }
  const ofbSize = await save(engine, 'OFB', files.ofb)
  const stepSize = await save(engine, 'STP', files.step)
  const glbSize = await glb(engine, files.glb)
  if (!hasCamValues(masters)) {
    files.png = file('png')
    await renderWood(engine, files.png, module)
  }
  const seconds = ((performance.now() - started) / 1000).toFixed(1)
  // The folder relative to .docs when it is under it (the usual case), else as given.
  const shown = out.startsWith(MDX) ? relative(MDX, out) : out
  console.log(`${shown} (${id}): ${seconds} s, ofb ${ofbSize} B, step ${stepSize} B, glb ${glbSize} B`, JSON.stringify(returned))
  return files
}

/**
 * Build a part in one of its variants again for its CAM files and write `<part>[.<variant>].cam.step` into `out`, when
 * some master has a `cam` value (camValues: the finishes made by hand, such as edge rounds, left out, so that the
 * router cuts square), and its `<part>[.<variant>].png` from that build, wood only: the part as cut; returns the
 * STEP's path, or undefined when the part's CAM geometry is its plain STEP (its PNG is then `buildPart`'s).
 * @param engine The ClassCAD engine (classcad.ts openEngine).
 * @param part The part's name (its folder).
 */
export async function buildCamStep(engine: Engine, part: string, { variant, values, out = join(MDX, part) }: BuildOptions = {}) {
  const masters = await loadMasters(part)
  const variants = await loadVariants(part)
  const id = checkedVariant(variants, variant)
  const file = camStepFile(masters, out, part, variants, id)
  if (file === join(out, partFile(part, variants, id, 'step'))) return undefined
  const started = performance.now()
  const module = await loadPart(part)
  const resolved = camValues(masters, values ?? (await defaultValues(part, id)))
  await run(engine, (api) => module.default(api, resolved, id))
  mkdirSync(out, { recursive: true })
  const size = await save(engine, 'STP', file)
  const png = join(out, partFile(part, variants, id, 'png'))
  await renderWood(engine, png, module)
  const seconds = ((performance.now() - started) / 1000).toFixed(1)
  console.log(`${relative(MDX, file)}: ${seconds} s, ${size} B, for the CAM files; ${relative(MDX, png)}, as cut`)
  return file
}

/**
 * Build every variant of a part, the default first, each into `.docs/<part>/` under its own names (buildPart), with
 * its CAM geometry when it has one (buildCamStep).
 * @param engine The ClassCAD engine (classcad.ts openEngine).
 * @param part The part's name (its folder).
 */
export async function buildVariants(engine: Engine, part: string) {
  for (const variant of Object.keys(await loadVariants(part))) {
    await buildPart(engine, part, { variant })
    // The geometry `pnpm cam` reads, square where the part's finishes are made by hand.
    await buildCamStep(engine, part, { variant })
  }
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
 * A part's render, as the site shows it: tabs with its configurator (the `configurator/` app: the part rebuilt in
 * the browser as sliders move), the image, and the part open in Buerligons, in that order. On GitHub the README shows the image alone (it prints iframes as text).
 */
function views(part: string, alt: string) {
  const file = (ext: string) => `${PAGES_URL}/${part}/${part}.${ext}`
  const frame = (src: string, title: string, height: number, allow = 'fullscreen') =>
    `<iframe src="${src}" title="${title}" className="w-full rounded-lg" style={{ height: ${height}, border: 0, marginTop: 12 }} allow="${allow}" />`
  return [
    // syncKey: the pick is kept in localStorage, the same on every part's page.
    '<Tabs defaultValue="configurator" syncKey="part-view">',
    '<TabsList>',
    '<TabsTrigger value="configurator">Configurator</TabsTrigger>',
    '<TabsTrigger value="image">Image</TabsTrigger>',
    '<TabsTrigger value="buerligons">Buerligons</TabsTrigger>',
    '</TabsList>',
    // The directory URL, not index.html: Vercel's clean URLs redirect the file to its directory, and the app's
    // relative base resolves against the trailing slash on every host.
    `<TabsContent value="configurator">${frame(queryUrl({}, { part, values: {} }, `${PAGES_URL}/configurator/`), `${alt}, configurator`, 600, 'fullscreen; clipboard-write')}</TabsContent>`,
    `<TabsContent value="image"><img src="${file('png')}" alt="${alt}" style={{ marginTop: 12 }} /></TabsContent>`,
    `<TabsContent value="buerligons">${frame(`https://buerligons.io/editor/?url=${file('ofb')}`, `${alt}, in Buerligons`, 600)}</TabsContent>`,
    '</Tabs>',
  ].join('\n')
}

/**
 * The `## References` section's images (one markdown image per line, which GitHub shows stacked) as a strip the
 * page scrolls sideways: the images at one height, each as wide as its ratio makes it, its alt under it.
 * Inline styles, as `views`: the theme makes the article's direct children blocks, and the dev server's Tailwind
 * does not scan these pages, so classes written here would not exist.
 */
function references(images: string) {
  const figures = [...images.matchAll(/^!\[([^\]]*)\]\((\S+)\)$/gm)].map(
    ([, alt, src]) =>
      `<figure style={{ flex: 'none', width: 'min-content', margin: 0 }}><img src="${src}" alt="${alt}" style={{ height: '16rem', width: 'auto', maxWidth: 'none', margin: 0 }} /><figcaption style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>${alt}</figcaption></figure>`,
  )
  return [`<div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>`, ...figures, '</div>'].join('\n')
}

/**
 * The renders before the Intro (one markdown image per line, as `references`) as a strip the page scrolls
 * sideways, no snapping: the views at one height (10rem, Tailwind's h-40, under the references' 16rem), each as
 * wide as its ratio makes it. Full width, as the theme's Sandpack: `.post-container > *` caps a block at 4xl from
 * lg and `.sandpack` lifts the cap from xl (globals.css); `maxWidth: none` inline lifts it at every width, the same
 * thing in practice (under xl the column is narrower than the cap). The views are centred while they fit, and
 * scroll from the left once they do not: `width: max-content; margin-inline: auto` on the row inside the scroller
 * (centring with `justify-content` would hide the left of an overflowing row). An MDX comment first, for whoever
 * copies the page: where the views come from.
 */
function renders(part: string, images: string) {
  const views = [...images.matchAll(/^!\[([^\]]*)\]\((\S+)\)$/gm)].map(
    ([, alt, src]) => `<img src="${src}" alt="${alt}" style={{ flex: 'none', height: '10rem', width: 'auto', maxWidth: 'none', margin: 0, borderRadius: '0.5rem' }} />`,
  )
  return [
    `{/* The renders: \`pnpm render ${part}\` (scripts/render.ts), Blender headless on the built GLB, scripts/render.blender.py holding the studio and the views; the files in ${part}/renders/, the strip made here from the README's image lines (\`renders\` in scripts/site.ts). */}`,
    `<div style={{ maxWidth: 'none', overflowX: 'auto', paddingBottom: '0.5rem', marginTop: '1.5rem' }}>`,
    `<div style={{ display: 'flex', gap: '1rem', width: 'max-content', marginInline: 'auto' }}>`,
    ...views,
    '</div>',
    '</div>',
  ].join('\n')
}

/**
 * Turn a README into an MDX page: its first heading becomes the title, the line under it the description, links
 * to the site become local ones, and "Edit this page" opens the README on GitHub.
 * A part's page also gets its source, its render as the page's image, the render's tabs (`views`), its renders as a
 * strip before the Intro (`renders`), and its references as a strip (`references`).
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
    .replace(/^!\[([^\]]*)\]\((\S+)\)$/gm, (image, alt, src) => (part && src === render ? views(part, alt) : image))
    .replace(/^((?:!\[[^\]]*\]\(\S+\)\n)+)(\n<Intro>)/m, (block, images, intro) => (part ? `${renders(part, images)}\n${intro}` : block))
    .replace(/^(## References\n\n)((?:!\[[^\]]*\]\(\S+\)\n)+)/m, (section, heading, images) => (part ? `${heading}${references(images)}\n` : section))
    // The parts table's thumbnails: a fixed size the table can't squeeze, and a small radius (the theme's is 2xl).
    // GitHub reads `width`; the site, the style.
    .replaceAll(`width="${THUMB}" />`, `width="${THUMB}" style={{ width: '${THUMB / 16}rem', minWidth: '${THUMB / 16}rem', height: 'auto', borderRadius: '0.375rem' }} />`)
  // A page link goes to the site, any other link to the site's files to where the files are served, Buerligons'
  // `?url=` to the absolute URL. A root-relative URL loses the base path: Next.js puts it back on a link (markdown
  // or `<a href>`), @pmndrs/docs on an image (markdown or `<img src>`, by MDX_BASEURL); an iframe's `src` keeps it.
  const pages = [HOME, ...docPages().map((d) => `/${docPage(d)}`), ...parts().map((p) => `/${partPage(p)}`)]
  const linked = body.replace(new RegExp(`(\\]\\(|href="|<img src="|\\?url=)?${PAGES_URL.replaceAll('.', '\\.')}(/[^\\s)"']*)`, 'g'), (_, before = '', path: string) => {
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
    // The part's reference images (`<part>/references/`) and renders (`<part>/renders/`), served beside its built
    // files. The copy replaces the previous one, so that an image deleted from the part does not stay in .docs/.
    for (const folder of ['references', 'renders']) {
      const files = join(ROOT, part, folder)
      rmSync(join(MDX, part, folder), { recursive: true, force: true })
      if (existsSync(files)) cpSync(files, join(MDX, part, folder), { recursive: true })
    }
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
    // @pmndrs/docs resolves the pages' images under the base path, root-relative, so they load from whichever
    // host serves the page; `/` at a root, as empty would turn the resolution off.
    MDX_BASEURL: BASE_PATH || '/',
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
