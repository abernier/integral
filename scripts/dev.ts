// `nr dev`: the docs site with live reload, on http://localhost:$PORT (default 3000).
//
// It builds the parts, serves .docs/ (the pages' images and files) on a free port, and runs @pmndrs/docs' own
// Next.js dev server on the MDX folder, as its dev.sh does. Like its CLI, it first copies the app out of
// node_modules (to .pmndrs-docs/dev/): Node refuses to strip the types of a next.config.mts there.
// A README change rewrites its page, and the page follows; a part's script change rebuilds that part (about 5 s):
// reload the page for the new render.

import { spawn } from 'node:child_process'
import { cpSync, rmSync, watch } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { openEngine } from './classcad.ts'
import { HOME, MDX, ROOT, buildConfigurator, buildPart, docsEnv, parts, writePages } from './site.ts'

const freePort = () =>
  new Promise<number>((done) => {
    const server = createServer().listen(0, () => {
      const { port } = server.address() as { port: number }
      server.close(() => done(port))
    })
  })

const port = Number(process.env.PORT ?? 3000)
const filesPort = await freePort()
const files = `http://localhost:${filesPort}`
const urls = { site: `http://localhost:${port}`, files, shared: files }

const engine = await openEngine()
for (const part of parts()) await buildPart(engine, part)
writePages(urls)
await buildConfigurator(true) // rebuilt as its files change; reload the page

const app = join(ROOT, '.pmndrs-docs', 'dev')
const docsPackage = join(ROOT, 'node_modules', '@pmndrs', 'docs')
rmSync(app, { recursive: true, force: true })
const APP_FILES = ['package.json', 'next.config.mts', 'next-env.d.ts', 'postcss.config.mjs', 'tsconfig.json', 'public', 'registry', 'src']
for (const file of APP_FILES) {
  cpSync(join(docsPackage, file), join(app, file), { recursive: true })
}

const bin = (name: string) => join(ROOT, 'node_modules', '.bin', name)
const children = [
  // serve.json turns clean URLs off: they would redirect configurator/index.html to /configurator/index and lose its ?part=.
  spawn(bin('serve'), [MDX, '-c', join(ROOT, 'scripts', 'serve.json'), '-p', String(filesPort), '--cors', '--no-port-switching', '--no-clipboard'], {
    stdio: 'ignore',
  }),
  spawn(bin('next'), ['dev', '-p', String(port)], {
    cwd: app,
    env: docsEnv({ BASE_PATH: '', MDX_BASEURL: urls.files, NEXT_PUBLIC_URL: urls.site }),
    stdio: 'inherit',
  }),
]
const stop = () => {
  children.forEach((child) => child.kill())
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)

// One rebuild at a time, the engine holding one drawing; an editor's save often fires several events, so a task
// already waiting is not queued again.
let queue = Promise.resolve()
const waiting = new Set<string>()
const later = (key: string, task: () => Promise<void> | void) => {
  if (waiting.has(key)) return
  waiting.add(key)
  queue = queue
    .then(() => waiting.delete(key))
    .then(task)
    .catch((error) => console.error(String(error)))
}

watch(ROOT, { recursive: true }, (_event, file) => {
  if (!file || /^(configurator|node_modules|\.docs|\.pmndrs-docs|dist)\b/.test(file)) return
  const [folder, name] = file.split('/')
  if (file === 'README.md' || (name === 'README.md' && parts().includes(folder))) {
    later('pages', () => void writePages(urls))
  } else if (parts().includes(folder) && name === `${folder}.ts`) {
    later(folder, () => buildPart(engine, folder))
  }
})

console.log(`site: ${urls.site}${HOME}`)
