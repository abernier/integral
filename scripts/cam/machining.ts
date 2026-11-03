// How `pnpm cam` cuts a sheet: the material's tool preset, the tool chosen per sheet from the Fusion tool library
// (`scripts/cam/tools.json`, Fusion's own JSON, edited in Fusion), and the values sent with it to Fusion
// (fusion-job.py applies them and has none of its own).
//
// The values are, from the strongest: the CLI's, the model's manifest's (`defaults`), these defaults.
//
// The tool: the one numbered `tool`, else the narrowest of the library whose flutes reach the cut: the sheet's
// thickness, `overcut` below it, and `reach` more to spare. Feeds, speeds, stepdown and stepover are the tool's
// preset named in materials.json for the sheet's material: Fusion's, not ours.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** A tool of the library, as the selection rule sees it: its number (`&Tool = <number>`) and size, mm. */
export type Tool = { number: number; description: string; diameter: number; fluteLength: number }

/** A material of materials.json: whether its parts keep their grain along their length, its tool preset's name. */
export type Material = { grain: boolean; preset: string; stock?: string; note?: string }

/** Holding tabs on the outline: how many per contour, how wide, and how much wood they leave (mm). */
export type Tabs = { count: number; width: number; height: number }

/** The values a manifest's `defaults` or the CLI may set. Lengths in mm. */
export type MachiningOptions = {
  /** A tool's number in tools.json for every sheet, instead of the one chosen by thickness. */
  tool?: number
  /** A material of materials.json. */
  material?: string
  /** The sheet, [length along x, width along y]. */
  sheet?: [number, number]
  /** Space between two parts on a sheet, at least the sheet's tool diameter + SPACING_OVER_TOOL. */
  spacing?: number
  /** Space kept free along the sheet's edges. */
  frame?: number
  /** Stock around a part in a setup of its own (a wedge), on its sides. */
  margin?: number
  /** How far the outline cuts below the stock's bottom, into the spoilboard. */
  overcut?: number
  /** Flute length to spare beyond the deepest cut, when choosing the tool. */
  reach?: number
  /** The outline's holding tabs, given in part (the rest from the defaults), or false for none. */
  tabs?: Partial<Tabs> | false
}

export const MACHINING_DEFAULTS = {
  material: 'hardwood',
  sheet: [2440, 1220] as [number, number],
  spacing: 12,
  frame: 10,
  margin: 5,
  overcut: 0.3,
  reach: 1,
  tabs: { count: 4, width: 6, height: 3 } as Tabs,
}

/** Two parts stand at least the tool's diameter and this much apart (mm), so the outline passes between them. */
export const SPACING_OVER_TOOL = 4
/** Holes taken as pockets: those the tool fits in, with this much more (mm) across. */
const HOLE_CLEARANCE = 0.5
/** Pockets of any corner radius (mm). */
const CORNER_RADIUS = [0, 1000]

export const MACHINING_KEYS = ['tool', 'material', 'sheet', 'spacing', 'frame', 'margin', 'overcut', 'reach', 'tabs'] as const
const TAB_KEYS = ['count', 'width', 'height'] as const

/** The problems with a manifest's (or the CLI's) machining values, as messages; none when they are right. */
export function machiningProblems(options: Record<string, unknown>) {
  const problems: string[] = []
  const positive = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0
  if (options.margin !== undefined && !positive(options.margin)) problems.push('margin must be a number of mm above 0')
  for (const key of ['spacing', 'frame', 'overcut', 'reach'] as const) {
    const value = options[key]
    if (value !== undefined && !(typeof value === 'number' && Number.isFinite(value) && value >= 0)) problems.push(`${key} must be a number of mm, 0 or more`)
  }
  const sheet = options.sheet
  if (sheet !== undefined && !(Array.isArray(sheet) && sheet.length === 2 && sheet.every(positive))) problems.push('sheet must be [length, width] in mm')
  if (options.tool !== undefined && !Number.isInteger(options.tool)) problems.push('tool must be a tool number of scripts/cam/tools.json')
  if (options.material !== undefined && !(options.material as string in loadMaterials())) problems.push(`material must be one of scripts/cam/materials.json (${Object.keys(loadMaterials()).join(', ')})`)
  const tabs = options.tabs
  if (tabs !== undefined && tabs !== false) {
    if (typeof tabs !== 'object' || tabs === null) problems.push('tabs must be { count, width, height } or false')
    else {
      for (const [key, value] of Object.entries(tabs)) {
        if (!(TAB_KEYS as readonly string[]).includes(key)) problems.push(`tabs.${key}: unknown (count, width, height)`)
        else if (!positive(value) || (key === 'count' && !Number.isInteger(value))) problems.push(`tabs.${key} must be a ${key === 'count' ? 'whole number' : 'number of mm'} above 0`)
      }
    }
  }
  return problems
}

/** The machining values of a run: each from the strongest of `layers` (strongest first) that has it. */
export function resolveMachining(...layers: (MachiningOptions | undefined)[]) {
  const pick = <K extends keyof MachiningOptions>(key: K) => layers.find((layer) => layer?.[key] !== undefined)?.[key]
  const tabs = pick('tabs')
  return {
    tool: pick('tool') as number | undefined,
    material: (pick('material') as string | undefined) ?? MACHINING_DEFAULTS.material,
    sheet: (pick('sheet') as [number, number] | undefined) ?? MACHINING_DEFAULTS.sheet,
    spacing: (pick('spacing') as number | undefined) ?? MACHINING_DEFAULTS.spacing,
    frame: (pick('frame') as number | undefined) ?? MACHINING_DEFAULTS.frame,
    margin: (pick('margin') as number | undefined) ?? MACHINING_DEFAULTS.margin,
    overcut: (pick('overcut') as number | undefined) ?? MACHINING_DEFAULTS.overcut,
    reach: (pick('reach') as number | undefined) ?? MACHINING_DEFAULTS.reach,
    tabs: tabs === false ? (false as const) : { ...MACHINING_DEFAULTS.tabs, ...tabs },
  }
}

export type Machining = ReturnType<typeof resolveMachining>

export const TOOLS_FILE = join(import.meta.dirname, 'tools.json')
export const MATERIALS_FILE = join(import.meta.dirname, 'materials.json')

/** The library as Fusion wrote it (sent as is to Fusion), and its tools as the selection rule sees them. */
export function loadTools(file = TOOLS_FILE) {
  const library = readFileSync(file, 'utf8')
  const { data } = JSON.parse(library) as { data?: { description: string; geometry: { DC: number; LCF: number }; 'post-process': { number: number } }[] }
  if (!Array.isArray(data) || !data.length) throw new Error(`${file}: no tools (a Fusion tool library, exported as JSON)`)
  const tools: Tool[] = data.map((t) => ({ number: t['post-process'].number, description: t.description, diameter: t.geometry.DC, fluteLength: t.geometry.LCF }))
  return { library, tools }
}

export function loadMaterials(file = MATERIALS_FILE) {
  const list = JSON.parse(readFileSync(file, 'utf8')) as { version: number; materials: Record<string, Material> }
  if (list.version !== 1) throw new Error(`${file}: version ${list.version}, expected 1`)
  return list.materials
}

/**
 * The tool for a cut `depth` mm deep: the one `machining.tool` numbers, else the narrowest whose flutes reach it (the
 * shorter of two as narrow). Throws when none does.
 */
export function pickTool(tools: Tool[], depth: number, machining: Machining) {
  const needed = depth + machining.reach
  if (machining.tool !== undefined) {
    const tool = tools.find((t) => t.number === machining.tool)
    if (!tool) throw new Error(`no tool #${machining.tool} in scripts/cam/tools.json (${tools.map((t) => t.number).join(', ')})`)
    if (tool.fluteLength < needed) throw new Error(`tool #${tool.number} reaches ${tool.fluteLength} mm, the cut needs ${needed.toFixed(1)} mm (${depth.toFixed(1)} deep, ${machining.reach} to spare)`)
    return tool
  }
  const reaching = tools.filter((t) => t.fluteLength >= needed).sort((a, b) => a.diameter - b.diameter || a.fluteLength - b.fluteLength)
  if (!reaching.length) {
    const longest = Math.max(...tools.map((t) => t.fluteLength))
    throw new Error(`no tool reaches ${needed.toFixed(1)} mm (${depth.toFixed(1)} deep, ${machining.reach} to spare): the longest flutes in scripts/cam/tools.json are ${longest} mm`)
  }
  return reaching[0]
}

/** The narrowest tool of the library (the longer of two as narrow), for what the main tool leaves; none if it is that tool's width. */
export function restTool(tools: Tool[], main: Tool) {
  const narrowest = [...tools].sort((a, b) => a.diameter - b.diameter || b.fluteLength - a.fluteLength)[0]
  return narrowest.diameter < main.diameter ? narrowest : undefined
}

/** What fusion-job.py reads in JOB["machining"]: every value resolved, in mm. */
export function machiningJob(tool: Tool, machining: Machining, depth: number, tools: Tool[]) {
  const rest = restTool(tools, tool)
  const restDepth = rest ? +Math.min(depth, rest.fluteLength - machining.reach).toFixed(3) : 0
  return {
    tool: tool.number,
    preset: loadMaterials()[machining.material].preset,
    overcut: machining.overcut,
    // Fusion measures a tab from the cut's bottom, `overcut` below the wood: the wood a tab leaves is `height`.
    tabs: machining.tabs === false ? null : { ...machining.tabs, height: +(machining.tabs.height + machining.overcut).toFixed(3) },
    minimumHoleDiameter: tool.diameter + HOLE_CLEARANCE,
    cornerRadius: CORNER_RADIUS,
    // After the outline, what this tool leaves (narrow sockets, corners): the narrowest tool, as deep as its flutes reach.
    rest: rest ? { tool: rest.number, after: tool.diameter, depth: restDepth, through: restDepth >= +depth.toFixed(3) } : null,
  }
}
