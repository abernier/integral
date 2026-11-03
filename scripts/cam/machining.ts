// How `pnpm cam` cuts a sheet: the tool, chosen per sheet from the repo's tool list (`scripts/cam/tools.json`), and
// the values sent with it to Fusion (fusion-job.py applies them and has none of its own).
//
// The values are, from the strongest: the CLI's, the model's manifest's (`defaults`), these defaults.
//
// The tool: the one named (`tool`), else the narrowest of the list whose flutes reach the cut: the sheet's thickness,
// `overcut` below it, and `reach` more to spare. The feeds, speeds and stepdowns are the tool's preset's, unless
// `stepdown` or `stepover` are given.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** A tool of tools.json: an end mill and the preset it cuts wood with. Lengths in mm, speeds in rpm and mm/min. */
export type Tool = {
  id: string
  description: string
  /** The tool number the post writes (`&Tool = <number>`). */
  number: number
  diameter: number
  flutes: number
  fluteLength: number
  bodyLength: number
  overallLength: number
  guid: string
  preset: {
    name: string
    description: string
    guid: string
    spindleSpeed: number
    feedCutting: number
    feedPlunge: number
    rampAngle: number
    stepdown: number
    stepover: number
  }
}

/** Holding tabs on the outline: how many per contour, how wide and how high (mm). */
export type Tabs = { count: number; width: number; height: number }

/** The values a manifest's `defaults` or the CLI may set. Lengths in mm. */
export type MachiningOptions = {
  /** A tool's id in tools.json for every sheet, instead of the one chosen by thickness. */
  tool?: string
  /** The sheet, [length along x, width along y]. */
  sheet?: [number, number]
  /** Space between two parts on a sheet. */
  spacing?: number
  /** Space kept free along the sheet's edges. */
  frame?: number
  /** Stock around a part in a setup of its own (a wedge), on its sides. */
  margin?: number
  /** How far the outline cuts below the stock's bottom, into the spoilboard. */
  overcut?: number
  /** Flute length to spare beyond the deepest cut, when choosing the tool. */
  reach?: number
  /** Deepest pass, instead of the tool preset's. */
  stepdown?: number
  /** Widest step across a pocket, instead of the tool preset's. */
  stepover?: number
  /** Wood a pocket leaves on its walls and floor, for a finishing pass (0: cut to size). */
  pocketStockToLeave?: number
  /** The outline's holding tabs, given in part (the rest from the defaults), or false for none. */
  tabs?: Partial<Tabs> | false
}

export const MACHINING_DEFAULTS = {
  sheet: [2440, 1220] as [number, number],
  spacing: 12,
  frame: 10,
  margin: 5,
  overcut: 0.3,
  reach: 1,
  pocketStockToLeave: 0.5,
  tabs: { count: 4, width: 6, height: 3 } as Tabs,
}

/** Holes taken as pockets: those the tool fits in, with this much more (mm) across. */
const HOLE_CLEARANCE = 0.5
/** Pockets of any corner radius (mm). */
const CORNER_RADIUS = [0, 1000]

export const MACHINING_KEYS = ['tool', 'sheet', 'spacing', 'frame', 'margin', 'overcut', 'reach', 'stepdown', 'stepover', 'pocketStockToLeave', 'tabs'] as const
const TAB_KEYS = ['count', 'width', 'height'] as const

/** The problems with a manifest's (or the CLI's) machining values, as messages; none when they are right. */
export function machiningProblems(options: Record<string, unknown>) {
  const problems: string[] = []
  const positive = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0
  for (const key of ['margin', 'stepdown', 'stepover'] as const) {
    if (options[key] !== undefined && !positive(options[key])) problems.push(`${key} must be a number of mm above 0`)
  }
  for (const key of ['spacing', 'frame', 'overcut', 'reach', 'pocketStockToLeave'] as const) {
    const value = options[key]
    if (value !== undefined && !(typeof value === 'number' && Number.isFinite(value) && value >= 0)) problems.push(`${key} must be a number of mm, 0 or more`)
  }
  const sheet = options.sheet
  if (sheet !== undefined && !(Array.isArray(sheet) && sheet.length === 2 && sheet.every(positive))) problems.push('sheet must be [length, width] in mm')
  if (options.tool !== undefined && typeof options.tool !== 'string') problems.push('tool must be a tool id of scripts/cam/tools.json')
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
    tool: pick('tool') as string | undefined,
    sheet: (pick('sheet') as [number, number] | undefined) ?? MACHINING_DEFAULTS.sheet,
    spacing: (pick('spacing') as number | undefined) ?? MACHINING_DEFAULTS.spacing,
    frame: (pick('frame') as number | undefined) ?? MACHINING_DEFAULTS.frame,
    margin: (pick('margin') as number | undefined) ?? MACHINING_DEFAULTS.margin,
    overcut: (pick('overcut') as number | undefined) ?? MACHINING_DEFAULTS.overcut,
    reach: (pick('reach') as number | undefined) ?? MACHINING_DEFAULTS.reach,
    pocketStockToLeave: (pick('pocketStockToLeave') as number | undefined) ?? MACHINING_DEFAULTS.pocketStockToLeave,
    stepdown: pick('stepdown') as number | undefined,
    stepover: pick('stepover') as number | undefined,
    tabs: tabs === false ? false : { ...MACHINING_DEFAULTS.tabs, ...tabs },
  }
}

export type Machining = ReturnType<typeof resolveMachining>

export const TOOLS_FILE = join(import.meta.dirname, 'tools.json')

export function loadTools(file = TOOLS_FILE): Tool[] {
  const list = JSON.parse(readFileSync(file, 'utf8')) as { version: number; tools: Tool[] }
  if (list.version !== 1) throw new Error(`${file}: version ${list.version}, expected 1`)
  if (!Array.isArray(list.tools) || !list.tools.length) throw new Error(`${file}: no "tools"`)
  return list.tools
}

/**
 * The tool for a cut `depth` mm deep: the one `machining.tool` names, else the narrowest whose flutes reach it (the
 * shorter of two as narrow). Throws when none does.
 */
export function pickTool(tools: Tool[], depth: number, machining: Machining) {
  const needed = depth + machining.reach
  if (machining.tool) {
    const tool = tools.find((t) => t.id === machining.tool)
    if (!tool) throw new Error(`no tool "${machining.tool}" in scripts/cam/tools.json (${tools.map((t) => t.id).join(', ')})`)
    if (tool.fluteLength < needed) throw new Error(`tool ${tool.id} reaches ${tool.fluteLength} mm, the cut needs ${needed.toFixed(1)} mm (${depth.toFixed(1)} deep, ${machining.reach} to spare)`)
    return tool
  }
  const reaching = tools.filter((t) => t.fluteLength >= needed).sort((a, b) => a.diameter - b.diameter || a.fluteLength - b.fluteLength)
  if (!reaching.length) {
    const longest = Math.max(...tools.map((t) => t.fluteLength))
    throw new Error(`no tool reaches ${needed.toFixed(1)} mm (${depth.toFixed(1)} deep, ${machining.reach} to spare): the longest flutes in scripts/cam/tools.json are ${longest} mm`)
  }
  return reaching[0]
}

/** The tool as Fusion's tool JSON (what `adsk.cam.Tool.createFromJson` reads), with its preset. */
function fusionTool(tool: Tool) {
  const { preset } = tool
  const feedPerRevolution = preset.feedCutting / preset.spindleSpeed
  return {
    BMC: 'unspecified',
    GRADE: 'Mill Generic',
    description: tool.description,
    geometry: {
      CSP: false,
      DC: tool.diameter,
      HAND: true,
      LB: tool.bodyLength,
      LCF: tool.fluteLength,
      NOF: tool.flutes,
      NT: 1,
      OAL: tool.overallLength,
      RE: 0,
      SFDM: tool.diameter,
      TA: 0,
      TP: 0,
      'shoulder-diameter': tool.diameter,
      'shoulder-length': tool.fluteLength,
      'thread-profile-angle': 60,
      'tip-diameter': tool.diameter,
      'tip-length': 0,
      'tip-offset': 0,
    },
    guid: tool.guid,
    'post-process': {
      'break-control': false,
      comment: '',
      'diameter-offset': tool.number,
      'length-offset': tool.number,
      live: true,
      'manual-tool-change': false,
      number: tool.number,
      turret: 0,
    },
    'product-id': '',
    'product-link': '',
    'start-values': {
      presets: [
        {
          name: preset.name,
          description: preset.description,
          guid: preset.guid,
          material: { category: 'all', query: '', 'use-hardness': false },
          n: preset.spindleSpeed,
          n_ramp: preset.spindleSpeed,
          v_c: (Math.PI * tool.diameter * preset.spindleSpeed) / 1000,
          f_n: feedPerRevolution,
          f_z: feedPerRevolution / tool.flutes,
          v_f: preset.feedCutting,
          v_f_leadIn: preset.feedCutting,
          v_f_leadOut: preset.feedCutting,
          v_f_transition: preset.feedCutting,
          v_f_plunge: preset.feedPlunge,
          v_f_ramp: preset.feedPlunge,
          'ramp-angle': preset.rampAngle,
          'tool-coolant': 'disabled',
          'use-stepdown': true,
          stepdown: preset.stepdown,
          'use-stepover': true,
          stepover: preset.stepover,
        },
      ],
    },
    type: 'flat end mill',
    unit: 'millimeters',
    vendor: '',
  }
}

/** What fusion-job.py's "setup" reads in JOB["machining"]: every value resolved, in mm, rpm and mm/min. */
export function machiningJob(tool: Tool, machining: Machining) {
  const { preset } = tool
  return {
    tool: JSON.stringify(fusionTool(tool)),
    spindleSpeed: preset.spindleSpeed,
    feedCutting: preset.feedCutting,
    feedPlunge: preset.feedPlunge,
    feedRamp: preset.feedPlunge,
    stepdown: machining.stepdown ?? preset.stepdown,
    stepover: machining.stepover ?? preset.stepover,
    overcut: machining.overcut,
    pocketStockToLeave: machining.pocketStockToLeave,
    tabs: machining.tabs || null,
    minimumHoleDiameter: tool.diameter + HOLE_CLEARANCE,
    cornerRadius: CORNER_RADIUS,
  }
}
