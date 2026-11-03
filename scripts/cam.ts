// `pnpm cam <model>`: ShopBot (OpenSBP, .sbp) files for a model, one per sheet and one per setup of its own, made by
// Fusion's CAM in the Fusion desktop app running on this machine, driven through its local MCP server (cam/fusion.ts):
// each step is a script cam/fusion-job.py runs there. The files go to `.docs/<model>/cam/`, recorded in its cam.json;
// with `--values <file.json>`, the model made with those values (masters.ts), into
// `.docs/<model>/variants/<hash of the values>/cam/`.
// Flags: USAGE below. Usage, naming and the tool rule: docs/cam.md (https://abernier.github.io/integral/integral/cam).
//
// Simulate every .sbp before cutting.

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { ENDPOINT, connect, messageOf, runScript } from './cam/fusion.ts'
import {
  DEFAULT_POST,
  MACHINING_DEFAULTS,
  MATERIALS_FILE,
  SPACING_OVER_TOOL,
  TOOLS_FILE,
  loadMaterials,
  loadTools,
  machiningJob,
  machiningProblems,
  pickTool,
  resolveMachining,
  toolLimit,
  type Machining,
  type MachiningOptions,
  type Tool,
} from './cam/machining.ts'
import { configFile, loadConfig } from './cam/config.ts'
import { type Values, defaultValues, loadValues, mastersFile } from './masters.ts'
import { MDX, ROOT, parts, variantDir } from './paths.ts'
import { stepParts } from './step-assembly.ts'

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
    values: { type: 'string' },
    force: { type: 'boolean', default: false },
    keep: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    'list-tools': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
})

const USAGE = `usage: pnpm cam [<model>] [options]      (no model: every model, one after the other)
  --values <file.json>   the model made with the values of this file (the configurator's "Copy values"): its STEP built
                         first if missing (or with --force), its files into .docs/<model>/variants/<values' hash>/cam/
  --step <file>          the assembly STEP to read the parts from (default .docs/<model>/<model>.step, or the variant's;
                         cam.json then records no values)
  --post <text>          the library post whose vendor/description contains it (default ${DEFAULT_POST})
  --tool <number>        this tool of scripts/cam/tools.json for every sheet (default: per sheet, the narrowest that reaches)
  --sheet <LxW>          the sheet, mm (default ${MACHINING_DEFAULTS.sheet.join('x')})
  --spacing <mm>         between two parts on a sheet (default ${MACHINING_DEFAULTS.spacing}; at least the tool's diameter + ${SPACING_OVER_TOOL})
  --only <A,B>           these parts only, into .docs/<model>/cam/only/ (the variant's with --values) with its own
                         cam.json (the full run's files stay)
  --force                make the files again: the folder's old .sbp go first (and a --values STEP)
  --keep                 leave the document open in Fusion, unsaved, to simulate its setups
  --dry-run              print the plan, send nothing to Fusion
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
if (!model && flags.values !== undefined) fail('--values is for one model: pnpm cam <model> --values <file.json>')
if (!model) {
  // Every model (a folder with its <name>.ts, as the build finds them), each in its own run with the same flags.
  const failed = parts().filter((name) => {
    console.log(`\n== ${name}`)
    const run = spawnSync(process.execPath, [import.meta.filename, name, ...process.argv.slice(2)], { stdio: 'inherit' })
    return run.status !== 0
  })
  if (failed.length) fail(`failed: ${failed.join(', ')}`)
  process.exit(0)
}
if (!parts().includes(model)) fail(`no model ${model} (no ${model}/${model}.ts)`)

// The values first: a wrong one fails before anything is built or sent.
const variant = flags.values === undefined ? undefined : await loadValues(model, flags.values).catch((error: Error) => fail(error.message))
const values = variant?.values ?? (await defaultValues(model))
/** The model's built files: its own folder, or its variant's. */
const built = variant ? variantDir(model, variant.name) : join(MDX, model)
if (variant) console.log(`cam: ${model} variant ${variant.hash}, the values of ${shown(variant.file)}, in ${shown(built)}`)

const step = resolve(flags.step ?? join(built, `${model}.step`))
if (variant && !flags.step && (flags.force || !existsSync(step))) {
  // The build loads ClassCAD, which this script never does (paths.ts): it runs in a process of its own.
  console.log(`cam: building ${shown(step)} with ${shown(variant.file)}`)
  const build = spawnSync(process.execPath, [join(import.meta.dirname, 'build.ts'), '--parts-only', model, '--values', variant.file], { stdio: 'inherit' })
  if (build.status !== 0) fail(`building ${shown(step)} failed`)
}
if (!existsSync(step)) fail(`no STEP at ${shown(step)}: run \`nr build:parts\` first, or pass --step`)
const source = configFile(ROOT, model)
const { library, tools } = loadTools()
const materials = loadMaterials()
const config = await loadConfig(source, materials, values).catch((error: Error) => fail(error.message))
const partConfigs = config.parts ?? {}
const sheetFlag = flags.sheet?.split('x').map(Number)
const cli: MachiningOptions = {
  tool: flags.tool === undefined ? undefined : Number(flags.tool),
  sheet: sheetFlag as [number, number] | undefined,
  spacing: flags.spacing === undefined ? undefined : Number(flags.spacing),
}
const cliProblems = machiningProblems(cli, materials)
if (cliProblems.length) fail(`--tool/--sheet/--spacing: ${cliProblems.join('; ')}`)
const options = resolveMachining(cli, config.defaults)
if (options.tool !== undefined && !tools.some((t) => t.number === options.tool)) fail(`no tool #${options.tool} in scripts/cam/tools.json (${tools.map((t) => t.number).join(', ')})`)
const post = flags.post ?? config.defaults?.post ?? DEFAULT_POST
const only = flags.only?.split(',').map((s) => s.trim())
// An --only run is a run of its own, in its own folder: the full run's files and record stay as they are.
const out = only ? join(built, 'cam', 'only') : join(built, 'cam')

const stepNames = stepParts(step)
if (!stepNames.length) fail(`${shown(step)} is not an assembly (no NEXT_ASSEMBLY_USAGE_OCCURRENCE): rebuild it with \`nr build:parts\``)
for (const name of Object.keys(partConfigs)) if (!stepNames.includes(name)) fail(`${shown(source)}: CAM.parts: no part ${name} in ${shown(step)}`)
for (const name of only ?? []) if (!stepNames.includes(name)) fail(`--only: no part ${name} in ${shown(step)} (${stepNames.join(', ')})`)
const entryOf = (name: string) => partConfigs[name]
const skipped = stepNames.filter((name) => entryOf(name)?.skip)
const selected = stepNames.filter((name) => (!only || only.includes(name)) && !entryOf(name)?.skip)
/** The parts the config lays the other face up (`flip`). */
const flip = selected.filter((name) => entryOf(name)?.flip)
/** Each part's material: the config's for it, else the run's. */
const materialOf = (name: string) => entryOf(name)?.material ?? options.material
/** The parts kept with their grain along x, turned this many degrees more: those of a material with grain. */
const grain = Object.fromEntries(selected.filter((name) => materials[materialOf(name)].grain).map((name) => [name, entryOf(name)?.grain ?? 0]))
/** The parts' setups of their own (a wedge): one file each, beside the sheets. */
const ownSetups = selected.flatMap((part) => (entryOf(part)?.setups ?? []).map((setup) => ({ part, setup })))

console.log(`cam: ${model}, ${selected.length} parts from ${shown(step)}, ${config.parts || config.defaults ? `CAM config from ${shown(source)}` : 'no CAM config'}`)
if (skipped.length) console.log(`cam: skipping ${skipped.join(', ')}`)

const existing = existsSync(out) ? readdirSync(out).filter((file) => file.endsWith('.sbp')) : []
if (existing.length && !flags.force) {
  console.log(`cam: files already in ${shown(out)} (${existing.join(', ')}): --force makes them again`)
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
let finishing: Promise<void> | undefined
/** Close the imported document (unless --keep) and the connection, once: both SIGINT and the end of the run call it. */
const finish = () =>
  (finishing ??= (async () => {
    // Only the document this run imported, found by its tag; never one that was open before.
    if (imported && flags.keep) {
      console.log('fusion: document left open, unsaved: Manufacture workspace, right-click a setup, Simulate')
    } else if (imported) {
      try {
        await runScript(client, script({ op: 'close', tag }))
        console.log('fusion: document closed, unsaved')
      } catch (error) {
        console.error(`fusion: closing the imported document failed, close it by hand: ${messageOf(error)}`)
      }
    }
    await client.close()
  })())
process.on('SIGINT', () => void finish().then(() => process.exit(130)))

/**
 * The record of this run, beside the files (`cam.json`): the model, every master's value it was made with (`values`,
 * the defaults or a `--values` file's), and the variant's `hash`, and for each file made, every value it was made with, the parts on it, and the
 * hashes of what made it, so that a file can be made again the same. With `--step` the geometry is the file's, not
 * the build's, so the record names no values and no hash.
 *
 * Per file: its sha256, the tool and every value given to Fusion, the deepest cut, the post and its version, the
 * Fusion version, the sha256 of every input (`inputs`). A sheet adds its material, thickness and number, its parts
 * and their grain turn, where they lie (`partsBox`, and `boxes` per part, mm from the corner), its size, spacing and
 * frame. A wedge setup adds its turn, depth and margin; a `_rest` file its tool and depth.
 */
const RECORD = join(out, 'cam.json')
type CamRecord = { version: 3; model: string; hash?: string; values?: Values; files: Record<string, unknown> }
// The values and the hash only when the STEP is the build's: another file may hold another geometry.
const record: CamRecord = flags.step === undefined ? { version: 3, model, hash: variant?.hash, values, files: {} } : { version: 3, model, files: {} }
// The inputs' hashes: the STEP, the model's module (its `CAM` config; also its geometry, already in the STEP), its
// masters, the catalogs and the code.
const inputs = Object.fromEntries(
  [step, source, mastersFile(model), TOOLS_FILE, MATERIALS_FILE, join(import.meta.dirname, 'cam', 'fusion-job.py'), join(import.meta.dirname, 'cam', 'machining.ts'), import.meta.filename]
    .map((file) => [shown(file), sha256(file)]),
)
const failed: string[] = []
/** Parts with no file: not imported, not a sheet part, no tool reaching through, larger than a sheet, on a failed sheet. */
const unmade: string[] = []
let fusionVersion = ''
try {
  const started = performance.now()
  imported = true // from here on, close it: an import cut short may still have made the document
  const imports = (await runScript(client, script({ op: 'import', tag, step }))) as { document: string; fusion: string; parts: { name: string; thickness: number | null }[] }
  fusionVersion = imports.fusion
  console.log(`fusion: ${shown(step)} imported as "${imports.document}" in ${seconds(started)} s, ${imports.parts.length} parts`)
  mkdirSync(out, { recursive: true })
  // --force makes every file of the folder again: the old ones go first, so none is left from another nesting.
  for (const file of existing) unlinkSync(join(out, file))

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
  const importedNames = imports.parts.map((part) => part.name)
  for (const name of selected) if (!importedNames.includes(name)) unmade.push(`${name}: not imported by Fusion`)

  for (const { material, thickness, names } of [...groups.values()].sort((a, b) => a.thickness - b.thickness || a.material.localeCompare(b.material))) {
    let tool: Tool
    try {
      tool = pickTool(tools, thickness + options.overcut, options)
    } catch (error) {
      unmade.push(`${names.join(', ')} (${material}, ${thickness} mm): ${messageOf(error)}`)
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
        // None of these parts placed (larger than a sheet): another sheet would place none either.
        if (!placed.some((part) => left.includes(part))) {
          unmade.push(`${left.join(', ')} (${material}, ${thickness} mm): larger than a ${sheetLength} x ${sheetWidth} mm sheet`)
          break
        }
        left = left.filter((part) => !placed.includes(part))
        const depth = thickness + options.overcut
        const planned = machiningJob(tool, machining, depth, tools, materials)
        const sheet = (await runScript(client, script({ ...job, op: 'sheet', thickness, library, stock: materials[material].stock, machining: planned.job }))) as {
          operations: string[]
          size: number[]
          partsBox: number[]
          boxes: Record<string, number[]>
        }
        console.log(`${name}: ${material}, ${thickness} mm, tool #${tool.number}, ${placed.join(', ')}; parts within [${sheet.partsBox.join(', ')}] of ${sheet.size.join(' x ')} mm; generating`)
        await postSetup(name, began, tool, machining, planned, {
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
        })
      } catch (error) {
        failed.push(`${name}: ${messageOf(error)}`)
        console.error(`${name}: failed: ${messageOf(error)}`)
        // The group stops here: what it had left gets no file.
        if (left.length) unmade.push(`${left.join(', ')} (${material}, ${thickness} mm): not made, ${name} failed`)
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
      // A squared setup cuts down to its faces' lowest point; any other, through the part as it lies. Measured once
      // (squaredDepth unrounded): the "part" step cuts this depth.
      const depth = (lies.squaredDepth ?? lies.height) + options.overcut
      const tool = pickTool(tools, depth, options)
      const machining = { ...options, material: materialOf(part) }
      const planned = machiningJob(tool, machining, depth, tools, materials)
      const made = (await runScript(client, script({ ...job, op: 'part', depth, margin: options.margin, library, stock: materials[machining.material].stock, machining: planned.job }))) as {
        operations: string[]
        squared: { faces: number; chains: number[] } | null
      }
      console.log(`${name}: turned [${job.rotate}], ${lies.height} mm high, cut ${depth.toFixed(1)} mm deep with tool #${tool.number}; ${made.operations.join(', ')}; generating`)
      if (made.squared) console.log(`${name}: squared faces only: ${made.squared.faces} faces, ${made.squared.chains.length} chains of ${made.squared.chains.join(', ')} edges`)
      await postSetup(name, began, tool, machining, planned, {
        part,
        setup: setup.name,
        rotate: job.rotate,
        wedge: setup.wedge,
        cut: job.cut,
        height: lies.height,
        depth: +depth.toFixed(3),
        margin: options.margin,
        material: machining.material,
      })
    } catch (error) {
      failed.push(`${name}: ${messageOf(error)}`)
      console.error(`${name}: failed: ${messageOf(error)}`)
    }
  }
} catch (error) {
  failed.push(`${model}: ${messageOf(error)}`)
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

/**
 * The end of setup `name`, the same for a sheet and a part's own setup: wait for its toolpaths, post them to
 * `<name>.sbp`, record it with `fields` (what is particular to it), then its rest pass. A rest pass that fails is
 * failed alone: the main file stays, recorded. Throws when the main file is not made.
 */
async function postSetup(name: string, began: number, tool: Tool, machining: Machining, planned: ReturnType<typeof machiningJob>, fields: Record<string, unknown>) {
  await generated(name)
  const posted = await postFile(name, name, tool)
  if (!posted) throw new Error(`no toolpath with tool #${tool.number}`)
  console.log(`${name}: ${seconds(began)} s, post ${posted.post}, ${shown(join(out, `${name}.sbp`))}`)
  record.files[`${name}.sbp`] = {
    sha256: sha256(join(out, `${name}.sbp`)),
    ...fields,
    ...recordValues(tool, machining, planned),
    ...posted,
    fusion: fusionVersion,
    inputs,
  }
  try {
    await postRest(name, tool, planned)
  } catch (error) {
    failed.push(`${name}_rest: ${messageOf(error)}`)
    console.error(`${name}_rest: failed: ${messageOf(error)}`)
  }
}

/** The values a file was made with, for the record: the tools and what Fusion was given. */
function recordValues(tool: Tool, machining: Machining, { job: fusionMachining, rest }: ReturnType<typeof machiningJob>) {
  return { ...fusionMachining, tool: tool.description, toolNumber: tool.number, restTool: rest?.description, reach: machining.reach, nutClearance: machining.nutClearance, tabsLeave: machining.tabs || null }
}

/**
 * The rest pass of setup `name`, if Fusion found any rest, to its own file `<name>_rest.sbp` (its own tool: Fusion for
 * Personal Use posts no tool change), recorded.
 */
async function postRest(name: string, tool: Tool, { job: fusionMachining, rest: narrow }: ReturnType<typeof machiningJob>) {
  const rest = fusionMachining.rest
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
 * Post the setup's operations with `tool` to `<name>.sbp`; check the file is new and cuts no deeper than the tool can
 * (toolLimit: its flutes, its stickout less the nut's clearance). Undefined when none of them has a toolpath.
 */
async function postFile(setup: string, name: string, tool: Tool) {
  const file = join(out, `${name}.sbp`)
  const posting = Date.now()
  const posted = (await runScript(client, script({ op: 'post', tag, setup, tool: tool.number, post, folder: out, file: name }))) as { post: string | null; postVersion: string }
  if (!posted.post) return undefined
  if (!existsSync(file) || statSync(file).mtimeMs < posting - 1000) throw new Error(`posted with ${posted.post}, but no new ${shown(file)}`)
  const deepest = -deepestCut(file)
  const limit = toolLimit(tool, options)
  if (deepest > limit) {
    unlinkSync(file)
    const why = limit === tool.fluteLength ? `its ${tool.fluteLength} mm flutes` : `${tool.stickout} mm out of the collet less ${options.nutClearance} for the nut`
    throw new Error(`cuts ${deepest.toFixed(1)} mm deep, deeper than tool #${tool.number} can: ${why} (file removed)`)
  }
  return { post: posted.post, postVersion: posted.postVersion, deepest: +deepest.toFixed(3) }
}

/** The lowest Z of an OpenSBP file's moves (M3, J3, and Z alone: MZ, JZ), in its units: mm below the stock top. */
function deepestCut(file: string) {
  let lowest = 0
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const move = /^[MJ]3\s*,\s*([^,]*),\s*([^,]*),\s*([^,\s]*)/.exec(line)
    if (move && move[3] !== '') lowest = Math.min(lowest, Number(move[3]))
    const plunge = /^[MJ]Z\s*,\s*([^,\s]+)/.exec(line)
    if (plunge) lowest = Math.min(lowest, Number(plunge[1]))
  }
  return lowest
}

function sha256(file: string) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

function seconds(since: number) {
  return ((performance.now() - since) / 1000).toFixed(1)
}
