// `pnpm cam <model>`: ShopBot (OpenSBP, .sbp) files for every board of a model, made by Fusion's CAM in the Fusion
// desktop app running on this machine, driven through its local MCP server: no clicks.
//
// The model's STEP (`.docs/<model>/<model>.step`, from `nr build:parts`) is imported into a new Fusion document; for
// each of its boards and each of its setups (its manifest's, see cam/manifest.ts; else one, face up): a milling setup
// on the board (box stock, `--margin` mm around; WCS at the stock's top corner; the board first turned by the
// setup's `wcs.rotate`, for a wedge), the CAM template `--template`, its toolpaths, an NC program posted with the
// Fusion library post matching `--post` to `.docs/<model>/cam/<Board>_<setup>.sbp`. Then the document is closed,
// unsaved (`--keep` leaves it open, to simulate the setups in Fusion). A file already there is kept (`--force` makes
// it again).
//
// A template is read from scripts/cam/templates/<name>.f3dhsm-template when the repo has it, so any Fusion makes the
// same files; else it is looked up by name in the Fusion template libraries.
//
//   pnpm cam zigzag-chair [--template integral-19mm-6mm] [--post shopbot] [--only Seat]
//   pnpm cam zigzag-chair --only Seat --force --keep   # then Simulate the setups in Fusion
//   pnpm cam zigzag-chair --dry-run        # the plan, without connecting
//   pnpm cam --list-tools                  # what Fusion's MCP server offers
//
// Simulate every .sbp before cutting.

import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { ENDPOINT, connect, runScript } from './cam/fusion.ts'
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
    step: { type: 'string' },
    template: { type: 'string' },
    post: { type: 'string' },
    margin: { type: 'string' },
    only: { type: 'string' },
    force: { type: 'boolean', default: false },
    keep: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    'list-tools': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
})

const USAGE = `usage: pnpm cam <model> [options]
  --step <file>          the STEP to read the boards from (default .docs/<model>/<model>.step)
  --template <name>      CAM template: scripts/cam/templates/<name>.f3dhsm-template, else by name in your Fusion library (default integral-19mm-6mm)
  --post <text>          the library post whose vendor/description contains it (default shopbot)
  --margin <mm>          stock around each board's box (default 5)
  --only <A,B>           these boards only
  --force                make files already there again
  --keep                 leave the document open in Fusion, unsaved, to simulate its setups
  --dry-run              print the plan, connect to nothing
  --list-tools           list the tools of Fusion's MCP server (${ENDPOINT}), then stop`

if (flags.help) {
  console.log(USAGE)
  process.exit(0)
}

if (flags['list-tools']) {
  const client = await connect()
  const { tools } = await client.listTools()
  for (const tool of tools) console.log(`\n${tool.name}: ${tool.description ?? ''}\n  input: ${JSON.stringify(tool.inputSchema)}`)
  await client.close()
  process.exit(0)
}

const model = positionals[0]
if (!model) {
  console.error(USAGE)
  process.exit(2)
}
if (!existsSync(join(ROOT, model, `${model}.ts`))) fail(`no model ${model} (no ${model}/${model}.ts)`)

const step = resolve(flags.step ?? join(DOCS, model, `${model}.step`))
if (!existsSync(step)) fail(`no STEP at ${shown(step)}: run \`nr build:parts\` first, or pass --step`)
const { manifest, from } = loadManifest(manifestPaths(ROOT, DOCS, model))
const defaults = {
  template: flags.template ?? manifest.defaults?.template ?? 'integral-19mm-6mm',
  post: flags.post ?? manifest.defaults?.post ?? 'shopbot',
  margin: Number(flags.margin ?? manifest.defaults?.margin ?? 5),
}
const only = flags.only?.split(',').map((s) => s.trim())
const out = join(DOCS, model, 'cam')

/** `reference`: the board's first setup, which a `cut: "squared"` setup squares the faces of. */
type Job = { body: string; setup: Setup; reference: Setup; template: string; file: string }
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
    else jobs.push({ body, setup, reference: setups[0], template: part?.template ?? defaults.template, file })
  }
}

console.log(`cam: ${model}, ${jobs.length} setups to post, boards from ${shown(step)}, manifest ${from ? shown(from) : '(none)'}`)
if (skipped.length) console.log(`cam: skipping ${skipped.join(', ')}`)
if (only) for (const name of only) if (!jobs.some((j) => j.body === name) && !skipped.some((s) => s.startsWith(name))) console.log(`cam: no board ${name} in the STEP`)

/** The repo's copy of a template, as XML, or undefined to look it up in Fusion's libraries. */
const TEMPLATES = join(import.meta.dirname, 'cam', 'templates')
const templateXml = (name: string) => {
  const file = join(TEMPLATES, `${name}.f3dhsm-template`)
  return existsSync(file) ? readFileSync(file, 'utf8') : undefined
}

const SCRIPT = readFileSync(join(import.meta.dirname, 'cam', 'fusion-job.py'), 'utf8')
/** The script for one step: JOB first (a JSON string is a valid Python string literal), then fusion-job.py. */
const script = (job: Record<string, unknown>) => `import json\nJOB = json.loads(${JSON.stringify(JSON.stringify(job))})\n${SCRIPT}`

/** This run's tag on the document it imports: how later steps find it, and how it is told from the user's. */
const tag = `integral-cam-${process.pid}-${Date.now()}`
const setupName = (job: Job) => `${job.body}_${job.setup.name}`
const steps = {
  import: () => ({ op: 'import', tag, step, solids: stepSolidBoxes(step) }),
  setup: (job: Job) => ({
    op: 'setup',
    tag,
    body: job.body,
    setup: setupName(job),
    rotate: job.setup.wcs?.rotate ?? [0, 0, 0],
    cut: job.setup.cut ?? 'all',
    reference: job.reference.wcs?.rotate ?? [0, 0, 0],
    template: job.template,
    templateXml: templateXml(job.template),
    margin: defaults.margin,
  }),
  status: (job: Job) => ({ op: 'status', tag, setup: setupName(job) }),
  post: (job: Job) => ({ op: 'post', tag, setup: setupName(job), post: defaults.post, folder: out, file: setupName(job) }),
  close: () => ({ op: 'close', tag }),
}

if (flags['dry-run']) {
  const plain = (job: Record<string, unknown>) => JSON.stringify({ ...job, solids: job.solids ? `(${(job.solids as unknown[]).length} boxes)` : undefined })
  console.log(`\nplan (nothing is sent):\n  connect ${ENDPOINT}`)
  console.log(`  fusion-job.py ${plain(steps.import())}`)
  for (const job of jobs) {
    const wedge = job.setup.wedge ? ` (on a ${job.setup.wedge}° wedge)` : ''
    const squared = job.setup.cut === 'squared' ? ` (only the faces it squares against ${job.reference.name})` : ''
    console.log(`  fusion-job.py ${plain(steps.setup(job))}${wedge}${squared}`)
    console.log(`  fusion-job.py ${plain(steps.status(job))}, until generated`)
    console.log(`  fusion-job.py ${plain(steps.post(job))}\n    -> ${shown(job.file)}`)
  }
  if (!flags.keep) console.log(`  fusion-job.py ${plain(steps.close())}`)
  process.exit(0)
}

if (!jobs.length) process.exit(0)

const client = await connect()
let imported = false
const finish = async () => {
  // Only the document this run imported, found by its tag; never one that was open before.
  if (imported && flags.keep) {
    console.log('fusion: document left open, unsaved: Manufacture workspace, right-click a setup, Simulate')
  } else if (imported) {
    try {
      await runScript(client, script(steps.close()))
      console.log('fusion: document closed, unsaved')
    } catch (error) {
      console.error(`fusion: closing the imported document failed, close it by hand: ${error instanceof Error ? error.message : error}`)
    }
  }
  await client.close()
}
process.on('SIGINT', () => void finish().then(() => process.exit(130)))

const failed: string[] = []
try {
  const started = performance.now()
  imported = true // from here on, close it: an import cut short may still have made the document
  const { bodies, document } = (await runScript(client, script(steps.import()))) as { bodies: string[]; document: string }
  console.log(`fusion: ${shown(step)} imported as "${document}" in ${seconds(started)} s, bodies ${bodies.join(', ')}`)
  mkdirSync(out, { recursive: true })
  for (const job of jobs) {
    const name = setupName(job)
    try {
      const began = performance.now()
      const made = (await runScript(client, script(steps.setup(job)))) as {
        operations: string[]
        squared: { faces: number; chains: number[]; depth: number } | null
      }
      console.log(`${name}: setup, ${made.operations.length} operations (${made.operations.join(', ')}), generating`)
      if (made.squared) {
        const { faces, chains, depth } = made.squared
        console.log(`${name}: squared faces only: ${faces} faces, ${chains.length} chains of ${chains.join(', ')} edges, ${depth} mm deep`)
      }
      await generated(job)
      const posting = Date.now()
      const posted = (await runScript(client, script(steps.post(job)))) as { post: string }
      if (!existsSync(job.file) || statSync(job.file).mtimeMs < posting - 1000) {
        throw new Error(`posted with ${posted.post}, but no new ${shown(job.file)}`)
      }
      console.log(`${name}: ${seconds(began)} s, post ${posted.post}, ${shown(job.file)}`)
    } catch (error) {
      failed.push(`${name}: ${error instanceof Error ? error.message : error}`)
      console.error(`${name}: failed: ${error instanceof Error ? error.message : error}`)
    }
  }
} finally {
  await finish()
}
if (failed.length) {
  console.error(`cam: ${failed.length} failed:\n  ${failed.join('\n  ')}`)
  process.exit(1)
}
console.log('cam: simulate every .sbp (Fusion, ShopBot Previewer) before cutting')
process.exit(0)

/** Wait while Fusion generates the setup's toolpaths, asking every 2 s; 10 minutes at most. */
async function generated(job: Job) {
  const until = Date.now() + 10 * 60_000
  for (;;) {
    const status = (await runScript(client, script(steps.status(job)), { readOnly: true })) as { generating: string[]; failed: string[]; empty: string[] }
    if (!status.generating.length) {
      if (status.failed.length) throw new Error(`toolpaths failed: ${status.failed.join('; ')}`)
      if (status.empty.length) console.log(`${setupName(job)}: nothing to cut for ${status.empty.join(', ')} on this board, left out`)
      return
    }
    if (Date.now() > until) throw new Error(`toolpaths still generating after 10 min: ${status.generating.join(', ')}`)
    await new Promise((r) => setTimeout(r, 2000))
  }
}

function seconds(since: number) {
  return ((performance.now() - since) / 1000).toFixed(1)
}

/**
 * Each solid of a STEP file with the box of its vertices, in the file's units (mm, as the build writes them): Fusion
 * names the bodies it imports Body1, Body2, …, and the import step gives them back their names by these boxes.
 */
function stepSolidBoxes(stepFile: string) {
  const text = readFileSync(stepFile, 'utf8')
  const entities = new Map<string, { type: string; args: string }>()
  for (const m of text.matchAll(/#(\d+)\s*=\s*([A-Z_0-9]+)\s*\(([^;]*)\)\s*;/g)) entities.set(m[1], { type: m[2], args: m[3] })
  // A solid's entities follow it in the file, up to the next solid: its vertices are the VERTEX_POINTs among them.
  const solids: { name: string; box: number[] }[] = []
  for (const { type, args } of entities.values()) {
    if (type === 'MANIFOLD_SOLID_BREP' || type === 'BREP_WITH_VOIDS') {
      const name = /^\s*'((?:[^']|'')*)'/.exec(args)?.[1].replace(/''/g, "'") ?? ''
      solids.push({ name, box: [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity] })
    } else if (type === 'VERTEX_POINT' && solids.length) {
      const point = entities.get(/#(\d+)/.exec(args)?.[1] ?? '')
      const xyz = /\(([^()]*)\)\s*$/.exec(point?.args ?? '')?.[1].split(',').map(Number)
      if (!xyz || xyz.length !== 3) continue
      const box = solids[solids.length - 1].box
      for (let i = 0; i < 3; i++) {
        box[i] = Math.min(box[i], xyz[i])
        box[i + 3] = Math.max(box[i + 3], xyz[i])
      }
    }
  }
  return solids
}
