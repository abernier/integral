// `pnpm cam <model>`: ShopBot (OpenSBP, .sbp) files for every board of a model, made by Fusion's CAM in Autodesk's
// cloud through the Fusion Compute MCP server: no Fusion window, no clicks.
//
// For each board of the model's STEP (`.docs/<model>/<model>.step`, from `nr build:parts`) and each of its setups
// (its manifest's, see cam/manifest.ts; else one, face up), in one Fusion session: open the model's design from
// Fusion Team, make a milling setup on the board (box stock, `--margin` mm around; WCS at the stock's top corner;
// the board first turned by the setup's `wcs.rotate`, for a wedge), apply the CAM template `--template`, generate
// its toolpaths, post them with the Fusion library post matching `--post`, and write
// `.docs/<model>/cam/<Board>_<setup>.sbp`. A file already there is kept (`--force` makes it again): a run cut short
// by the session's hour goes on where it stopped.
//
//   pnpm cam zigzag-chair --document urn:adsk.wipprod:dm.lineage:… [--template integral-19mm-6mm] [--post shopbot]
//   pnpm cam zigzag-chair --dry-run        # the plan and the MCP calls, without connecting
//   pnpm cam --list-tools                  # what the server offers (signs in, starts and stops a session)
//
// Prototype: the Fusion side is unverified (see cam/fusion.ts and cam/fusion-job.js). Simulate every .sbp before
// cutting.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { parseArgs } from 'node:util'
import { ENDPOINT, FusionSession, connect, mapTools } from './cam/fusion.ts'
import { TOKEN_FILE } from './cam/auth.ts'
import { loadManifest, manifestPaths, setupsOf, stepBodies, type Setup } from './cam/manifest.ts'

const ROOT = join(import.meta.dirname, '..')
const DOCS = join(ROOT, '.docs') // site.ts' MDX: where the build writes each model's files
const shown = (path: string) => (path.startsWith(ROOT) ? relative(ROOT, path) : path)
const fail = (message: string): never => {
  console.error(`cam: ${message}`)
  process.exit(2)
}

const { values: flags, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    document: { type: 'string' },
    step: { type: 'string' },
    template: { type: 'string' },
    post: { type: 'string' },
    margin: { type: 'string' },
    only: { type: 'string' },
    force: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    'list-tools': { type: 'boolean', default: false },
    'queue-timeout': { type: 'string', default: '600' },
    help: { type: 'boolean', short: 'h', default: false },
  },
})

const USAGE = `usage: pnpm cam <model> --document <Fusion Team file id> [options]
  --document <id>        the model's design in Fusion Team (upload .docs/<model>/<model>.step there once)
  --step <file>          the STEP to read the boards from (default .docs/<model>/<model>.step)
  --template <name>      CAM template, by name, in your Fusion library (default integral-19mm-6mm)
  --post <text>          the library post whose vendor/description contains it (default shopbot)
  --margin <mm>          stock around each board's box (default 5)
  --only <A,B>           these boards only
  --force                make files already there again
  --dry-run              print the plan and the MCP calls, connect to nothing
  --list-tools           list the server's tools and the session's worker tools, then stop
  --queue-timeout <s>    how long to wait for a queued session (default 600)`

if (flags.help) {
  console.log(USAGE)
  process.exit(0)
}

if (flags['list-tools']) {
  await listTools()
  process.exit(0)
}

const model = positionals[0]
if (!model) {
  console.error(USAGE)
  process.exit(2)
}
if (!existsSync(join(ROOT, model, `${model}.ts`))) fail(`no model ${model} (no ${model}/${model}.ts)`)

const step = flags.step ?? join(DOCS, model, `${model}.step`)
if (!existsSync(step)) fail(`no STEP at ${shown(step)}: run \`nr build:parts\` first, or pass --step`)
const { manifest, from } = loadManifest(manifestPaths(ROOT, DOCS, model))
const defaults = {
  template: flags.template ?? manifest.defaults?.template ?? 'integral-19mm-6mm',
  post: flags.post ?? manifest.defaults?.post ?? 'shopbot',
  margin: Number(flags.margin ?? manifest.defaults?.margin ?? 5),
}
const only = flags.only?.split(',').map((s) => s.trim())
const out = join(DOCS, model, 'cam')

type Job = { body: string; setup: Setup; template: string; file: string }
const jobs: Job[] = []
const skipped: string[] = []
for (const body of stepBodies(step)) {
  if (only && !only.includes(body)) continue
  const { part, setups } = setupsOf(manifest, body)
  if (part?.skip) {
    skipped.push(`${body} (skip in manifest)`)
    continue
  }
  for (const setup of setups) {
    const file = join(out, `${body}_${setup.name}.sbp`)
    if (existsSync(file) && !flags.force) skipped.push(`${body}_${setup.name} (already there)`)
    else jobs.push({ body, setup, template: part?.template ?? defaults.template, file })
  }
}

console.log(`cam: ${model}, ${jobs.length} setups to post, boards from ${shown(step)}, manifest ${from ? shown(from) : '(none)'}`)
if (skipped.length) console.log(`cam: skipping ${skipped.join(', ')}`)
if (only) for (const name of only) if (!jobs.some((j) => j.body === name) && !skipped.some((s) => s.startsWith(name))) console.log(`cam: no board ${name} in the STEP`)

const SCRIPT = readFileSync(join(import.meta.dirname, 'cam', 'fusion-job.js'), 'utf8')
/** The script for one job: JOB, then fusion-job.js inside an async function (it ends with a `return`). */
const script = (job: Record<string, unknown>) => `const JOB = ${JSON.stringify(job)};\n(async () => {\n${SCRIPT}\n})()`

const jobOf = (job: Job) => ({
  op: 'setup',
  body: job.body,
  setup: job.setup.name,
  rotate: job.setup.wcs?.rotate ?? [0, 0, 0],
  template: job.template,
  post: defaults.post,
  margin: defaults.margin,
  generateTimeout: 8 * 60_000,
})

if (flags['dry-run']) {
  const auth = process.env.AUTODESK_TOKEN ? 'AUTODESK_TOKEN' : existsSync(TOKEN_FILE) ? TOKEN_FILE : 'browser sign-in (OAuth, PKCE)'
  console.log(`\nplan (nothing is sent):\n  connect ${ENDPOINT}, auth: ${auth}`)
  console.log('  tools/list, mapped: start_fusion, fusion_status, invoke_fusion, stop_fusion (by name, else by intent)')
  console.log('  start_fusion {toolMode: "Execute"}, then fusion_status until it runs')
  console.log('  invoke_fusion list, describe the TypeScript executor (MCP.ExecuteTypeScript)')
  console.log(`  run fusion-job.js ${JSON.stringify({ op: 'open', document: flags.document ?? '<--document>' })}`)
  for (const job of jobs) {
    console.log(`  run fusion-job.js ${JSON.stringify(jobOf(job))}\n    -> ${shown(job.file)}${job.setup.wedge ? ` (on a ${job.setup.wedge}° wedge)` : ''}`)
  }
  console.log('  stop_fusion')
  process.exit(0)
}

if (!jobs.length) process.exit(0)
if (!flags.document) fail('--document: the model\'s Fusion Team file id (upload its STEP to Fusion Team once; see the README)')

const client = await connect()
const session = await FusionSession.start(client, await discover(client), Number(flags['queue-timeout']) * 1000)
const stop = async () => {
  await session.stop()
  await client.close()
}
process.on('SIGINT', () => void stop().then(() => process.exit(130)))

const failed: string[] = []
try {
  const opened = (await session.runScript(script({ op: 'open', document: flags.document }))) as { bodies?: { name: string }[] }
  const names = opened.bodies?.map((b) => b.name) ?? []
  console.log(`fusion: design open, bodies ${names.join(', ') || '(none reported)'}`)
  mkdirSync(out, { recursive: true })
  for (const job of jobs) {
    if (!session.hasTime) {
      console.log('cam: the session nears its hour; run again to go on with the rest')
      break
    }
    const name = `${job.body}_${job.setup.name}`
    if (names.length && !names.includes(job.body)) {
      failed.push(`${name}: no body ${job.body} in the Fusion design`)
      continue
    }
    try {
      const started = performance.now()
      const result = (await session.runScript(script(jobOf(job)))) as { content?: string | null; path?: string; post?: string; operations?: number }
      if (typeof result?.content !== 'string' || !result.content) {
        throw new Error(`posted to ${result?.path ?? '?'} in the session, but its content did not come back: ${JSON.stringify(result).slice(0, 300)}`)
      }
      writeFileSync(job.file, result.content)
      const seconds = ((performance.now() - started) / 1000).toFixed(1)
      console.log(`${name}: ${seconds} s, ${result.operations ?? '?'} operations, post ${result.post ?? defaults.post}, ${shown(job.file)}`)
    } catch (error) {
      failed.push(`${name}: ${error instanceof Error ? error.message : error}`)
      console.error(`${name}: failed: ${error instanceof Error ? error.message : error}`)
    }
  }
} finally {
  await stop()
}
if (failed.length) {
  console.error(`cam: ${failed.length} failed:\n  ${failed.join('\n  ')}`)
  process.exit(1)
}
console.log('cam: simulate every .sbp (Fusion, ShopBot Previewer) before cutting')
process.exit(0)

async function discover(client: Awaited<ReturnType<typeof connect>>) {
  const { tools } = await client.listTools()
  console.log(`fusion: tools ${tools.map((t) => t.name).join(', ')}`)
  return mapTools(tools)
}

async function listTools() {
  const client = await connect()
  const { tools } = await client.listTools()
  for (const tool of tools) {
    console.log(`\n${tool.name}: ${tool.description ?? ''}\n  input: ${JSON.stringify(tool.inputSchema)}`)
  }
  let session: FusionSession | undefined
  try {
    session = await FusionSession.start(client, mapTools(tools), Number(flags['queue-timeout']) * 1000)
    console.log(`\nworker tools of the session:\n  ${(await session.workerTools()).join('\n  ')}`)
  } finally {
    await session?.stop()
    await client.close()
  }
}
