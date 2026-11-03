// A model's fabrication manifest: what CAM needs to know of each of its boards beyond the STEP's shapes.
//
// One format, two places: the build may generate `.docs/<model>/<model>.cam.json` beside the STEP (from the ClassCAD
// model, which knows each board's thickness, wedge angles and grain); until it does, or to override it, a
// hand-written `<model>/cam.config.json`. `loadManifest` reads the generated one first, then the hand-written one;
// a board in neither is cut with the defaults, face up, in one setup.
//
// {
//   "version": 1,
//   "defaults": { "template": "integral-19mm-6mm", "post": "shopbot", "margin": 5 },   // all optional
//   "parts": [
//     {
//       "body": "Seat",                 // the STEP body's name, as the build names it (`nameSolids`)
//       "thickness": 19,                // mm, optional: informative, checked against the body when known
//       "grain": "x",                   // optional: the grain's axis in the setup's frame
//       "template": "…",                // optional: this board's CAM template, instead of the default
//       "skip": false,                  // optional: no CAM for this board (cut by hand, bought, …)
//       "visibleFaces": ["top"],        // optional, unused yet: where holding tabs may show
//       "note": "…",                    // optional: for the maker
//       "setups": [                     // optional; none means one setup, `main`, face up
//         { "name": "main" },
//         { "name": "wedge8", "wedge": 8, "wcs": { "rotate": [8, 0, 0] } }
//       ]
//     }
//   ]
// }
//
// A setup's `wcs.rotate` is [x, y, z] in degrees, applied in that order to the board about its own bounding box
// centre before the setup is made: the board lies on a wedge of that angle, and the tool comes along its leaning
// faces. `wedge` is the wedge's angle, for the maker (it is not modelled). Each setup posts to
// `<Body>_<setup name>.sbp`.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export type Setup = { name: string; wedge?: number; wcs?: { rotate?: [number, number, number] } }

export type PartEntry = {
  body: string
  thickness?: number
  grain?: 'x' | 'y' | 'z'
  template?: string
  skip?: boolean
  visibleFaces?: string[]
  note?: string
  setups?: Setup[]
}

export type Manifest = {
  version: 1
  defaults?: { template?: string; post?: string; margin?: number }
  parts: PartEntry[]
}

/** Where a model's manifest is read from, in order: the generated one, then the hand-written one. */
export function manifestPaths(root: string, docs: string, model: string) {
  return [join(docs, model, `${model}.cam.json`), join(root, model, 'cam.config.json')]
}

export function loadManifest(paths: string[]): { manifest: Manifest; from?: string } {
  const from = paths.find((path) => existsSync(path))
  if (!from) return { manifest: { version: 1, parts: [] } }
  const manifest = JSON.parse(readFileSync(from, 'utf8')) as Manifest
  if (manifest.version !== 1) throw new Error(`${from}: version ${manifest.version}, expected 1`)
  if (!Array.isArray(manifest.parts)) throw new Error(`${from}: no "parts" array`)
  for (const part of manifest.parts) {
    if (typeof part.body !== 'string') throw new Error(`${from}: a part without "body"`)
    for (const setup of part.setups ?? []) {
      if (!/^[\w-]+$/.test(setup.name)) throw new Error(`${from}: ${part.body}: setup name "${setup.name}" (letters, digits, - and _)`)
      const rotate = setup.wcs?.rotate
      if (rotate && (rotate.length !== 3 || rotate.some((a) => typeof a !== 'number'))) {
        throw new Error(`${from}: ${part.body}/${setup.name}: wcs.rotate must be [x, y, z] degrees`)
      }
    }
  }
  return { manifest, from }
}

/** The setups of a board, as the CLI runs them: the manifest's, or one face-up `main`. */
export function setupsOf(manifest: Manifest, body: string): { part?: PartEntry; setups: Setup[] } {
  const part = manifest.parts.find((p) => p.body === body)
  return { part, setups: part?.setups?.length ? part.setups : [{ name: 'main' }] }
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
