// `pnpm cam <model>`: ShopBot (OpenSBP, .sbp) files for every board of a model, made by Fusion's CAM in the Fusion
// desktop app running on this machine, driven through its local MCP server: no clicks.
//
// The model's STEP (`.docs/<model>/<model>.step`, from `nr build:parts`) is imported into a new Fusion document; for
// each of its boards and each of its setups (its manifest's, see cam/manifest.ts; else one, `main`, the board laid
// flat on its largest face): how the board lies and how high, the faces a tool from the top cannot reach (reported),
// the tool (cam/machining.ts: the narrowest of scripts/cam/tools.json that reaches through it); then a milling setup
// on the board (box stock, `--margin` mm around; WCS at the stock's top corner; the board first turned as it lies),
// its operations (a 2D pocket on the pockets, a 2D contour around the outside, through, with tabs), their toolpaths,
// an NC program posted with the Fusion library post matching `--post` to `.docs/<model>/cam/<Board>_<setup>.sbp`.
// Then the document is closed, unsaved (`--keep` leaves it open, to simulate the setups in Fusion). A file already
// there is kept (`--force` makes it again).
//
//   pnpm cam zigzag-chair [--post shopbot] [--tool flat-6-2f] [--only Seat]
//   pnpm cam zigzag-chair --only Seat --force --keep   # then Simulate the setups in Fusion
//   pnpm cam --force                       # every model, one after the other
//   pnpm cam zigzag-chair --dry-run        # the plan, without connecting
//   pnpm cam --list-tools                  # what Fusion's MCP server offers
//
// Simulate every .sbp before cutting.

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { ENDPOINT, connect, runScript } from './cam/fusion.ts'
import { TOOLS_FILE, loadTools, machiningJob, machiningProblems, pickTool, resolveMachining, type Machining, type MachiningOptions, type Tool } from './cam/machining.ts'
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
    post: { type: 'string' },
    tool: { type: 'string' },
    margin: { type: 'string' },
    only: { type: 'string' },
    force: { type: 'boolean', default: false },
    keep: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    'list-tools': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
})

const USAGE = `usage: pnpm cam [<model>] [options]      (no model: every model, one after the other)
  --step <file>          the STEP to read the boards from (default .docs/<model>/<model>.step)
  --post <text>          the library post whose vendor/description contains it (default shopbot)
  --tool <id>            this tool of scripts/cam/tools.json for every board (default: per board, the narrowest that reaches)
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
  // Every model (a folder with its <name>.ts, as the build finds them), each in its own run with the same flags.
  const models = readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(ROOT, entry.name, `${entry.name}.ts`)))
    .map((entry) => entry.name)
  const failed = models.filter((name) => {
    console.log(`\n== ${name}`)
    const run = spawnSync(process.execPath, [import.meta.filename, name, ...process.argv.slice(2)], { stdio: 'inherit' })
    return run.status !== 0
  })
  if (failed.length) fail(`failed: ${failed.join(', ')}`)
  process.exit(0)
}
if (!existsSync(join(ROOT, model, `${model}.ts`))) fail(`no model ${model} (no ${model}/${model}.ts)`)

const step = resolve(flags.step ?? join(DOCS, model, `${model}.step`))
if (!existsSync(step)) fail(`no STEP at ${shown(step)}: run \`nr build:parts\` first, or pass --step`)
const { manifest, from } = loadManifest(manifestPaths(ROOT, DOCS, model))
const tools = loadTools()
const cli: MachiningOptions = { tool: flags.tool, margin: flags.margin === undefined ? undefined : Number(flags.margin) }
const cliProblems = machiningProblems(cli)
if (cliProblems.length) fail(`--tool/--margin: ${cliProblems.join('; ')}`)
for (const id of [cli.tool, manifest.defaults?.tool, ...manifest.parts.map((p) => p.tool)]) {
  if (id && !tools.some((t) => t.id === id)) fail(`no tool "${id}" in scripts/cam/tools.json (${tools.map((t) => t.id).join(', ')})`)
}
const post = flags.post ?? manifest.defaults?.post ?? 'shopbot'
const only = flags.only?.split(',').map((s) => s.trim())
const out = join(DOCS, model, 'cam')

/**
 * One setup to post. `rotate`: the board's turn, null to lay it flat (found in Fusion); `reference`: the turn of the
 * board's first setup, which a `cut: "squared"` setup squares the faces of; `others`: the turns of its squared
 * setups, which cut faces the others cannot reach.
 */
type Job = {
  body: string
  setup: Setup
  rotate: [number, number, number] | null
  reference: [number, number, number]
  others: [number, number, number][]
  machining: Machining
  file: string
}
const jobs: Job[] = []
const skipped: string[] = []
for (const body of stepBodies(step)) {
  if (only && !only.includes(body)) continue
  const { part, setups } = setupsOf(manifest, body)
  if (part?.skip) {
    skipped.push(`${body} (skip in manifest${part.note ? `: ${part.note}` : ''})`)
    continue
  }
  const machining = resolveMachining(cli, part, manifest.defaults)
  const squared = setups.filter(({ setup }) => setup.cut === 'squared').map(({ rotate }): [number, number, number] => rotate ?? [0, 0, 0])
  for (const { setup, rotate } of setups) {
    const file = join(out, `${body}_${setup.name}.sbp`)
    if (existsSync(file) && !flags.force) skipped.push(`${body}_${setup.name} (already there)`)
    else jobs.push({ body, setup, rotate, reference: setups[0].rotate ?? [0, 0, 0], others: squared, machining, file })
  }
}

console.log(`cam: ${model}, ${jobs.length} setups to post, boards from ${shown(step)}, manifest ${from ? shown(from) : '(none)'}`)
if (skipped.length) console.log(`cam: skipping ${skipped.join(', ')}`)
if (only) for (const name of only) if (!jobs.some((j) => j.body === name) && !skipped.some((s) => s.startsWith(name))) console.log(`cam: no board ${name} in the STEP`)

const SCRIPT = readFileSync(join(import.meta.dirname, 'cam', 'fusion-job.py'), 'utf8')
/** The script for one step: JOB first (a JSON string is a valid Python string literal), then fusion-job.py. */
const script = (job: Record<string, unknown>) => `import json\nJOB = json.loads(${JSON.stringify(JSON.stringify(job))})\n${SCRIPT}`

/** This run's tag on the document it imports: how later steps find it, and how it is told from the user's. */
const tag = `integral-cam-${process.pid}-${Date.now()}`
const setupName = (job: Job) => `${job.body}_${job.setup.name}`
const steps = {
  import: () => ({ op: 'import', tag, step, solids: stepSolidBoxes(step) }),
  orient: (job: Job) => ({
    op: 'orient',
    tag,
    body: job.body,
    setup: setupName(job),
    rotate: job.rotate,
    cut: job.setup.cut ?? 'all',
    reference: job.reference,
    others: job.others,
  }),
  setup: (job: Job, rotate: number[], tool: Tool) => ({
    op: 'setup',
    tag,
    body: job.body,
    setup: setupName(job),
    rotate,
    cut: job.setup.cut ?? 'all',
    reference: job.reference,
    margin: job.machining.margin,
    machining: machiningJob(tool, job.machining),
  }),
  status: (job: Job) => ({ op: 'status', tag, setup: setupName(job) }),
  post: (job: Job) => ({ op: 'post', tag, setup: setupName(job), post, folder: out, file: setupName(job) }),
  close: () => ({ op: 'close', tag }),
}

if (flags['dry-run']) {
  const plain = (job: Record<string, unknown>) => JSON.stringify({ ...job, solids: job.solids ? `(${(job.solids as unknown[]).length} boxes)` : undefined })
  console.log(`\nplan (nothing is sent):\n  connect ${ENDPOINT}`)
  console.log(`  fusion-job.py ${plain(steps.import())}`)
  for (const job of jobs) {
    const wedge = job.setup.wedge ? ` (on a ${job.setup.wedge}° wedge)` : ''
    const squared = job.setup.cut === 'squared' ? ` (only the faces it squares against the first setup)` : ''
    console.log(`  fusion-job.py ${plain(steps.orient(job))}${job.rotate ? '' : ' (laid flat)'}`)
    const tool = job.machining.tool ?? 'the narrowest that reaches'
    console.log(`  fusion-job.py {"op":"setup","setup":"${setupName(job)}", tool ${tool}, ${JSON.stringify(job.machining)}}${wedge}${squared}`)
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
/**
 * The record of this run, beside the files (`cam.json`): for each file made, every value it was made with, and the
 * hashes of what made it, so that a file can be made again the same (same inputs, same Fusion: the same bytes).
 */
const RECORD = join(out, 'cam.json')
const record = (existsSync(RECORD) ? JSON.parse(readFileSync(RECORD, 'utf8')) : { version: 1, files: {} }) as { version: 1; files: Record<string, unknown> }
const inputs = Object.fromEntries(
  [step, from, TOOLS_FILE, join(import.meta.dirname, 'cam', 'fusion-job.py'), join(import.meta.dirname, 'cam', 'machining.ts'), import.meta.filename]
    .filter((file): file is string => !!file)
    .map((file) => [shown(file), sha256(file)]),
)
let fusionVersion = ''
/** The files that do not cut the whole board: what a single setup from the top cannot reach. */
const incomplete: string[] = []
try {
  const started = performance.now()
  imported = true // from here on, close it: an import cut short may still have made the document
  const { bodies, document, fusion } = (await runScript(client, script(steps.import()))) as { bodies: string[]; document: string; fusion: string }
  fusionVersion = fusion
  console.log(`fusion: ${shown(step)} imported as "${document}" in ${seconds(started)} s, bodies ${bodies.join(', ')}`)
  mkdirSync(out, { recursive: true })
  for (const job of jobs) {
    const name = setupName(job)
    try {
      const began = performance.now()
      const lies = (await runScript(client, script(steps.orient(job)), { readOnly: true })) as {
        rotate: number[]
        height: number
        squaredDepth?: number | null
        unreachable?: Record<string, number>
      }
      // A squared setup cuts down to its faces' lowest point; any other, through the board as it lies.
      const depth = (lies.squaredDepth ?? lies.height) + job.machining.overcut
      const tool = pickTool(tools, depth, job.machining)
      const turn = lies.rotate.some((a) => a) ? `turned [${lies.rotate.map((a) => +a.toFixed(3)).join(', ')}]` : 'as modelled'
      console.log(`${name}: lies ${turn}${job.rotate ? '' : ' (laid flat)'}, ${lies.height} mm high; cut ${depth.toFixed(1)} mm deep with ${tool.id} (${tool.diameter} mm, ${tool.fluteLength} mm flutes)`)
      const outOfReach = Object.entries(lies.unreachable ?? {})
      if (outOfReach.length) {
        const count = outOfReach.reduce((sum, [, n]) => sum + n, 0)
        const message = `not reachable from the top: ${count} ${count === 1 ? 'face' : 'faces'} (${outOfReach.map(([kind, n]) => `${n} ${kind}`).join(', ')}); this file does not cut them`
        console.log(`${name}: ${message}`)
        incomplete.push(`${name}: ${message}`)
      }

      const made = (await runScript(client, script(steps.setup(job, lies.rotate, tool)))) as {
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
      const posted = (await runScript(client, script(steps.post(job)))) as { post: string; postVersion: string }
      if (!existsSync(job.file) || statSync(job.file).mtimeMs < posting - 1000) {
        throw new Error(`posted with ${posted.post}, but no new ${shown(job.file)}`)
      }
      // The tool was chosen to reach the board as it lies: a cut deeper than its flutes is a mistake somewhere.
      const deepest = -deepestCut(job.file)
      if (deepest > tool.fluteLength) {
        unlinkSync(job.file)
        delete record.files[`${name}.sbp`]
        throw new Error(`cuts ${deepest.toFixed(1)} mm deep, more than ${tool.id}'s ${tool.fluteLength} mm flutes (file removed)`)
      }
      console.log(`${name}: ${seconds(began)} s, post ${posted.post}, ${shown(job.file)}`)
      const { tool: _fusionTool, ...values } = machiningJob(tool, job.machining)
      record.files[`${name}.sbp`] = {
        sha256: sha256(job.file),
        body: job.body,
        setup: job.setup.name,
        rotate: lies.rotate,
        laidFlat: job.rotate === null,
        height: lies.height,
        cut: job.setup.cut ?? 'all',
        depth: +depth.toFixed(3),
        tool: tool.id,
        toolNumber: tool.number,
        margin: job.machining.margin,
        reach: job.machining.reach,
        ...values,
        unreachable: lies.unreachable ?? {},
        post: posted.post,
        postVersion: posted.postVersion,
        fusion: fusionVersion,
        inputs,
      }
    } catch (error) {
      failed.push(`${name}: ${error instanceof Error ? error.message : error}`)
      console.error(`${name}: failed: ${error instanceof Error ? error.message : error}`)
    }
  }
} finally {
  await finish()
  if (fusionVersion) writeFileSync(RECORD, `${JSON.stringify(record, null, 2)}\n`)
}
if (incomplete.length) console.log(`cam: ${incomplete.length} files do not cut their whole board:\n  ${incomplete.join('\n  ')}`)
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

/** The lowest Z of an OpenSBP file's moves (M3, J3), in its units: mm below the stock top. */
function deepestCut(file: string) {
  let lowest = 0
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const move = /^[MJ]3\s*,\s*([^,]*),\s*([^,]*),\s*([^,\s]*)/.exec(line)
    if (move && move[3] !== '') lowest = Math.min(lowest, Number(move[3]))
  }
  return lowest
}

function sha256(file: string) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
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
