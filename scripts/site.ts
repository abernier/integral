// What `build` and `dev` share: the parts, how each is built, and the MDX folder the docs site is made from.
//
// A part is a folder at the repository root holding `<folder>/<folder>.js`, a ClassCAD script, and a README.md.
// Building it writes `<folder>.ofb`, `<folder>.step` and `<folder>.png` into `.docs/<folder>/`. The MDX folder also
// gets one page per README: the root one as `integral/introduction.mdx`, each part's as `<folder>/introduction.mdx`.
//
// The READMEs link the built files and the pages by their GitHub Pages URL, so they read right on GitHub too;
// for a local site those URLs are rewritten to the local servers.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { type Engine, render, run, save } from './classcad.ts'

export const ROOT = resolve(import.meta.dirname, '..')
// Not named `.mdx`: @pmndrs/docs takes every file whose path contains `.md` for a page.
export const MDX = join(ROOT, '.docs')
export const DIST = join(ROOT, 'dist')

/** Where GitHub Pages serves the site. */
export const SITE_URL = process.env.SITE_URL ?? 'https://abernier.github.io/integral'
export const HOME = '/integral/introduction'

export function parts() {
  return readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(ROOT, entry.name, `${entry.name}.js`)))
    .map((entry) => entry.name)
}

export async function buildPart(engine: Engine, part: string) {
  const started = performance.now()
  const returned = await run(engine, readFileSync(join(ROOT, part, `${part}.js`), 'utf8'))
  const out = join(MDX, part)
  mkdirSync(out, { recursive: true })
  const ofb = await save(engine, 'OFB', join(out, `${part}.ofb`))
  const step = await save(engine, 'STP', join(out, `${part}.step`))
  await render(engine, join(out, `${part}.png`))
  const seconds = ((performance.now() - started) / 1000).toFixed(1)
  console.log(`${part}: ${seconds} s, ofb ${ofb} B, step ${step} B`, JSON.stringify(returned))
}

/** Turn a README into an MDX page: its first heading becomes the title, links to the site become local ones. */
function page(readme: string, nav: number, urls: { site: string; files: string }) {
  const source = readFileSync(readme, 'utf8')
  const title = source.match(/^# (.+)$/m)?.[1] ?? 'Untitled'
  const body = source
    .replace(/^# .+\n+/m, '')
    // A page link (a path ending in `/introduction`) goes to the site, a file link to where the files are served.
    .replaceAll(`${SITE_URL}/`, '\0')
    .replace(/\0([\w/-]*\/introduction)/g, `${urls.site}/$1`)
    .replaceAll('\0', `${urls.files}/`)
  return `---\ntitle: ${JSON.stringify(title)}\nnav: ${nav}\n---\n\n${body}`
}

/** Write the MDX pages. `urls` default to the published site; `dev` points them at its local servers. */
export function writePages(urls = { site: SITE_URL, files: SITE_URL }) {
  mkdirSync(join(MDX, 'integral'), { recursive: true })
  writeFileSync(join(MDX, 'integral', 'introduction.mdx'), page(join(ROOT, 'README.md'), 0, urls))
  parts().forEach((part, i) => {
    mkdirSync(join(MDX, part), { recursive: true })
    writeFileSync(join(MDX, part, 'introduction.mdx'), page(join(ROOT, part, 'README.md'), i + 1, urls))
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
    EDIT_BASEURL: '',
    GITHUB: 'https://github.com/abernier/integral',
    ...overrides,
  }
}
