// What `build` and `dev` share: the parts, how each is built, and the MDX folder the docs site is made from.
//
// A part is a folder at the repository root holding `<folder>/<folder>.ts`, whose default export builds it with
// ClassCAD, and a README.md.
// Building it writes `<folder>.ofb`, `<folder>.step` and `<folder>.png` into `.docs/<folder>/`. The MDX folder also
// gets one page per README, where the sidebar wants it: the root one as `integral/introduction.mdx`, each part's
// as `things/<folder>.mdx` (@pmndrs/docs groups the sidebar by folder: "Integral", then "Things").
//
// The READMEs link the built files and the pages by their GitHub Pages URL, so they read right on GitHub too;
// for a local site those URLs are rewritten to the local servers, for a Vercel preview to its branch URL.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { join, relative, resolve } from 'node:path'
import { type Engine, glb, render, run, save } from './classcad.ts'

export const ROOT = resolve(import.meta.dirname, '..')
// Not named `.mdx`: @pmndrs/docs takes every file whose path contains `.md` for a page.
export const MDX = join(ROOT, '.docs')
export const DIST = join(ROOT, 'dist')

/** Where GitHub Pages serves the site: the READMEs link pages and files by this URL. */
const PAGES_URL = 'https://abernier.github.io/integral'
/**
 * Where this build is served: GitHub Pages, or on Vercel the preview's branch URL, at its root. The pages link
 * their images and files by this host (@pmndrs/docs makes image URLs absolute), and a preview's sign-in cookie holds
 * for one host: the branch URL is the one the pull request links, not the deployment's own URL.
 */
const VERCEL_HOST = process.env.VERCEL_BRANCH_URL ?? process.env.VERCEL_URL
export const SITE_URL = process.env.SITE_URL ?? (VERCEL_HOST ? `https://${VERCEL_HOST}` : PAGES_URL)
export const HOME = '/integral/introduction'

/** A part's page, under "Things" in the sidebar. */
const partPage = (part: string) => `things/${part}`

export function parts() {
  return readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(ROOT, entry.name, `${entry.name}.ts`)))
    .map((entry) => entry.name)
}

export async function buildPart(engine: Engine, part: string) {
  const started = performance.now()
  // A fresh URL each time: `dev` imports a part again after its file changes.
  const url = `${pathToFileURL(join(ROOT, part, `${part}.ts`)).href}?t=${Date.now()}`
  const { default: build } = await import(url)
  const returned = await run(engine, build)
  const out = join(MDX, part)
  mkdirSync(out, { recursive: true })
  const ofb = await save(engine, 'OFB', join(out, `${part}.ofb`))
  const step = await save(engine, 'STP', join(out, `${part}.step`))
  const model = await glb(engine, join(out, `${part}.glb`))
  await render(engine, join(out, `${part}.png`))
  const seconds = ((performance.now() - started) / 1000).toFixed(1)
  console.log(`${part}: ${seconds} s, ofb ${ofb} B, step ${step} B, glb ${model} B`, JSON.stringify(returned))
}

/**
 * A part's render, as the site shows it: tabs with a 3D viewer of its GLB, the part open in Buerligons, and the
 * render itself. On GitHub the README shows the render alone (it prints iframes as text).
 */
function views(part: string, alt: string) {
  const file = (ext: string) => `${PAGES_URL}/${part}/${part}.${ext}`
  const frame = (src: string, title: string, height: number) =>
    `<iframe src="${src}" title="${title}" className="w-full rounded-lg" style={{ height: ${height}, border: 0, marginTop: 12 }} allow="fullscreen" />`
  return [
    // syncKey: the pick is kept in localStorage, the same on every part's page.
    '<Tabs defaultValue="3d" syncKey="part-view">',
    '<TabsList>',
    '<TabsTrigger value="3d">3D</TabsTrigger>',
    '<TabsTrigger value="buerligons">Buerligons</TabsTrigger>',
    '<TabsTrigger value="render">Render</TabsTrigger>',
    '</TabsList>',
    `<TabsContent value="3d">${frame(`${PAGES_URL}/viewer.html?src=${part}/${part}.glb`, `${alt}, 3D`, 480)}</TabsContent>`,
    `<TabsContent value="buerligons">${frame(`https://buerligons.io/editor/?url=${file('ofb')}`, `${alt}, in Buerligons`, 600)}</TabsContent>`,
    `<TabsContent value="render"><img src="${file('png')}" alt="${alt}" style={{ marginTop: 12 }} /></TabsContent>`,
    '</Tabs>',
  ].join('\n')
}

/**
 * Turn a README into an MDX page: its first heading becomes the title, the line under it the description, links
 * to the site become local ones.
 * A part's page also gets its source, its render as the page's image, and the render's tabs (`views`).
 */
function page(readme: string, nav: number, urls: { site: string; files: string }, part?: string) {
  const source = readFileSync(readme, 'utf8')
  const title = source.match(/^# (.+)$/m)?.[1] ?? 'Untitled'
  // The line under the heading: short, shown under the title; the <Intro> after it says more.
  const description = source.match(/^# .+\n+([^<\n].*)\n/m)?.[1]
  const meta = [
    `title: ${JSON.stringify(title)}`,
    description && `description: ${JSON.stringify(description)}`,
    part && `sourcecode: ${part}/${part}.ts`,
    part && `image: ../${part}/${part}.png`,
    `nav: ${nav}`,
  ]
  const render = part && `${PAGES_URL}/${part}/${part}.png`
  const body = source
    .replace(/^# .+\n+/m, '')
    .replace(description ? `${description}\n` : '', '')
    .replace(/^!\[([^\]]*)\]\((\S+)\)$/m, (image, alt, src) => (part && src === render ? views(part, alt) : image))
  // A page link goes to the site, any other link to the site's files to where the files are served.
  let linked = body
  for (const path of [HOME, ...parts().map((p) => `/${partPage(p)}`)]) {
    linked = linked.replaceAll(`${PAGES_URL}${path}`, `${urls.site}${path}`)
  }
  linked = linked.replaceAll(`${PAGES_URL}/`, `${urls.files}/`)
  return `---\n${meta.filter(Boolean).join('\n')}\n---\n\n${linked}`
}

/**
 * The root README's parts table, one row per part: its render (linking to its page), and the description line
 * under its heading with a link to the page. Taken from the parts' READMEs, so the table is never edited by hand:
 * `writePages` rewrites the `## Parts` section of README.md when a part changes.
 */
function partsTable() {
  const rows = parts().map((part) => {
    const source = readFileSync(join(ROOT, part, 'README.md'), 'utf8')
    const title = source.match(/^# (.+)$/m)?.[1] ?? part
    const description = source.match(/^# .+\n+([^<\n].*)\n/m)?.[1] ?? ''
    const page = `${PAGES_URL}/${partPage(part)}`
    const image = `<a href="${page}"><img src="${PAGES_URL}/${part}/${part}.png" alt="${title}" width="72" /></a>`
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

/** Write the MDX pages. `urls` default to the published site; `dev` points them at its local servers. */
export function writePages(urls = { site: SITE_URL, files: SITE_URL }) {
  syncReadme()
  mkdirSync(MDX, { recursive: true })
  copyFileSync(join(ROOT, 'scripts', 'viewer.html'), join(MDX, 'viewer.html'))
  mkdirSync(join(MDX, 'integral'), { recursive: true })
  writeFileSync(join(MDX, 'integral', 'introduction.mdx'), page(join(ROOT, 'README.md'), 0, urls))
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
    BASE_PATH: new URL(SITE_URL).pathname.replace(/\/$/, ''),
    HOME_REDIRECT: HOME,
    MDX_BASEURL: SITE_URL,
    NEXT_PUBLIC_URL: SITE_URL,
    SOURCECODE_BASEURL: 'https://github.com/abernier/integral/tree/main',
    // Off: the link is the page's path under this base, and the pages do not sit at their READMEs' paths.
    EDIT_BASEURL: '',
    GITHUB: 'https://github.com/abernier/integral',
    ...overrides,
  }
}
