// A part's machining files: one DXF per setup of each of its boards, derived from the part's STEP.
//
// Each board is laid on a 3-axis router by `machiningSetup`: the main setup works from the side of the board's
// largest flat face that leaves the fewest features to other setups. What that setup cannot cut then gets one
// more: the board turned over (`_back`) and each edge a mortise opens on (`_edge<n>`), when it holds pockets.
// Written into `.docs/<part>/dxf/<board>[_back|_edge<n>].dxf`, layers OUTLINE, THROUGH, POCKET_D<depth>, LABEL.

import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { MachiningSetup, Part, Vector, exportDxf, importStep, machiningSetup, type Plane } from '@classcad/smlibwasm'

/** The steepest wedge a board is tilted on, in degrees. */
const MAX_WEDGE = 20

/** A direction of a setup's frame, in the model. */
function toModel(plane: Plane, d: Vector) {
  return plane.xDir.mul(d.x).add(plane.yDir.mul(d.y)).add(plane.zDir.mul(d.z)).normalized()
}

/** Whether score `a` comes before `b`, compared entry by entry. */
function before(a: number[], b: number[]) {
  const i = a.findIndex((v, k) => v !== b[k])
  return i >= 0 && a[i] < b[i]
}

/** The side of the largest flat face that leaves the fewest features to other setups (turning over is the easy one). */
function mainDirection(part: Part) {
  const flat = part.faces().filter((face) => face.isPlanar)
  const big = flat.reduce((a, b) => (b.area > a.area ? b : a))
  const n = big.normalAt()
  let best: { score: number[]; direction: Vector } | undefined
  for (const direction of [n, n.neg()]) {
    const { elsewhere, layers } = machiningSetup(part, direction)
    const score = [elsewhere.filter(([why]) => why !== 'opens below').length, elsewhere.length, -layers.length]
    if (!best || before(score, best.score)) best = { score, direction }
  }
  return best!.direction
}

/**
 * The direction a tool must come from to follow the faces a vertical cutter cannot (a tail's walls leaning from the
 * tool): the one the most of those planar faces are parallel to, found from the pairs of their normals; `null` when
 * fewer than three share one.
 */
function leaningDirection(main: MachiningSetup) {
  const normals = main.elsewhere
    .filter(([why]) => why === 'not a prism along the tool')
    .flatMap(([, , faces]) => faces.filter((face) => face.isPlanar).map((face) => toModel(main.plane, face.normalAt())))
  let best: { direction: Vector; count: number } | undefined
  for (const [i, a] of normals.entries()) {
    for (const b of normals.slice(i + 1)) {
      const direction = a.cross(b)
      if (direction.length < 1e-3) continue // parallel normals give no direction
      const unit = direction.normalized()
      const count = normals.filter((n) => Math.abs(n.dot(unit)) < 1e-4).length
      if (!best || count > best.count) best = { direction: unit, count }
    }
  }
  return best && best.count >= 3 ? best.direction : null
}

/** The setups of a board: its main face, then the other face and the edges its features open on. */
function setups(part: Part) {
  const label = (part.name ?? 'part').toUpperCase()
  const direction = mainDirection(part)
  const main = machiningSetup(part, direction, { label })
  const all: { suffix: string; setup: MachiningSetup; direction: Vector }[] = [{ suffix: '', setup: main, direction }]
  for (const [why, local] of main.elsewhere) {
    if (!local) continue // no straight way in for a vertical cutter
    const d = toModel(main.plane, local)
    const xDir = main.plane.xDir
    if (why === 'opens below' && !all.some((s) => s.suffix === '_back')) {
      all.push({ suffix: '_back', setup: machiningSetup(part, d, { xDir, label: `${label} BACK` }), direction: d })
    } else if (why === 'opens at the side' && !all.some((s) => s.direction.isParallel(d) && s.direction.dot(d) > 0)) {
      const n = all.filter((s) => s.suffix.startsWith('_edge')).length + 1
      const options = { label: `${label} EDGE ${n}` }
      const setup = (() => {
        try {
          return machiningSetup(part, d, { xDir, ...options })
        } catch {
          return machiningSetup(part, d, options) // the edge lies along x: let the setup choose
        }
      })()
      all.push({ suffix: `_edge${n}`, setup, direction: d })
    }
  }
  // faces leaning from the tool are walls along another direction: tilt the board on a wedge so that the tool comes
  // along it (a few degrees: a lean further than that is a joint's own angle, cut another way)
  const lean = leaningDirection(main)
  const d = lean && (lean.dot(direction) >= 0 ? lean : lean.neg())
  if (d && d.angleTo(direction) <= MAX_WEDGE) {
    const tilted = machiningSetup(part, d, { label: `${label} TILTED` })
    const stillLeaning = (setup: MachiningSetup) =>
      setup.elsewhere.filter(([why]) => why === 'not a prism along the tool').reduce((n, [, , faces]) => n + faces.length, 0)
    if (stillLeaning(tilted) < stillLeaning(main)) all.push({ suffix: '_tilted', setup: tilted, direction: d })
  }
  // an edge whose feature a vertical cutter cannot make there is left out
  return all.filter(({ suffix, setup }) => !suffix || suffix === '_tilted' || setup.layers.some((layer) => layer.name?.startsWith('POCKET')))
}

/** Writes the DXF files of a part's boards, read from its STEP file; returns how many. */
export function buildDxf(stepFile: string, out: string) {
  const bodies: unknown[] = [importStep(stepFile)].flat(Infinity)
  rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })
  let count = 0
  for (const body of bodies) {
    if (!(body instanceof Part)) continue
    for (const { suffix, setup } of setups(body)) {
      exportDxf(setup.layers, join(out, `${body.name ?? "part"}${suffix}.dxf`), { curves: 'arcs' })
      count++
    }
  }
  return count
}
