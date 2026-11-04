// How `pnpm cam` cuts: the machining values of a run (the CLI's, over the model's CAM config's `defaults`, over
// MACHINING_DEFAULTS), the tool chosen per cut from the Fusion tool library (`scripts/cam.tools.json`), and what is
// sent with it to Fusion (cam.fusion-job.py applies it and has no values of its own). Usage, naming and the tool rule:
// docs/cam.md (https://abernier.github.io/integral/integral/cam).

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * A tool of the library, as the selection rule sees it: its number (`&Tool = <number>`) and size, mm. `stickout`: its
 * length out of the collet (Fusion's `assemblyGaugeLength`).
 */
export type Tool = { number: number; description: string; diameter: number; fluteLength: number; stickout: number }

/** A material of cam.materials.json: whether its parts keep their grain along their length, its tool preset's name. */
export type Material = { grain: boolean; preset: string; stock?: string; note?: string }

/** Holding tabs on the outline: how many per contour, how wide, and how much wood they leave (mm). */
export type Tabs = { count: number; width: number; height: number }

/** The values a model's CAM config `defaults` or the CLI may set. Lengths in mm. */
export type MachiningOptions = {
  /** A tool's number in cam.tools.json for every sheet, instead of the one chosen by thickness. */
  tool?: number
  /** A material of cam.materials.json. */
  material?: string
  /** The sheet, [length along x, width along y]. */
  sheet?: [number, number]
  /** Space between two parts on a sheet, at least the sheet's tool diameter + SPACING_OVER_TOOL. */
  spacing?: number
  /** Space kept free along the sheet's edges: the outline's lead-in stays on the sheet. */
  frame?: number
  /** Stock around a part in a setup of its own (a wedge), on its sides. */
  margin?: number
  /** How far the outline cuts below the stock's bottom, into the spoilboard. */
  overcut?: number
  /** Flute length to spare beyond the deepest cut, when choosing the tool. */
  reach?: number
  /** Tool length out of the collet to spare beyond the deepest cut: the collet nut stays this far above the cut's bottom. */
  nutClearance?: number
  /** The outline's holding tabs, given in part (the rest from the defaults), or false for none. */
  tabs?: Partial<Tabs> | false
}

/** The machining values when neither the CLI nor the model's CAM config `defaults` sets them. */
export const MACHINING_DEFAULTS = {
  material: 'hardwood',
  sheet: [2440, 1220],
  spacing: 12,
  frame: 20,
  margin: 5,
  overcut: 0.3,
  reach: 1,
  // 5 mm keeps the nut clear of the stock top through what the cut depth does not see: a sheet thicker than its
  // nominal size or not flat, a Z zero off by a millimetre or two, chips on the surface, the nut's own chamfer.
  nutClearance: 5,
  tabs: { count: 4, width: 6, height: 3 },
} satisfies Required<Omit<MachiningOptions, 'tool' | 'tabs'>> & { tabs: Tabs }

/** The post when neither the CLI (`--post`) nor the model's CAM config `defaults.post` names one: ShopBot OpenSBP. */
export const DEFAULT_POST = 'shopbot'

/** Two parts stand at least the tool's diameter and this much apart (mm), so the outline passes between them. */
export const SPACING_OVER_TOOL = 4
/** Holes taken as pockets: those the tool fits in, with this much more (mm) across. */
const HOLE_CLEARANCE = 0.5
/** Shank length (mm) a collet must hold at least: about 2/3 of an ER20/ER25 collet's bore. */
const MINIMUM_GRIP = 20
/** Pockets of any corner radius (mm). */
const CORNER_RADIUS = [0, 1000]

/**
 * The problems with a CAM config's (or the CLI's) machining values, as messages; none when they are right.
 * `materials`: cam.materials.json's, when `options` names one.
 */
export function machiningProblems(options: MachiningOptions, materials?: Record<string, Material>) {
  const problems: string[] = []
  const positive = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0
  if (options.margin !== undefined && !positive(options.margin)) problems.push('margin must be a number of mm above 0')
  for (const key of ['spacing', 'frame', 'overcut', 'reach', 'nutClearance'] as const) {
    const value = options[key]
    if (value !== undefined && !(typeof value === 'number' && Number.isFinite(value) && value >= 0)) problems.push(`${key} must be a number of mm, 0 or more`)
  }
  const sheet = options.sheet
  if (sheet !== undefined && !(sheet.length === 2 && sheet.every(positive))) problems.push('sheet must be [length, width] in mm')
  if (options.tool !== undefined && !Number.isInteger(options.tool)) problems.push('tool must be a tool number of scripts/cam.tools.json')
  if (options.material !== undefined && !(materials && options.material in materials)) problems.push(`material must be one of scripts/cam.materials.json (${Object.keys(materials ?? {}).join(', ')})`)
  const tabs = options.tabs
  if (tabs) {
    for (const [key, value] of Object.entries(tabs)) {
      if (!positive(value) || (key === 'count' && !Number.isInteger(value))) problems.push(`tabs.${key} must be a ${key === 'count' ? 'whole number' : 'number of mm'} above 0`)
    }
  }
  return problems
}

/** The machining values of a run: each from the strongest of `layers` (strongest first) that has it. */
export function resolveMachining(...layers: (MachiningOptions | undefined)[]) {
  const pick = <K extends keyof MachiningOptions>(key: K) => layers.find((layer) => layer?.[key] !== undefined)?.[key]
  const tabs = pick('tabs')
  return {
    tool: pick('tool'),
    material: pick('material') ?? MACHINING_DEFAULTS.material,
    sheet: pick('sheet') ?? MACHINING_DEFAULTS.sheet,
    spacing: pick('spacing') ?? MACHINING_DEFAULTS.spacing,
    frame: pick('frame') ?? MACHINING_DEFAULTS.frame,
    margin: pick('margin') ?? MACHINING_DEFAULTS.margin,
    overcut: pick('overcut') ?? MACHINING_DEFAULTS.overcut,
    reach: pick('reach') ?? MACHINING_DEFAULTS.reach,
    nutClearance: pick('nutClearance') ?? MACHINING_DEFAULTS.nutClearance,
    tabs: tabs === false ? (false as const) : { ...MACHINING_DEFAULTS.tabs, ...tabs },
  }
}

/** The machining values of a run, every one resolved (resolveMachining). */
export type Machining = ReturnType<typeof resolveMachining>

/** The Fusion tool library, Fusion's own JSON (edited in Fusion, exported as JSON). */
export const TOOLS_FILE = join(import.meta.dirname, 'cam.tools.json')
/** The materials: per material, its grain, its tool preset and Fusion's stock material. */
export const MATERIALS_FILE = join(import.meta.dirname, 'cam.materials.json')

/** The library as Fusion wrote it (sent as is to Fusion), and its tools as the selection rule sees them. */
export function loadTools(file = TOOLS_FILE) {
  const library = readFileSync(file, 'utf8')
  const { data } = JSON.parse(library) as {
    data?: { description: string; geometry: { DC: number; LCF: number; OAL: number; assemblyGaugeLength: number }; 'post-process': { number: number } }[]
  }
  if (!Array.isArray(data) || !data.length) throw new Error(`${file}: no tools (a Fusion tool library, exported as JSON)`)
  const tools: Tool[] = data.map((t) => {
    const { DC, LCF, OAL, assemblyGaugeLength } = t.geometry
    if (assemblyGaugeLength > OAL - MINIMUM_GRIP) throw new Error(`${file}: tool #${t['post-process'].number} sticks out ${assemblyGaugeLength} mm, more than its ${OAL} mm less the ${MINIMUM_GRIP} mm a collet must hold`)
    return { number: t['post-process'].number, description: t.description, diameter: DC, fluteLength: LCF, stickout: assemblyGaugeLength }
  })
  return { library, tools }
}

/** The materials of cam.materials.json, by name. */
export function loadMaterials(file = MATERIALS_FILE) {
  const list = JSON.parse(readFileSync(file, 'utf8')) as { version: number; materials: Record<string, Material> }
  if (list.version !== 1) throw new Error(`${file}: version ${list.version}, expected 1`)
  return list.materials
}

/**
 * How deep `tool` can cut at all, mm: its flutes, or its stickout less `nutClearance` (the collet nut above the
 * cut), the shorter. A posted file must cut no deeper.
 */
export function toolLimit(tool: Tool, machining: Pick<Machining, 'nutClearance'>) {
  return Math.min(tool.fluteLength, tool.stickout - machining.nutClearance)
}

/** How deep `tool` may cut when choosing it, mm: toolLimit, with `reach` of its flutes to spare. */
export function toolReach(tool: Tool, machining: Machining) {
  return Math.min(tool.fluteLength - machining.reach, toolLimit(tool, machining))
}

/** Why `tool` may cut so deep, for a message. */
const reachOf = (tool: Tool, machining: Machining) =>
  `${tool.fluteLength} mm flutes less ${machining.reach} to spare, ${tool.stickout} mm out of the collet less ${machining.nutClearance} for the nut`

/**
 * The tool for a cut `depth` mm deep: the one `machining.tool` numbers, else the narrowest that reaches it (the shorter
 * of two as narrow). Throws when none does.
 */
export function pickTool(tools: Tool[], depth: number, machining: Machining) {
  if (machining.tool !== undefined) {
    const tool = tools.find((t) => t.number === machining.tool)
    if (!tool) throw new Error(`no tool #${machining.tool} in scripts/cam.tools.json (${tools.map((t) => t.number).join(', ')})`)
    if (toolReach(tool, machining) < depth) throw new Error(`tool #${tool.number} cuts ${toolReach(tool, machining)} mm deep at most (${reachOf(tool, machining)}), the cut is ${depth.toFixed(1)} mm deep`)
    return tool
  }
  const reaching = tools.filter((t) => toolReach(t, machining) >= depth).sort((a, b) => a.diameter - b.diameter || a.fluteLength - b.fluteLength)
  if (!reaching.length) {
    const deepest = tools.reduce((a, b) => (toolReach(b, machining) > toolReach(a, machining) ? b : a))
    throw new Error(`no tool cuts ${depth.toFixed(1)} mm deep: the deepest in scripts/cam.tools.json, tool #${deepest.number}, cuts ${toolReach(deepest, machining)} mm (${reachOf(deepest, machining)})`)
  }
  return reaching[0]
}

/** The narrowest tool of the library (the longer of two as narrow), for what the main tool leaves; none if it is that tool's width. */
export function restTool(tools: Tool[], main: Tool) {
  const narrowest = [...tools].sort((a, b) => a.diameter - b.diameter || b.fluteLength - a.fluteLength)[0]
  return narrowest.diameter < main.diameter ? narrowest : undefined
}

/**
 * What cam.fusion-job.py reads in JOB["machining"] (`job`): every value resolved, in mm; and the rest tool (`rest`, see
 * restTool), whose number `job.rest.tool` carries.
 */
export function machiningJob(tool: Tool, machining: Machining, depth: number, tools: Tool[], materials: Record<string, Material>) {
  const rest = restTool(tools, tool)
  const restDepth = rest ? +Math.min(depth, toolReach(rest, machining)).toFixed(3) : 0
  const job = {
    tool: tool.number,
    preset: materials[machining.material].preset,
    overcut: machining.overcut,
    // Fusion measures a tab from the cut's bottom, `overcut` below the wood: the wood a tab leaves is `height`.
    tabs: machining.tabs === false ? null : { ...machining.tabs, height: +(machining.tabs.height + machining.overcut).toFixed(3) },
    minimumHoleDiameter: tool.diameter + HOLE_CLEARANCE,
    cornerRadius: CORNER_RADIUS,
    // After the outline, what this tool leaves (narrow sockets, corners): the narrowest tool, as deep as it reaches.
    rest: rest ? { tool: rest.number, after: tool.diameter, depth: restDepth, through: restDepth >= +depth.toFixed(3) } : null,
  }
  return { job, rest }
}
