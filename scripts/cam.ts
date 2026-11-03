// `pnpm cam <model>`: ShopBot (OpenSBP, .sbp) files for a model, one per sheet, made by Fusion's CAM in the Fusion
// desktop app running on this machine, driven through its local MCP server: no clicks.
//
// The model's STEP (`.docs/<model>/<model>.step`: an assembly, one component per part) is imported into a new Fusion
// document. Its parts are grouped by material and thickness (what Fusion's Arrange does not do); each group is laid flat
// and nested by Fusion's Arrange on as many sheets as it takes; each sheet gets a milling setup (the sheet as stock,
// the narrowest tool of scripts/cam/tools.json that cuts through it, a 2D pocket, a 2D contour with tabs, the rest
// with the narrowest tool), posted to `.docs/<model>/cam/<model>_<material>_<thickness>mm_<n>.sbp`. A part with setups of its own in the manifest (a wedge, see
// cam/manifest.ts) gets one more file per setup, `<Part>_<setup>.sbp`. Then the document is closed, unsaved (`--keep`
// leaves it open, to simulate the setups in Fusion). Files already there are kept (`--force` makes them again).
//
//   pnpm cam zigzag-chair [--sheet 2440x1220] [--tool 2] [--only Seat,Back]
//   pnpm cam zigzag-chair --force --keep   # then Simulate the setups in Fusion
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
import {
  MATERIALS_FILE,
  SPACING_OVER_TOOL,
  TOOLS_FILE,
  loadMaterials,
  loadTools,
  machiningJob,
  machiningProblems,
  pickTool,
  resolveMachining,
  restTool,
  type Machining,
  type MachiningOptions,
  type Tool,
} from './cam/machining.ts'
import { loadManifest, manifestPaths, stepParts, type Setup } from './cam/manifest.ts'

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
    sheet: { type: 'string' },
    spacing: { type: 'string' },
    only: { type: 'string' },
    force: { type: 'boolean', default: false },
    keep: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    'list-tools': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
})

const USAGE = `usage: pnpm cam [<model>] [options]      (no model: every model, one after the other)
  --step <file>          the assembly STEP to read the parts from (default .docs/<model>/<model>.step)
  --post <text>          the library post whose vendor/description contains it (default shopbot)
  --tool <number>        this tool of scripts/cam/tools.json for every sheet (default: per sheet, the narrowest that reaches)
  --sheet <LxW>          the sheet, mm (default 2440x1220)
  --spacing <mm>         between two parts on a sheet (default 12; at least the tool's diameter + ${SPACING_OVER_TOOL})
  --only <A,B>           these parts only
  --force                make the files again (all of them, without --only)
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
const { library, tools } = loadTools()
const materials = loadMaterials()
const sheetFlag = flags.sheet?.split('x').map(Number)
const cli: MachiningOptions = {
  tool: flags.tool === undefined ? undefined : Number(flags.tool),
  sheet: sheetFlag as [number, number] | undefined,
  spacing: flags.spacing === undefined ? undefined : Number(flags.spacing),
}
const cliProblems = machiningProblems(cli)
if (cliProblems.length) fail(`--tool/--sheet/--spacing: ${cliProblems.join('; ')}`)
const options = resolveMachining(cli, manifest.defaults)
if (options.tool !== undefined && !tools.some((t) => t.number === options.tool)) fail(`no tool #${options.tool} in scripts/cam/tools.json (${tools.map((t) => t.number).join(', ')})`)
const post = flags.post ?? manifest.defaults?.post ?? 'shopbot'
const only = flags.only?.split(',').map((s) => s.trim())
const out = join(DOCS, model, 'cam')

const parts = stepParts(step)
if (!parts.length) fail(`${shown(step)} is not an assembly (no NEXT_ASSEMBLY_USAGE_OCCURRENCE): rebuild it with \`nr build:parts\``)
for (const entry of manifest.parts) if (!parts.includes(entry.part)) fail(`${from ? shown(from) : 'manifest'}: no part ${entry.part} in ${shown(step)}`)
for (const name of only ?? []) if (!parts.includes(name)) fail(`--only: no part ${name} in ${shown(step)} (${parts.join(', ')})`)
const entryOf = (name: string) => manifest.parts.find((entry) => entry.part === name)
const skipped = parts.filter((name) => entryOf(name)?.skip)
const selected = parts.filter((name) => (!only || only.includes(name)) && !entryOf(name)?.skip)
/** The parts the manifest lays the other face up (`flip`). */
const flip = selected.filter((name) => entryOf(name)?.flip)
/** Each part's material: the manifest's for it, else the run's. */
const materialOf = (name: string) => entryOf(name)?.material ?? options.material
/** The parts kept with their grain along x, turned this many degrees more: those of a material with grain. */
const grain = Object.fromEntries(selected.filter((name) => materials[materialOf(name)].grain).map((name) => [name, entryOf(name)?.grain ?? 0]))
/** The parts' setups of their own (a wedge): one file each, beside the sheets. */
const ownSetups = selected.flatMap((part) => (entryOf(part)?.setups ?? []).map((setup) => ({ part, setup })))

console.log(`cam: ${model}, ${selected.length} parts from ${shown(step)}, manifest ${from ? shown(from) : '(none)'}`)
if (skipped.length) console.log(`cam: skipping ${skipped.map((name) => `${name} (${entryOf(name)?.note ?? 'skip in manifest'})`).join(', ')}`)

const there = existsSync(out) ? readdirSync(out).filter((file) => file.endsWith('.sbp')) : []
if (there.length && !flags.force) {
  console.log(`cam: files already there (${there.join(', ')}): --force makes them again`)
  process.exit(0)
}

const SCRIPT = readFileSync(join(import.meta.dirname, 'cam', 'fusion-job.py'), 'utf8')
/** The script for one step: JOB first (a JSON string is a valid Python string literal), then fusion-job.py. */
const script = (job: Record<string, unknown>) => `import json\nJOB = json.loads(${JSON.stringify(JSON.stringify(job))})\n${SCRIPT}`

/** This run's tag on the document it imports: how later steps find it, and how it is told from the user's. */
const tag = `integral-cam-${process.pid}-${Date.now()}`
const [sheetLength, sheetWidth] = options.sheet

if (flags['dry-run']) {
  console.log(`\nplan (nothing is sent):\n  connect ${ENDPOINT}`)
  console.log(`  import ${shown(step)}: each part's thickness, across its largest planar face`)
  console.log(`  per material and thickness: arrange ${selected.map((name) => `${name} (${materialOf(name)})`).join(', ')} on ${sheetLength} x ${sheetWidth} mm sheets (spacing ${options.spacing} or the tool + ${SPACING_OVER_TOOL}, frame ${options.frame})${flip.length ? `, ${flip.join(', ')} the other face up` : ''}`)
  console.log(`  grain along x: ${Object.keys(grain).join(', ') || 'none'}`)
  console.log(`  per sheet: setup, pockets, outline and rest, tool ${options.tool ?? 'the narrowest that reaches'}, post ${post}`)
  console.log(`    -> ${shown(join(out, `${model}_<material>_<thickness>mm_<n>.sbp`))}`)
  for (const { part, setup } of ownSetups) {
    console.log(`  ${part}: own setup ${setup.name}, turned [${setup.rotate ?? [0, 0, 0]}]${setup.wedge ? ` on a ${setup.wedge}° wedge` : ''}, ${setup.cut === 'squared' ? 'only the faces it squares' : 'pockets and outline'}`)
    console.log(`    -> ${shown(join(out, `${part}_${setup.name}.sbp`))}`)
  }
  if (!flags.keep) console.log('  close the document, unsaved')
  process.exit(0)
}

if (!selected.length) process.exit(0)

const client = await connect()
let imported = false
const finish = async () => {
  // Only the document this run imported, found by its tag; never one that was open before.
  if (imported && flags.keep) {
    console.log('fusion: document left open, unsaved: Manufacture workspace, right-click a setup, Simulate')
  } else if (imported) {
    try {
      await runScript(client, script({ op: 'close', tag }))
      console.log('fusion: document closed, unsaved')
    } catch (error) {
      console.error(`fusion: closing the imported document failed, close it by hand: ${error instanceof Error ? error.message : error}`)
    }
  }
  await client.close()
}
process.on('SIGINT', () => void finish().then(() => process.exit(130)))

/**
 * The record of this run, beside the files (`cam.json`): for each file made, every value it was made with, the parts
 * on it, and the hashes of what made it, so that a file can be made again the same.
 */
const RECORD = join(out, 'cam.json')
type CamRecord = { version: 2; files: Record<string, unknown> }
// With --only, the other files stay: so do their entries.
const previous = existsSync(RECORD) ? (JSON.parse(readFileSync(RECORD, 'utf8')) as CamRecord) : undefined
const record: CamRecord = only && previous?.version === 2 ? previous : { version: 2, files: {} }
const inputs = Object.fromEntries(
  [step, from, TOOLS_FILE, MATERIALS_FILE, join(import.meta.dirname, 'cam', 'fusion-job.py'), join(import.meta.dirname, 'cam', 'machining.ts'), import.meta.filename]
    .filter((file): file is string => !!file)
    .map((file) => [shown(file), sha256(file)]),
)
const failed: string[] = []
/** Parts with no file: not a sheet part, no tool reaching through, larger than a sheet. */
const unmade: string[] = []
let fusionVersion = ''
try {
  const started = performance.now()
  imported = true // from here on, close it: an import cut short may still have made the document
  const imports = (await runScript(client, script({ op: 'import', tag, step }))) as { document: string; fusion: string; parts: { name: string; thickness: number | null }[] }
  fusionVersion = imports.fusion
  console.log(`fusion: ${shown(step)} imported as "${imports.document}" in ${seconds(started)} s, ${imports.parts.length} parts`)
  mkdirSync(out, { recursive: true })
  // --force without --only makes every file again: the old ones go first, so none is left from another nesting.
  if (!only) for (const file of there) unlinkSync(join(out, file))

  // The parts by material and thickness, thinnest first.
  const groups = new Map<string, { material: string; thickness: number; names: string[] }>()
  for (const { name, thickness } of imports.parts) {
    if (!selected.includes(name)) continue
    if (thickness === null) {
      unmade.push(`${name}: not a sheet part (no planar face)`)
      continue
    }
    const material = materialOf(name)
    const group = groups.get(`${material} ${thickness}`) ?? { material, thickness, names: [] }
    groups.set(`${material} ${thickness}`, { ...group, names: [...group.names, name] })
  }

  for (const { material, thickness, names } of [...groups.values()].sort((a, b) => a.thickness - b.thickness || a.material.localeCompare(b.material))) {
    let tool: Tool
    try {
      tool = pickTool(tools, thickness + options.overcut, options)
    } catch (error) {
      unmade.push(`${names.join(', ')} (${material}, ${thickness} mm): ${error instanceof Error ? error.message : error}`)
      continue
    }
    const machining = { ...options, material }
    // The outline passes between two parts: they stand more than its tool apart.
    const spacing = Math.max(options.spacing, tool.diameter + SPACING_OVER_TOOL)
    let left = names
    for (let n = 1; left.length; n++) {
      const name = `${model}_${material}_${thickness}mm_${n}`
      try {
        const began = performance.now()
        const job = { tag, sheet: name, setup: name }
        const { placed } = (await runScript(client, script({ ...job, op: 'arrange', parts: left, flip, grain, size: options.sheet, spacing, frame: options.frame }))) as { placed: string[] }
        if (!placed.length) {
          unmade.push(`${left.join(', ')} (${thickness} mm): larger than a ${sheetLength} x ${sheetWidth} mm sheet`)
          break
        }
        left = left.filter((part) => !placed.includes(part))
        const depth = thickness + options.overcut
        const given = machiningJob(tool, machining, depth, tools)
        const sheet = (await runScript(client, script({ ...job, op: 'sheet', thickness, library, stock: materials[material].stock, machining: given }))) as {
          operations: string[]
          size: number[]
          partsBox: number[]
          boxes: Record<string, number[]>
        }
        console.log(`${name}: ${material}, ${thickness} mm, tool #${tool.number}, ${placed.join(', ')}; parts within [${sheet.partsBox.join(', ')}] of ${sheet.size.join(' x ')} mm; generating`)
        await generated(name)
        const posted = await postFile(name, name, tool)
        if (!posted) throw new Error(`no toolpath with tool #${tool.number}`)
        console.log(`${name}: ${seconds(began)} s, post ${posted.post}, ${shown(join(out, `${name}.sbp`))}`)
        await postRest(name, tool, given)
        record.files[`${name}.sbp`] = {
          sha256: sha256(join(out, `${name}.sbp`)),
          material,
          thickness,
          sheet: n,
          parts: placed,
          flip: placed.filter((part) => flip.includes(part)),
          grain: Object.fromEntries(placed.filter((part) => part in grain).map((part) => [part, grain[part]])),
          size: sheet.size,
          partsBox: sheet.partsBox,
          boxes: sheet.boxes,
          spacing,
          frame: options.frame,
          ...values(tool, machining, given),
          ...posted,
          fusion: fusionVersion,
          inputs,
        }
      } catch (error) {
        failed.push(`${name}: ${error instanceof Error ? error.message : error}`)
        console.error(`${name}: failed: ${error instanceof Error ? error.message : error}`)
        break
      }
    }
  }

  for (const { part, setup } of ownSetups) {
    const name = `${part}_${setup.name}`
    try {
      const began = performance.now()
      const job = { tag, part, setup: name, rotate: setup.rotate ?? [0, 0, 0], cut: setup.cut ?? 'all' }
      const lies = (await runScript(client, script({ ...job, op: 'measure' }), { readOnly: true })) as { height: number; squaredDepth: number | null }
      // A squared setup cuts down to its faces' lowest point; any other, through the part as it lies.
      const depth = (lies.squaredDepth ?? lies.height) + options.overcut
      const tool = pickTool(tools, depth, options)
      const machining = { ...options, material: materialOf(part) }
      const given = machiningJob(tool, machining, depth, tools)
      const made = (await runScript(client, script({ ...job, op: 'part', margin: options.margin, library, stock: materials[machining.material].stock, machining: given }))) as {
        operations: string[]
        squared: { faces: number; chains: number[]; depth: number } | null
      }
      console.log(`${name}: turned [${job.rotate}], ${lies.height} mm high, cut ${depth.toFixed(1)} mm deep with tool #${tool.number}; ${made.operations.join(', ')}; generating`)
      if (made.squared) console.log(`${name}: squared faces only: ${made.squared.faces} faces, ${made.squared.chains.length} chains of ${made.squared.chains.join(', ')} edges`)
      await generated(name)
      const posted = await postFile(name, name, tool)
      if (!posted) throw new Error(`no toolpath with tool #${tool.number}`)
      console.log(`${name}: ${seconds(began)} s, post ${posted.post}, ${shown(join(out, `${name}.sbp`))}`)
      await postRest(name, tool, given)
      record.files[`${name}.sbp`] = {
        sha256: sha256(join(out, `${name}.sbp`)),
        part,
        setup: setup.name,
        rotate: job.rotate,
        wedge: setup.wedge,
        cut: job.cut,
        height: lies.height,
        depth: +depth.toFixed(3),
        margin: options.margin,
        material: machining.material,
        ...values(tool, machining, given),
        ...posted,
        fusion: fusionVersion,
        inputs,
      }
    } catch (error) {
      failed.push(`${name}: ${error instanceof Error ? error.message : error}`)
      console.error(`${name}: failed: ${error instanceof Error ? error.message : error}`)
    }
  }
} catch (error) {
  failed.push(`${model}: ${error instanceof Error ? error.message : error}`)
} finally {
  await finish()
  if (fusionVersion) writeFileSync(RECORD, `${JSON.stringify(record, null, 2)}\n`)
}
if (unmade.length) console.log(`cam: no file for:\n  ${unmade.join('\n  ')}`)
if (failed.length) {
  console.error(`cam: ${failed.length} failed:\n  ${failed.join('\n  ')}`)
  process.exit(1)
}
console.log('cam: simulate every .sbp (Fusion, ShopBot Previewer) before cutting')
process.exit(0)

/** The values a file was made with, for the record: the tools and what Fusion was given. */
function values(tool: Tool, machining: Machining, given: ReturnType<typeof machiningJob>) {
  const rest = restTool(tools, tool)
  return { ...given, tool: tool.description, toolNumber: tool.number, restTool: rest?.description, reach: machining.reach, nutClearance: machining.nutClearance, tabsLeave: machining.tabs || null }
}

/**
 * The rest pass of setup `name`, if Fusion found any rest, to its own file `<name>_rest.sbp` (its own tool: Fusion for
 * Personal Use posts no tool change), recorded.
 */
async function postRest(name: string, tool: Tool, given: ReturnType<typeof machiningJob>) {
  const rest = given.rest
  const narrow = rest && tools.find((t) => t.number === rest.tool)
  if (!rest || !narrow) return
  const file = `${name}_rest`
  const posted = await postFile(name, file, narrow)
  if (!posted) return
  console.log(`${file}: what tool #${tool.number} leaves, tool #${narrow.number} down to ${rest.depth} mm, ${shown(join(out, `${file}.sbp`))}`)
  record.files[`${file}.sbp`] = {
    sha256: sha256(join(out, `${file}.sbp`)),
    after: `${name}.sbp`,
    tool: narrow.description,
    toolNumber: narrow.number,
    restAfterDiameter: tool.diameter,
    depth: rest.depth,
    ...posted,
    fusion: fusionVersion,
    inputs,
  }
}

/** Wait while Fusion generates the setup's toolpaths, asking every 2 s; 10 minutes at most. Fails on an error or a warning. */
async function generated(setup: string) {
  const until = Date.now() + 10 * 60_000
  for (;;) {
    const status = (await runScript(client, script({ op: 'status', tag, setup }), { readOnly: true })) as { generating: string[]; failed: string[]; warned: string[]; empty: string[] }
    if (!status.generating.length) {
      if (status.failed.length) throw new Error(`toolpaths failed: ${status.failed.join('; ')}`)
      if (status.warned.length) throw new Error(`toolpaths with warnings: ${status.warned.join('; ')}`)
      if (status.empty.length) console.log(`${setup}: nothing to cut for ${status.empty.join(', ')}, left out`)
      return
    }
    if (Date.now() > until) throw new Error(`toolpaths still generating after 10 min: ${status.generating.join(', ')}`)
    await new Promise((r) => setTimeout(r, 2000))
  }
}

/**
 * Post the setup's operations with `tool` to `<name>.sbp`; check the file is new and cuts no deeper than the tool's
 * flutes. Undefined when none of them has a toolpath.
 */
async function postFile(setup: string, name: string, tool: Tool) {
  const file = join(out, `${name}.sbp`)
  const posting = Date.now()
  const posted = (await runScript(client, script({ op: 'post', tag, setup, tool: tool.number, post, folder: out, file: name }))) as { post: string | null; postVersion: string }
  if (!posted.post) return undefined
  if (!existsSync(file) || statSync(file).mtimeMs < posting - 1000) throw new Error(`posted with ${posted.post}, but no new ${shown(file)}`)
  const deepest = -deepestCut(file)
  if (deepest > tool.fluteLength) {
    unlinkSync(file)
    throw new Error(`cuts ${deepest.toFixed(1)} mm deep, more than tool #${tool.number}'s ${tool.fluteLength} mm flutes (file removed)`)
  }
  return { post: posted.post, postVersion: posted.postVersion, deepest: +deepest.toFixed(3) }
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
