// A part's machining files: one DXF per setup of each of its boards, derived from the part's STEP.
//
// Each board is laid on a 3-axis router by `machiningSetup`: the main setup works from the side of the board's
// largest flat face that leaves the fewest features to other setups. What that setup cannot cut then gets one
// more: the board turned over (`_back`) and each edge a mortise opens on (`_edge<n>`), when it holds pockets.
// Written into `.docs/<part>/dxf/<board>[_back|_edge<n>].dxf`, layers OUTLINE, THROUGH, POCKET_D<depth>, LABEL.

import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { MachiningSetup, Part, Vector, exportDxf, importStep, machiningSetup, type Plane } from '@classcad/smlibwasm'

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
  // an edge whose feature a vertical cutter cannot make there is left out
  return all.filter(({ suffix, setup }) => !suffix || setup.layers.some((layer) => layer.name?.startsWith('POCKET')))
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
