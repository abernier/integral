// A model's fabrication manifest: what CAM needs to know of each of its boards beyond the STEP's shapes.
//
// One format, two places: the build may generate `.docs/<model>/<model>.cam.json` beside the STEP (from the ClassCAD
// model, which knows each board's thickness, wedge angles and grain); until it does, or to override it, a
// hand-written `<model>/cam.config.json`. `loadManifest` reads the generated one first, then the hand-written one;
// a board in neither is cut with the defaults, laid flat on its largest face, in one setup.
//
// {
//   "version": 1,
//   "defaults": { "post": "shopbot", "margin": 5, "overcut": 0.3, "tabs": { "count": 4 } },   // all optional
//   "parts": [
//     {
//       "body": "Seat",                 // the STEP body's name, as the build names it (`nameSolids`)
//       "thickness": 19,                // mm, optional: informative, checked against the body when known
//       "grain": "x",                   // optional: the grain's axis in the setup's frame
//       "tool": "flat-6-2f",            // optional: this board's tool; and its other machining values, see below
//       "skip": false,                  // optional: no CAM for this board (cut by hand, bought, …)
//       "visibleFaces": ["top"],        // optional, unused yet: where holding tabs may show
//       "note": "…",                    // optional: for the maker
//       "setups": [                     // optional; none means one setup, `main`, laid flat
//         { "name": "main" },
//         { "name": "wedge8", "wedge": 8, "wcs": { "rotate": [8, 0, 0] }, "cut": "squared" }
//       ]
//     }
//   ]
// }
//
// The machining values (`tool`, `margin`, `overcut`, `reach`, `stepdown`, `stepover`, `tabs`; see cam/machining.ts)
// may be in `defaults`, for every board, and in a part, for that board.
//
// A setup's `wcs.rotate` is [x, y, z] in degrees, applied in that order to the board about its own bounding box
// centre before the setup is made: the board lies on a wedge of that angle, and the tool comes along its leaning
// faces. Listed setups without it take the board as it lies in the model; a board without listed setups is laid
// flat. `wedge` is the wedge's angle, for the maker (it is not modelled). `cut: "squared"` makes a setup cut only
// the faces it squares: those upright as the board lies in it, but not as it lies in the board's first setup (the
// rest of the board is cut there). Without it, a setup cuts the board's pockets and its outline. Each setup posts to
// `<Body>_<setup name>.sbp`.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MACHINING_KEYS, machiningProblems, type MachiningOptions } from './machining.ts'

export type Setup = { name: string; wedge?: number; wcs?: { rotate?: [number, number, number] }; cut?: 'squared' }

export type PartEntry = MachiningOptions & {
  body: string
  thickness?: number
  grain?: 'x' | 'y' | 'z'
  skip?: boolean
  visibleFaces?: string[]
  note?: string
  setups?: Setup[]
}

export type Manifest = {
  version: 1
  defaults?: MachiningOptions & { post?: string }
  parts: PartEntry[]
}

const DEFAULTS_KEYS = ['post', ...MACHINING_KEYS]
const PART_KEYS = ['body', 'thickness', 'grain', 'skip', 'visibleFaces', 'note', 'setups', ...MACHINING_KEYS]
const SETUP_KEYS = ['name', 'wedge', 'wcs', 'cut']

/** Where a model's manifest is read from, in order: the generated one, then the hand-written one. */
export function manifestPaths(root: string, docs: string, model: string) {
  return [join(docs, model, `${model}.cam.json`), join(root, model, 'cam.config.json')]
}

export function loadManifest(paths: string[]): { manifest: Manifest; from?: string } {
  const from = paths.find((path) => existsSync(path))
  if (!from) return { manifest: { version: 1, parts: [] } }
  const manifest = JSON.parse(readFileSync(from, 'utf8')) as Manifest
  const unknown = (where: string, entry: object, keys: string[]) => {
    for (const key of Object.keys(entry)) if (!keys.includes(key)) throw new Error(`${from}: ${where}: unknown key "${key}" (${keys.join(', ')})`)
  }
  const machining = (where: string, entry: object) => {
    const problems = machiningProblems(entry as Record<string, unknown>)
    if (problems.length) throw new Error(`${from}: ${where}: ${problems.join('; ')}`)
  }
  if (manifest.version !== 1) throw new Error(`${from}: version ${manifest.version}, expected 1`)
  if (manifest.defaults) {
    unknown('defaults', manifest.defaults, DEFAULTS_KEYS)
    machining('defaults', manifest.defaults)
  }
  if (!Array.isArray(manifest.parts)) throw new Error(`${from}: no "parts" array`)
  for (const part of manifest.parts) {
    if (typeof part.body !== 'string') throw new Error(`${from}: a part without "body"`)
    unknown(part.body, part, PART_KEYS)
    machining(part.body, part)
    for (const setup of part.setups ?? []) {
      unknown(`${part.body}/${setup.name}`, setup, SETUP_KEYS)
      if (!/^[\w-]+$/.test(setup.name)) throw new Error(`${from}: ${part.body}: setup name "${setup.name}" (letters, digits, - and _)`)
      const rotate = setup.wcs?.rotate
      if (rotate && (rotate.length !== 3 || rotate.some((a) => typeof a !== 'number'))) {
        throw new Error(`${from}: ${part.body}/${setup.name}: wcs.rotate must be [x, y, z] degrees`)
      }
      if (setup.cut !== undefined && setup.cut !== 'squared') {
        throw new Error(`${from}: ${part.body}/${setup.name}: cut "${setup.cut}", expected "squared" or none`)
      }
      if (setup.cut && setup === part.setups?.[0]) {
        throw new Error(`${from}: ${part.body}/${setup.name}: cut "squared" on the first setup, which the others are squared against`)
      }
    }
  }
  return { manifest, from }
}

/**
 * The setups of a board, as the CLI runs them: the manifest's, or one `main` laid flat. A setup's turn: its
 * `wcs.rotate`, else none for a listed setup (as it lies in the model), and null for `main` (laid flat, found in
 * Fusion).
 */
export function setupsOf(manifest: Manifest, body: string): { part?: PartEntry; setups: { setup: Setup; rotate: [number, number, number] | null }[] } {
  const part = manifest.parts.find((p) => p.body === body)
  if (!part?.setups?.length) return { part, setups: [{ setup: { name: 'main' }, rotate: null }] }
  return { part, setups: part.setups.map((setup) => ({ setup, rotate: setup.wcs?.rotate ?? [0, 0, 0] })) }
}

/**
 * The bodies' names in a STEP file: its solids' (`MANIFOLD_SOLID_BREP('Seat', …)`, as ClassCAD names them), else its
 * products'. Read from the text: no CAD kernel needed for a plan.
 */
export function stepBodies(stepFile: string) {
  const text = readFileSync(stepFile, 'utf8')
  const names = (pattern: RegExp) => [...text.matchAll(pattern)].map((m) => m[1].replace(/''/g, "'")).filter(Boolean)
  const solids = names(/(?:MANIFOLD_SOLID_BREP|BREP_WITH_VOIDS)\s*\(\s*'((?:[^']|'')*)'/g)
  const bodies = solids.length ? solids : names(/PRODUCT\s*\(\s*'((?:[^']|'')*)'/g)
  return [...new Set(bodies)]
}
