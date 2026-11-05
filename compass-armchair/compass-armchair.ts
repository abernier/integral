// Compass armchair, a parametric ClassCAD part. `nr build` calls this module's default export with the ClassCAD
// script API (`api.v1`, as the ClassCAD MCP's run_script gives it), on an empty drawing, and the masters' values.
//
// A teak and cane armchair on compass legs, after the 1955 Chandigarh office chair, measured from a side view (the
// smlibpy example `examples/compass_armchair.py`, whose dimensions and joinery this follows). Each side is two
// tapered boards in a V and an armrest on edge, all 30 mm thick and in one plane, joined by a loose tenon on the
// seam. The seat frame's side rails take the boards on loose tenons, its cross rails are dovetailed through them.
// The curved back hangs between the armrests: two leaning posts, each on one loose tenon into its armrest, and two
// arched rails dovetailed through the posts. The cane is sheet cane pressed into a groove around each opening and
// held there by a glued rattan spline; it is flat, the weave is not modelled (GROOVE off: the groove is routed by hand
// after glue-up, the cane lies flat on the frame and the CAM files cut none). Or, in the leather variant, a black
// leather cushion on a plywood board resting on teak cleats, and an upholstered back panel screwed to curved teak
// fillets behind the rails; no groove then, nothing to hold. Every outside arris of the assembled wood
// is rounded (EDGE_BREAK, the armrest's nose ARM_NOSE_R), by hand on the cut parts: the CAM files are cut square.
// The chair faces -Y, x = 0 is its middle, the floor is z = 0; +x is the sitter's left.
//
// As for the zigzag chair, every flat board is a large box cut down by half-spaces: work planes whose position and
// normal are expressions. The arched members are a cylinder less a smaller one, cut the same way; the cane's
// outlines are boxes and cylinders placed by expressions. Changing a parameter moves the planes and the whole history
// rebuilds. The chair is one part: its expressions are the parameters, and every board is a named body in it, so
// changing one rebuilds them all.

import { type Api, created, nameSolids } from '../scripts/part.ts'
import type { CamConfig } from '../scripts/cam.config.ts'
import type { Values } from '../scripts/masters.ts'
import { type MASTERS, type VARIANTS, edgeBreak, grooved } from './compass-armchair.masters.ts'

const TEAK: [number, number, number] = [155, 106, 60] // #9b6a3c
const CANE: [number, number, number] = [230, 210, 160] // #e6d2a0
const LEATHER: [number, number, number] = [29, 27, 26] // #1d1b1a
const PLYWOOD: [number, number, number] = [200, 195, 185] // #c8c3b9, birch plywood, a cool grey-beige: told apart from the cane

/** The masters' values, one per name of compass-armchair.masters.ts. */
type ChairValues = Values<typeof MASTERS>

/** A variant's id (compass-armchair.masters.ts). */
type Variant = keyof typeof VARIANTS

/**
 * How `pnpm cam` cuts the parts (see CamConfig): what Fusion cannot know from the STEP. What is not milled depends on
 * the variant, and the splines on GROOVE (no groove, no spline: the CAM STEP has none, GROOVE's `cam` is 0). The
 * leather variant's cleats and fillets are teak, milled from the top as the other boards.
 */
export function CAM(values: ChairValues, variant: string): CamConfig {
  return {
    defaults: { material: 'teak' },
    parts: {
      // The loose tenons: their grain across the joint, along their length into both members, not their height.
      FrontRailTenonLeft: { grain: 90 },
      FrontRailTenonRight: { grain: 90 },
      RearRailTenonLeft: { grain: 90 },
      RearRailTenonRight: { grain: 90 },
      ArmTenonLeft: { grain: 90 },
      ArmTenonRight: { grain: 90 },
      ...(variant === 'leather'
        ? {
            // Upholstery, not milled.
            SeatCushion: { skip: true },
            BackPad: { skip: true },
            // Bending plywood, bent to the back's arc: cut by hand from a sheet.
            BackBoard: { skip: true },
            // Plywood, which cam.materials.json has no preset for: a rectangle, sawn from a sheet.
            SeatBoard: { skip: true },
          }
        : {
            // Woven cane on its frame, not milled.
            SeatCane: { skip: true },
            BackCane: { skip: true },
            // The rattan splines that hold the cane in its groove, glued in, not milled.
            ...(grooved(variant, values.GROOVE) && { SeatCaneSpline: { skip: true }, BackCaneSpline: { skip: true } }),
          }),
    },
  }
}

// Everything else, derived (`derived` sets the side rail tenons' height per variant). The armrest's underside is
// z = U0 - K y.
const DERIVED = {
  X_BOARD: 'W/2 - LEG_T', // the side boards' inner face, on which the posts' outer face lies
  X_POST: 'X_BOARD - POST_W', // the posts' inner face
  X_RAIL: 'X_BOARD - RAIL_T', // the side rails' inner face
  X_MID: 'X_BOARD + LEG_T/2',
  K: '(ARM_BACK_H - ARM_NOSE_H)/(ARM_BACK_Y - ARM_FRONT)',
  U0: 'ARM_TOP - ARM_NOSE_H + K*ARM_FRONT',
  U_FRONT: 'U0 - K*ARM_EDGE_FRONT',
  U_REAR: 'U0 - K*ARM_EDGE_REAR',
  SPLINE_TOP: 'U0 + SPLINE_IN_ARM',
  Z_TENON: 'SEAT_TOP - (RAIL_H + GROOVE_D)/2', // the side rail tenons, in the middle of the wood under the cane groove
  LEAN: 'BACK_TILT*C:PI/180',
  SL: 'sin(LEAN)',
  CL: 'cos(LEAN)',
  TL: 'SL/CL',
  POST_Y: 'POST_Y_AT_ARM - (ARM_TOP - SEAT_TOP)*TL', // the posts' axis at seat height
  // The back rails' faces, two arcs about one centre on the back's axis, flush with the posts' faces at their inner
  // face: the rear one through the posts' rear inner corners and BOW behind them in the middle, the front one through
  // their front inner corners. As in compass-armchair.model.ts.
  R_OUT: '(X_POST*X_POST + BOW*BOW)/(2*BOW)',
  ARC_Y: 'POST_D/2 + BOW - R_OUT', // the centre, in the back's frame
  R_IN: 'sqrt(X_POST*X_POST + (ARC_Y + POST_D/2)*(ARC_Y + POST_D/2))',
  // Where the posts' rear face crosses the armrest's underside, in the side view; the armrest's square rear end.
  POST_REAR_0: 'POST_Y - SEAT_TOP*TL + POST_D/2/CL',
  MEET_Y: '(POST_REAR_0 + TL*U0)/(1 + TL*K)',
  MEET_Z: 'U0 - K*MEET_Y',
  ARM_END: 'POST_REAR_0 + (ARM_TOP + MEET_Z)/2*TL + ARM_BEHIND',
  // The posts' loose tenon along the post, ARM_TENON_MARGIN within the armrest at every corner of its section.
  ARM_TENON_TOP: '(ARM_TOP - ARM_TENON_MARGIN - SEAT_TOP - ARM_TENON/2*SL)/CL',
  ARM_TENON_BOTTOM: '(U0 - K*POST_Y + ARM_TENON_MARGIN - SEAT_TOP + ARM_TENON/2*(SL - K*CL))/(CL + K*SL)',
  // The seat's tails, on the cross rails: at the side rail's outer face (end) and its inner face (base).
  SEAT_TAIL_END: '(RAIL_H - 2*SEAT_PIN_EDGE - (SEAT_TAILS - 1)*SEAT_PIN_MID)/SEAT_TAILS',
  SEAT_TAIL_BASE: 'SEAT_TAIL_END - 2*RAIL_T*SLOPE',
  SEAT_TAIL_PITCH: 'SEAT_TAIL_END + SEAT_PIN_MID',
  SEAT_TAIL_Z: 'SEAT_TOP - RAIL_H + SEAT_PIN_EDGE + SEAT_TAIL_END/2', // the lowest tail's middle
  REAR_RAIL_Y: 'SEAT_BACK - REAR_RAIL_T',
  CANE_FRONT: 'SEAT_FRONT + FRONT_RAIL_T',
  // The back's tail, on a rail's end, centred on the post's axis: at the post's inner face, at its outer face.
  BACK_TAIL_BASE: 'POST_D - 2*BACK_TAIL_SHOULDER',
  BACK_TAIL_END: 'BACK_TAIL_BASE + 2*POST_W*SLOPE',
  // The leather variant's seat: the cleats' inner face and their top, the board's top; the board and the cushion GAP
  // short of the rails all round.
  CLEAT_X: 'X_RAIL - CLEAT',
  BOARD_TOP: 'SEAT_TOP - SEAT_BOARD_DOWN',
  CLEAT_TOP: 'BOARD_TOP - SEAT_BOARD_T',
  GAP: '1',
  // The leather variant's back: the backer's rear face and its front face.
  BACKER_OUT: 'R_OUT - FILLET',
  BACKER_IN: 'BACKER_OUT - BACK_BOARD_T',
}

/** DERIVED in a variant: without a cane groove, the side rail tenons are centred on the rail's height. */
const derived = (variant: Variant): typeof DERIVED =>
  variant === 'cane' ? DERIVED : { ...DERIVED, Z_TENON: 'SEAT_TOP - RAIL_H/2' }


// A half-space: a point on its plane and its normal, pointing into the material. Components are expressions in
// which `$X` stands for `@expr.X`.
type Vec = [x: string, y: string, z: string]
type HalfSpace = { name: string; at: Vec; normal: Vec }
const H = (name: string, at: Vec, normal: Vec): HalfSpace => ({ name, at, normal })

/** A slab between two planes square to an axis: two half-spaces. */
function slab(name: string, axis: 0 | 1 | 2, min: string, max: string): HalfSpace[] {
  const point = (v: string): Vec => ['0', '0', '0'].map((zero, i) => (i === axis ? v : zero)) as Vec
  const unit = (sign: string): Vec => ['0', '0', '0'].map((zero, i) => (i === axis ? sign : zero)) as Vec
  return [H(`${name}Min`, point(min), unit('1')), H(`${name}Max`, point(max), unit('-1'))]
}

/** The same half-spaces, mirrored about x = 0: the chair's other side. */
const mirror = (planes: HalfSpace[]) =>
  planes.map(({ name, at: [x, y, z], normal: [nx, ny, nz] }) => H(name, [`-(${x})`, y, z], [`-(${nx})`, ny, nz]))

/**
 * From the back's own frame (upright, its origin on the posts' axis at seat height) to the chair: leaned back
 * BACK_TILT about x. `tiltPoint` moves a point, `tilt` half-spaces.
 */
const tiltPoint = ([x, y, z]: Vec): Vec => [x, `$POST_Y + (${y})*$CL + (${z})*$SL`, `$SEAT_TOP - (${y})*$SL + (${z})*$CL`]
const tilt = (planes: HalfSpace[]) =>
  planes.map(({ name, at, normal: [nx, ny, nz] }) =>
    H(name, tiltPoint(at), [nx, `(${ny})*$CL + (${nz})*$SL`, `-(${ny})*$SL + (${nz})*$CL`]),
  )

// Everything below is the chair's +x side; `mirror` gives the other.

const BOARD = slab('Board', 0, '$X_BOARD', '$W/2')
const UNDER_ARM = H('UnderArm', ['0', '0', '$U0'], ['0', '-$K', '-1'])

// The side view, (y, z), as half-spaces: each edge's left normal, the polygons running counterclockwise.
const FRONT_LEG = [
  ...BOARD,
  H('Floor', ['0', '0', '0'], ['0', '0', '1']),
  H('Back', ['0', '$FRONT_FOOT_BACK', '0'], ['0', '-$NOTCH_Z', '-$FRONT_FOOT_BACK']),
  H('Seam', ['0', '0', '0'], ['0', '-1', '0']),
  UNDER_ARM,
  H('Front', ['0', '$FRONT_FOOT_FRONT', '0'], ['0', '$U_FRONT', '$FRONT_FOOT_FRONT - $ARM_EDGE_FRONT']),
]
const REAR_LEG = [
  ...BOARD,
  H('Floor', ['0', '0', '0'], ['0', '0', '1']),
  H('Back', ['0', '$REAR_FOOT_BACK', '0'], ['0', '-$U_REAR', '$ARM_EDGE_REAR - $REAR_FOOT_BACK']),
  UNDER_ARM,
  H('Seam', ['0', '0', '0'], ['0', '1', '0']),
  H('Front', ['0', '$REAR_FOOT_FRONT', '0'], ['0', '$NOTCH_Z', '$REAR_FOOT_FRONT']),
]
// The armrest from y0 to y1.
const armrest = (y0: string, y1: string) => [
  ...BOARD,
  ...slab('Length', 1, y0, y1),
  H('Top', ['0', '0', '$ARM_TOP'], ['0', '0', '-1']),
  H('Underside', ['0', '0', '$U0'], ['0', '$K', '1']),
]
const SPLINE = [
  ...slab('Across', 0, '$X_MID - $SPLINE_W/2', '$X_MID + $SPLINE_W/2'),
  ...slab('Thick', 1, '-$SPLINE_T/2', '$SPLINE_T/2'),
  ...slab('High', 2, '$SPLINE_Z', '$SPLINE_TOP'),
]
const railTenon = (y: string) => [
  ...slab('Long', 0, '$X_BOARD - $TENON_IN_RAIL', '$X_BOARD + $TENON_LEN'),
  ...slab('Thick', 1, `${y} - $TENON_T/2`, `${y} + $TENON_T/2`),
  ...slab('High', 2, '$Z_TENON - $TENON_H/2', '$Z_TENON + $TENON_H/2'),
]
const RAIL_HEIGHT = slab('High', 2, '$SEAT_TOP - $RAIL_H', '$SEAT_TOP')
const SIDE_RAIL = [...slab('Thick', 0, '$X_RAIL', '$X_BOARD'), ...slab('Long', 1, '$SEAT_FRONT', '$SEAT_BACK'), ...RAIL_HEIGHT]

// The lowest seat tail at a cross rail's +x end, between y0 and y1: a trapezoid on the rail's face (x, z), wide at
// the side rail's outer face; patterned SEAT_TAILS times up the rail. The side rail's pins are what they leave.
const seatTail = (y0: string, y1: string) => [
  ...slab('Through', 0, '$X_RAIL', '$X_BOARD'),
  ...slab('Rail', 1, y0, y1),
  H('LowFlank', ['$X_BOARD', '0', '$SEAT_TAIL_Z - $SEAT_TAIL_END/2'], ['$SLOPE', '0', '1']),
  H('HighFlank', ['$X_BOARD', '0', '$SEAT_TAIL_Z + $SEAT_TAIL_END/2'], ['$SLOPE', '0', '-1']),
]
const FRONT_RAIL_Y = ['$SEAT_FRONT', '$CANE_FRONT'] as const
const REAR_RAIL_Y = ['$REAR_RAIL_Y', '$SEAT_BACK'] as const
const crossRail = ([y0, y1]: readonly [string, string]) => [
  ...slab('Long', 0, '-$X_RAIL', '$X_RAIL'),
  ...slab('Thick', 1, y0, y1),
  ...RAIL_HEIGHT,
]
// Up into the cane's sheet on the rails' top (`cane`).
const SEAT_CANE = [
  ...slab('Wide', 0, '-$X_RAIL', '$X_RAIL'),
  ...slab('Deep', 1, '$CANE_FRONT', '$REAR_RAIL_Y'),
  ...slab('Thick', 2, '$SEAT_TOP - $CANE_T', '$SEAT_TOP + $CANE_SHEET/2'),
]

// The back, in its own frame (`tilt`).
const BACK_RAILS = [
  ['$LOW_RAIL_BOTTOM', '$LOW_RAIL_TOP'],
  ['$HIGH_RAIL_BOTTOM', '$HIGH_RAIL_TOP'],
] as const
// A back rail's tail at its +x end: a trapezoid in plan (x, y) through the rail's height, from the post's inner face
// to its outer face, wide at the outer face; it slides in along the post.
const backTail = ([z0, z1]: readonly [string, string]) => [
  ...slab('Through', 0, '$X_POST', '$X_BOARD'),
  ...slab('High', 2, z0, z1),
  H('FrontFlank', ['$X_BOARD', '-$BACK_TAIL_END/2', '0'], ['$SLOPE', '1', '0']),
  H('RearFlank', ['$X_BOARD', '$BACK_TAIL_END/2', '0'], ['$SLOPE', '-1', '0']),
]
const ARM_TENON = [
  ...slab('Deep', 0, '$X_BOARD - $ARM_TENON_DEPTH', '$X_BOARD + $ARM_TENON_DEPTH'),
  ...slab('Thick', 1, '-$ARM_TENON/2', '$ARM_TENON/2'),
  ...slab('High', 2, '$ARM_TENON_BOTTOM', '$ARM_TENON_TOP'),
]
const POST = [
  ...slab('Across', 0, '$X_POST', '$X_BOARD'),
  ...slab('Deep', 1, '-$POST_D/2', '$POST_D/2'),
  ...slab('Long', 2, '$LOW_RAIL_BOTTOM', '$HIGH_RAIL_TOP'),
]
// The back's arc from post to post, on the side of its centre the sitter is not.
const BETWEEN_POSTS = [...slab('Span', 0, '-$X_POST', '$X_POST'), H('Rear', ['0', '$ARC_Y', '0'], ['0', '1', '0'])]


const expr = (s: string) => s.replace(/\$/g, '@expr.')
const vector = (v: Vec) => expr(`[${v.join(', ')}]`)
const BIG = 3000

/** An expression's value, as the engine reckons it: for telling a board's edges apart by where they lie. */
type Value = (expression: string) => number

/**
 * The value of the part's expressions, from the masters' values and DERIVED: numbers, names (`$X` or `X`), `C:PI`,
 * + - * / and parentheses, sqrt, sin and cos, what the half-spaces and DERIVED are written with.
 */
function evaluator(values: ChairValues, variant: Variant): Value {
  const known = new Map<string, number>([...Object.entries(values), ['C:PI', Math.PI]])
  const expressions: Record<string, string> = derived(variant)
  const functions: Record<string, (x: number) => number> = { sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos }
  const lookup = (name: string) => {
    let value = known.get(name)
    if (value === undefined) {
      if (!(name in expressions)) throw new Error(`no expression ${name}`)
      value = evaluate(expressions[name])
      known.set(name, value)
    }
    return value
  }
  function evaluate(expression: string): number {
    const tokens = expression.replace(/\$/g, '').match(/C:PI|[A-Za-z_]\w*|\d+(\.\d+)?|\S/g) ?? []
    let at = 0
    const take = (token: string) => {
      if (tokens[at] !== token) throw new Error(`${expression}: ${token} expected`)
      at++
    }
    const sum = (): number => {
      let value = product()
      while (tokens[at] === '+' || tokens[at] === '-') value = tokens[at++] === '+' ? value + product() : value - product()
      return value
    }
    const product = (): number => {
      let value = signed()
      while (tokens[at] === '*' || tokens[at] === '/') value = tokens[at++] === '*' ? value * signed() : value / signed()
      return value
    }
    const signed = (): number => {
      if (tokens[at] === '-') {
        at++
        return -signed()
      }
      if (tokens[at] === '+') {
        at++
        return signed()
      }
      return primary()
    }
    const primary = (): number => {
      const token = tokens[at++]
      if (token === '(') {
        const value = sum()
        take(')')
        return value
      }
      if (/^\d/.test(token)) return Number(token)
      if (token in functions) {
        take('(')
        const value = sum()
        take(')')
        return functions[token](value)
      }
      return lookup(token)
    }
    const value = sum()
    if (at !== tokens.length) throw new Error(`${expression}: unexpected ${tokens[at]}`)
    return value
  }
  return evaluate
}

/** Cut `body` down by half-spaces, one work plane and one slice each. */
async function cut(api: Api, part: number, name: string, body: number, planes: HalfSpace[]) {
  for (const { name: plane, at, normal } of planes) {
    const id = await created(api.v1.part.workPlane({ id: part, name: `${name}_${plane}`, position: vector(at), normal: vector(normal) }))
    body = await created(api.v1.part.slice({ id: part, name: `${name}_${plane}`, targets: [body], reference: id }))
  }
  return body
}

/** A convex board: a large box cut down by half-spaces. */
async function board(api: Api, part: number, name: string, planes: HalfSpace[]) {
  const corner = await created(api.v1.part.workCSys({ id: part, name: `${name}Stock`, offset: [-BIG / 2, -BIG / 2, -BIG / 2] }))
  const stock = await created(api.v1.part.box({ id: part, name: `${name}Stock`, length: BIG, width: BIG, height: BIG, references: [corner] }))
  return cut(api, part, name, stock, planes)
}

type Point = [x: number, y: number, z: number]

/**
 * The straight edges (`lineIndex`) or the arcs (`arcIndex`) of a body, its latest feature, each with its midpoint.
 * The engine indexes them from 0; past the last, strict mode throws.
 */
async function edgesOf(api: Api, body: number, kind: 'lineIndex' | 'arcIndex') {
  const ids: number[] = []
  for (let i = 0; ; i++) {
    const index = kind === 'lineIndex' ? { lineIndex: i } : { arcIndex: i }
    const found = await api.v1.part.getBrepGeometryByIndex({ id: body, ...index }).catch(() => null)
    if (found?.result == null) break
    ids.push(found.result)
  }
  if (ids.length === 0) return []
  const { result } = await api.v1.part.getGeometryPositions({ elems: ids })
  // The engine gives a line's or an arc's midpoint, as {x, y, z}.
  return result.map(({ id, positions: [midpoint] }) => {
    const { x, y, z } = midpoint as { x: number; y: number; z: number }
    return { id, at: [x, y, z] as Point }
  })
}

/** The names of the planes of `planes` on which `point` lies. */
function facesAt(value: Value, planes: HalfSpace[], point: Point) {
  return planes
    .filter(({ at, normal }) => {
      const n = normal.map(value)
      const offset = at.map((a, i) => point[i] - value(a))
      return Math.abs(n[0] * offset[0] + n[1] * offset[1] + n[2] * offset[2]) / Math.hypot(...n) < 1e-4
    })
    .map(({ name }) => name)
}

/** The masters a round's radius is. */
type Radius = 'EDGE_BREAK' | 'ARM_NOSE_R'
/** One fillet: its radius, and the straight edges it rounds, by the names of the two faces each lies on. */
type Rounds = [radius: Radius, takes: (faces: string[]) => boolean]

/**
 * Round `edges` at `radius`. The engine fails a few fillets for no reason of their own, at particular values (the rear
 * rail's box at the masters' maxima: one edge of it at EDGE_BREAK = 4, not at 3.5 or 5): such a fillet is deleted and
 * its edges chamfered at the same distance instead, with a warning. Only the fillets the failed call left in the tree
 * are deleted: one refused before it made a feature leaves none, and the fillets before it stay. That takes one tree
 * read per fillet, before the call.
 */
async function fillet(api: Api, part: number, name: string, edges: number[], radius: Radius) {
  const before = await filletIds(api)
  try {
    return await created(api.v1.part.fillet({ id: part, name, references: edges, radius: expr(`$${radius}`) }))
  } catch (error) {
    const left = (await filletIds(api)).filter((id) => !before.includes(id))
    if (left.length > 0) await api.v1.part.deleteFeature({ ids: left })
    console.warn(`${name}: ${(error as Error).message}; chamfered at ${radius} instead`)
    return created(api.v1.part.chamfer({ id: part, name, references: edges, distance1: expr(`$${radius}`) }))
  }
}

/** The ids of the constant-radius fillets in the model's tree. */
async function filletIds(api: Api) {
  const tree = await api.tree({ refresh: true })
  return Object.keys(tree)
    .filter((id) => tree[id].class === 'CC_ConstantRadiusFillet')
    .map(Number)
}

/**
 * Every edge but those on a face of `sharp`, and those along both faces of a pair of `sharpPairs`. EDGE_BREAK is the
 * one break of the assembled chair's outside arrises, as if broken after glue-up and flush-planing, continuous across
 * its members. Sharp are the edges along a flush glued seam, on both members (the joint one surface but for a
 * hairline, no V), and those no one sees or touches once assembled: between two faces glued over their whole extent,
 * in an inside corner, along a dovetail's joint line, or under the cane's lap.
 */
const allBut =
  (sharp: string[], sharpPairs: [string, string][] = []) =>
  (faces: string[]) =>
    !faces.some((face) => sharp.includes(face)) && !sharpPairs.some(([a, b]) => faces.includes(a) && faces.includes(b))

/**
 * Round the straight edges of a board cut by `planes`, one fillet per radius: each takes the edges that lie on two of
 * the planes (a round's own tangent edges lie on one) and that it `takes`. The rounds are made by hand on the cut
 * parts: EDGE_BREAK and ARM_NOSE_R are 0 in the CAM files' geometry (their masters' `cam`), where a fillet of radius 0
 * would fail, so a round of radius 0 is left out and the board stays square.
 */
async function round(api: Api, part: number, value: Value, name: string, body: number, planes: HalfSpace[], fillets: Rounds[]) {
  for (const [radius, takes] of fillets) {
    if (value(`$${radius}`) === 0) continue
    const edges = (await edgesOf(api, body, 'lineIndex')).filter(({ at }) => {
      const faces = facesAt(value, planes, at)
      return faces.length === 2 && takes(faces)
    })
    if (edges.length === 0) continue
    body = await fillet(api, part, `${name}Round`, edges.map(({ id }) => id), radius)
  }
  return body
}

/**
 * A frame boxes and cylinders are built in: (u, v, w) its axes, and where a point (u, v, w) is in the chair. A work
 * coordinate system at a point, turned by `rotation`, has its x, y and z along u, v and w.
 */
type Frame = { rotation: string; at: (point: Vec) => Vec }
const CHAIR_FRAME: Frame = { rotation: '[0, 0, 0]', at: (point) => point }
const UPRIGHT_FRAME: Frame = { rotation: '[-@expr.LEAN, 0, 0]', at: tiltPoint } // the back's own frame (`tilt`)

/** A box in a frame: from its corner `min`, `size` along u, v and w. */
async function block(api: Api, part: number, name: string, frame: Frame, min: Vec, [u, v, w]: Vec) {
  const base = await created(api.v1.part.workCSys({ id: part, name, offset: vector(frame.at(min)), rotation: frame.rotation }))
  return created(api.v1.part.box({ id: part, name, length: expr(u), width: expr(v), height: expr(w), references: [base] }))
}

/** A cylinder in a frame, along w: the centre of its base `at`, its radius and its height. */
async function column(api: Api, part: number, name: string, frame: Frame, at: Vec, radius: string, height: string) {
  const base = await created(api.v1.part.workCSys({ id: part, name, offset: vector(frame.at(at)), rotation: frame.rotation }))
  return created(api.v1.part.cylinder({ id: part, name, references: [base], diameter: expr(`2*${radius}`), height: expr(height) }))
}

// The frame the seat's side rails' arrises run along: u = x, v = z, w = -y; turned by 90 degrees about x, a work
// coordinate system's z lies along -y, its y along z.
const ALONG_Y_FRAME: Frame = { rotation: expr('[C:PI/2, 0, 0]'), at: ([u, v, w]) => [u, `-(${w})`, v] }

/**
 * The wood a round of EDGE_BREAK takes off a square arris, in a frame along its w from w0 to w1: the EDGE_BREAK square
 * in the corner (u, v), the faces running on toward `toward` (+1 or -1 along u and v), less the round's cylinder.
 * Null when EDGE_BREAK is 0: no round, nothing to take off.
 */
async function arrisSliver(api: Api, part: number, value: Value, name: string, frame: Frame, [u, v]: [string, string], toward: [number, number], [w0, w1]: [string, string]) {
  if (value('$EDGE_BREAK') === 0) return null
  const [su, sv] = toward.map((sign) => (sign > 0 ? '+' : '-'))
  const min: Vec = [toward[0] > 0 ? u : `(${u}) - $EDGE_BREAK`, toward[1] > 0 ? v : `(${v}) - $EDGE_BREAK`, w0]
  const square = await block(api, part, `${name}Square`, frame, min, ['$EDGE_BREAK', '$EDGE_BREAK', `(${w1}) - (${w0})`])
  // Longer than the square, so that no two faces of the subtraction lie on one plane.
  const axis: Vec = [`(${u}) ${su} $EDGE_BREAK`, `(${v}) ${sv} $EDGE_BREAK`, `(${w0}) - 1`]
  const round = await column(api, part, `${name}Round`, frame, axis, '$EDGE_BREAK', `(${w1}) - (${w0}) + 2`)
  return subtract(api, part, name, square, [round])
}

// The side's outline, seen from the side: the hull of its two boards and its armrest's underside, less the V between
// the boards under the notch. Square to x, through the side rails' and the posts' outer faces.
const SIDE_HULL = [
  ...FRONT_LEG.filter(({ name }) => name === 'Floor' || name === 'Front'),
  ...REAR_LEG.filter(({ name }) => name === 'Back'),
  UNDER_ARM,
]
const flip = ({ name, at, normal }: HalfSpace) => H(`${name}Flipped`, at, normal.map((n) => `-(${n})`) as Vec)
const NOTCH = [
  H('Floor', ['0', '0', '-1'], ['0', '0', '1']),
  flip(FRONT_LEG.find(({ name }) => name === 'Back')!),
  flip(REAR_LEG.find(({ name }) => name === 'Front')!),
]

/**
 * The wood an arris's round took off where the arris lies against a side board's inner face, in an inside corner
 * (`arrisSliver` cut to `cover`, the board's outline, less `gap`, where the board is not): put back, it is sharp
 * there, and rounded on either side, its round running on into the board's face. Null when EDGE_BREAK is 0.
 */
async function insideCorner(api: Api, part: number, value: Value, name: string, sliver: number | null, cover: HalfSpace[], gap?: { planes: HalfSpace[]; below: string }) {
  if (sliver === null) return null
  const covered = await intersect(api, part, name, sliver, [await board(api, part, `${name}Cover`, cover)])
  // Only where the sliver reaches down into the V: a boolean whose tool misses its target is left out.
  if (!gap || value(gap.below) >= value('$NOTCH_Z')) return covered
  return subtract(api, part, name, covered, [await board(api, part, `${name}Gap`, gap.planes)])
}

/** `body` with the wood of its inside corners (`insideCorner`) put back. */
async function sharpInside(api: Api, part: number, body: number, corners: (number | null)[]) {
  const fills = present(...corners)
  return fills.length > 0 ? union(api, part, 'InsideCorners', body, fills) : body
}

// The armrest's outline, seen from the side, square to x: what the posts' outer faces lie against.
const ARMREST_OUTLINE = armrest('$ARM_FRONT', '$ARM_END').filter(({ name }) => !name.startsWith('Board'))

/**
 * A board, its arrises rounded before its joints are cut: the edges to round are told apart by the half-spaces the
 * board is cut by (`planes`, in the back's frame when `upright`), so they follow the masters.
 *
 * Its stock is a box between its slabs square to an axis, sliced by its other half-spaces, not the large box of
 * `board`: of the edges along a slab's two sliced faces that one later slice made, the engine takes two for one and
 * fails the fillet ("Duplicated references have been removed"). A box's own faces it tells apart, and slices no two of
 * which are parallel.
 */
async function roundedBoard(api: Api, part: number, value: Value, name: string, planes: HalfSpace[], fillets: Rounds[], upright = false) {
  // Along each axis, the two half-spaces square to it, if there are two: their planes' positions, the least first.
  const bounds = [0, 1, 2].map((axis) => {
    const pair = planes.filter(({ normal }) => normal.every((n, i) => i === axis || value(n) === 0))
    if (pair.length !== 2) return null
    const [low, high] = value(pair[0].normal[axis]) > 0 ? pair : [pair[1], pair[0]]
    return { pair, low: low.at[axis], high: high.at[axis] }
  })
  const min = bounds.map((b) => (b ? b.low : `${-BIG / 2}`)) as Vec
  const size = bounds.map((b) => (b ? `(${b.high}) - (${b.low})` : `${BIG}`)) as Vec
  const stock = await block(api, part, `${name}Stock`, upright ? UPRIGHT_FRAME : CHAIR_FRAME, min, size)
  const others = planes.filter((plane) => !bounds.some((b) => b?.pair.includes(plane)))
  const placed = (p: HalfSpace[]) => (upright ? tilt(p) : p)
  const body = await cut(api, part, name, stock, placed(others))
  return round(api, part, value, name, body, placed(planes), fillets)
}

/**
 * The seat tails at one end of a cross rail: the lowest, patterned up the rail. On the cross rail itself (`rounded`
 * given), each tail's corner on the seat's outside (`outside`, its face there) is rounded as the side rail's own
 * corner there; as the sockets they cut in the side rail, they stay square.
 */
async function seatTails(api: Api, part: number, name: string, planes: HalfSpace[], rounded?: { value: Value; outside: string }) {
  const square = await board(api, part, name, planes)
  const first = rounded
    ? await round(api, part, rounded.value, name, square, planes, [
        ['EDGE_BREAK', (faces) => faces.includes('ThroughMax') && faces.includes(rounded.outside)],
      ])
    : square
  const up = await created(api.v1.part.workAxis({ id: part, name: `${name}Up`, position: [0, 0, 0], direction: [0, 0, 1] }))
  return created(api.v1.part.linearPattern({
    id: part, name, targets: [first],
    dir1: { references: [up], distance: '@expr.SEAT_TAIL_PITCH', count: '@expr.SEAT_TAILS', merged: true },
  }))
}

/** A ring of the back's arc, whole, between radii `outer` and `inner`, from z0 to z1 in the back's frame. */
async function ring(api: Api, part: number, name: string, outer: string, inner: string, [z0, z1]: readonly [string, string]) {
  const cylinder = async (side: string, radius: string, from: string, height: string) => {
    const base = await created(api.v1.part.workCSys({
      id: part, name: `${name}${side}`, rotation: '[-@expr.LEAN, 0, 0]',
      offset: expr(`[0, $POST_Y + $ARC_Y*$CL + (${from})*$SL, $SEAT_TOP - $ARC_Y*$SL + (${from})*$CL]`),
    }))
    return created(api.v1.part.cylinder({ id: part, name: `${name}${side}`, references: [base], diameter: expr(`2*(${radius})`), height: expr(height) }))
  }
  const outside = await cylinder('Outer', outer, z0, `${z1} - ${z0}`)
  // Taller than the outer one, so that no two faces of the subtraction lie on one plane.
  const inside = await cylinder('Inner', inner, `${z0} - 1`, `${z1} - ${z0} + 2`)
  return created(api.v1.part.boolean({ id: part, name, type: 'SUBTRACTION', target: outside, tools: [inside] }))
}

/** A band of the back's arc, between radii `outer` and `inner`, from z0 to z1 in the back's frame: post to post. */
async function arc(api: Api, part: number, name: string, outer: string, inner: string, z: readonly [string, string]) {
  return cut(api, part, name, await ring(api, part, name, outer, inner, z), tilt(BETWEEN_POSTS))
}

/**
 * Round a back rail's ring, from z0 to z1 in the back's frame: its four arcs but the front one at `lapped` (z0 or
 * z1), on the opening's side, which the cane laps. Rounded whole, before it is cut to the posts, as in the browser
 * model, whose kernel cannot build a round that stops on the rail's end face, at a slant to it.
 */
async function roundRing(api: Api, part: number, value: Value, name: string, body: number, lapped: string) {
  if (value('$EDGE_BREAK') === 0) return body
  // From the chair to the back's frame: `tiltPoint` undone.
  const [postY, seatTop, sl, cl, arcY, rIn, zLapped] = ['$POST_Y', '$SEAT_TOP', '$SL', '$CL', '$ARC_Y', '$R_IN', lapped].map(value)
  const inBack = ([x, y, z]: Point): Point => [x, (y - postY) * cl - (z - seatTop) * sl, (y - postY) * sl + (z - seatTop) * cl]
  const edges = (await edgesOf(api, body, 'arcIndex')).filter(({ at }) => {
    const [x, y, z] = inBack(at)
    return !(Math.abs(Math.hypot(x, y - arcY) - rIn) < 1e-3 && Math.abs(z - zLapped) < 1e-3)
  })
  return fillet(api, part, `${name}Round`, edges.map(({ id }) => id), 'EDGE_BREAK')
}

/** The bodies of `bodies` that were made: an optional tool left out. */
const present = (...bodies: (number | null)[]) => bodies.filter((body) => body !== null)
const union = (api: Api, part: number, name: string, target: number, tools: number[]) =>
  created(api.v1.part.boolean({ id: part, name, type: 'UNION', target, tools }))
const subtract = (api: Api, part: number, name: string, target: number, tools: number[]) =>
  created(api.v1.part.boolean({ id: part, name, type: 'SUBTRACTION', target, tools }))
const intersect = (api: Api, part: number, name: string, target: number, tools: number[]) =>
  created(api.v1.part.boolean({ id: part, name, type: 'INTERSECTION', target, tools }))

// The cane lies on the seat's top and on the back's front, the sitter's side, as on the chair it follows: pressed into
// a groove around its opening and held there by a glued spline. Its outlines are rounded rectangles around the
// opening, drawn in the plane of the cane's face; as the boards', every one of their dimensions is an expression.

// The frame a cane's outlines are drawn in: (u, v) along the cane's face, w across it. The seat's is the chair's. The
// back's: u = x, v = -z, w = y in the back's frame (`tilt`), w from the sitter's side to the rear; turned by LEAN + 90
// degrees about x, a work coordinate system's z lies along the back's y, its y along the back's -z.
const BACK_FRAME: Frame = { rotation: expr('[-$LEAN - C:PI/2, 0, 0]'), at: ([u, v, w]) => tiltPoint([u, w, `-(${v})`]) }

/** A cane's opening in its frame: u from -halfU to halfU, v from v0 to v1. */
type Opening = { frame: Frame; halfU: string; v0: string; v1: string }
const SEAT_OPENING: Opening = { frame: CHAIR_FRAME, halfU: '$X_RAIL', v0: '$CANE_FRONT', v1: '$REAR_RAIL_Y' }
const BACK_OPENING: Opening = { frame: BACK_FRAME, halfU: '$X_POST', v0: '-$HIGH_RAIL_BOTTOM', v1: '-$LOW_RAIL_TOP' }

/**
 * The cane groove's outline `o` out from the opening's edges, filled, from w0 to w1: a rectangle, its corners rounded
 * on the groove's middle radius `o` out as well. At o = GROOVE_INSET it is the groove's middle line; GROOVE_W/2 less,
 * its inner edge; GROOVE_W/2 more, its outer edge. A cross of two boxes, and a cylinder in each corner.
 */
async function outline(api: Api, part: number, name: string, { frame, halfU, v0, v1 }: Opening, o: string, [w0, w1]: [string, string]) {
  const r = `($GROOVE_R + (${o}) - $GROOVE_INSET)`
  const u = `(${halfU} + (${o}))` // the outline's half width
  const low = `(${v0} - (${o}))`
  const high = `(${v1} + (${o}))`
  const height = `(${w1}) - (${w0})`
  const across = await block(api, part, `${name}Across`, frame, [`-${u}`, `${low} + ${r}`, w0], [`2*${u}`, `${high} - ${low} - 2*${r}`, height])
  const along = await block(api, part, `${name}Along`, frame, [`-${u} + ${r}`, low, w0], [`2*(${u} - ${r})`, `${high} - ${low}`, height])
  const corners: number[] = []
  for (const sign of ['-', '']) {
    for (const v of [`${low} + ${r}`, `${high} - ${r}`]) {
      corners.push(await column(api, part, `${name}Corner`, frame, [`${sign}(${u} - ${r})`, v, w0], r, height))
    }
  }
  return union(api, part, name, across, [along, ...corners])
}

/** The band between two of the groove's outlines (o0 inside o1), or the whole of outline o1 when o0 is null. */
async function outlines(api: Api, part: number, name: string, opening: Opening, o0: string | null, o1: string, [w0, w1]: [string, string]) {
  const outside = await outline(api, part, name, opening, o1, [w0, w1])
  if (o0 === null) return outside
  // Taller than the outer one, so that no two faces of the subtraction lie on one plane.
  const inside = await outline(api, part, `${name}Inside`, opening, o0, [`${w0} - 1`, `${w1} + 1`])
  return subtract(api, part, name, outside, [inside])
}

/**
 * A band of the groove's outlines (`outlines`) around an opening, in the frame's depth between d0 and d1 below the
 * face the cane lies on (above it where negative).
 */
type Band = (api: Api, part: number, name: string, o0: string | null, o1: string, d0: string, d1: string) => Promise<number>

/** In the seat: the face is the rails' top, the depth down from it. */
const seatBand: Band = (api, part, name, o0, o1, d0, d1) =>
  outlines(api, part, name, SEAT_OPENING, o0, o1, [`$SEAT_TOP - (${d1})`, `$SEAT_TOP - (${d0})`])

/**
 * In the back: the face is its front, the rails' inner arc between the posts and the posts' front faces on either
 * side (the arc passes through the posts' front inner arrises), the depth to the rear of it. The outlines run through
 * the back's depth, cut to that layer.
 */
const backBand: Band = async (api, part, name, o0, o1, d0, d1) => {
  const band = await outlines(api, part, name, BACK_OPENING, o0, o1, ['-2*$POST_D', '2*$POST_D'])
  const z: [string, string] = ['$LOW_RAIL_BOTTOM - 1', '$HIGH_RAIL_TOP + 1']
  const rails = await arc(api, part, `${name}Layer`, `$R_IN + (${d1})`, `$R_IN + (${d0})`, z)
  const post = (u: string) =>
    block(api, part, `${name}Layer`, BACK_FRAME, [u, `-(${z[1]})`, `-$POST_D/2 + (${d0})`], ['$POST_W', `(${z[1]}) - (${z[0]})`, `(${d1}) - (${d0})`])
  const layer = await union(api, part, `${name}Layer`, rails, [await post('$X_POST'), await post('-$X_BOARD')])
  return intersect(api, part, name, band, [layer])
}

const GROOVE_IN = '$GROOVE_INSET - $GROOVE_W/2' // the groove's inner edge, out from the opening's
const GROOVE_OUT = '$GROOVE_INSET + $GROOVE_W/2' // its outer edge

/** The groove around an opening, cut into its frame. */
const groove = (band: Band) => (api: Api, part: number) => band(api, part, 'Groove', GROOVE_IN, GROOVE_OUT, '-1', '$GROOVE_D')
const seatGroove = groove(seatBand)
const backGroove = groove(backBand)

/**
 * What the cane's groove cuts from a frame member: the groove when the chair has one (`grooved`), or nothing, with no
 * cane to hold or the groove left to the hand.
 */
const grooves = async (groove: boolean, make: (api: Api, part: number) => Promise<number>, api: Api, part: number) =>
  groove ? [await make(api, part)] : []

type Builder = (api: Api, part: number, value: Value) => Promise<number>

/** The spline in the groove's outer half, from the cane's sheet on the face down to the groove's bottom. */
const spline = (band: Band): Builder => (api, part) => band(api, part, 'Spline', '$GROOVE_INSET', GROOVE_OUT, '-$CANE_SHEET', '$GROOVE_D')

/**
 * The cane of an opening: its sheet lapping the frame out to the groove's middle and down the groove's inner half,
 * its `panel` across the opening. The weave is not modelled. The sheet is the groove's middle outline through the
 * whole depth less its inner outline below the face; the panel reaches up into the sheet: so that no two faces of
 * these booleans lie on one surface, which the engine fails on. Without the groove (`groove` false), the sheet lies flat
 * on the frame out to the groove's middle, the panel up into it as well.
 */
const cane = (band: Band, panel: Builder, groove: boolean): Builder => async (api, part, value) => {
  if (!groove) return union(api, part, 'Cane', await band(api, part, 'Sheet', null, '$GROOVE_INSET', '-$CANE_SHEET', '0'), [await panel(api, part, value)])
  const outside = await band(api, part, 'Sheet', null, '$GROOVE_INSET', '-$CANE_SHEET', '$GROOVE_D')
  const sheet = await subtract(api, part, 'Sheet', outside, [await band(api, part, 'Inside', null, GROOVE_IN, '0', '$GROOVE_D + 1')])
  return union(api, part, 'Cane', sheet, [await panel(api, part, value)])
}

// The armrest: the nose's four edges rounded at ARM_NOSE_R, then every other arris at EDGE_BREAK, but the underside's
// over the boards' tops, glued flush on them (sharp on the boards' too): before and behind the boards they are broken
// and run on into the round of the boards' edges. In three lengths, united: before the boards, the armrest rounded
// whole and cut there (rounded as a length of its own, its arrises' fillet ending on its end, the engine fails it on
// one side); over them, rounded but on its underside; behind them, rounded but on its front end. Their ends inside
// the armrest are sharp; the rear length cut from the whole one instead, the engine leaves it out of the union. The engine takes one
// radius per fillet. Without EDGE_BREAK, the whole one: its nose's rounds alone.
const ARMREST_ROUNDS: Rounds[] = [
  ['ARM_NOSE_R', (faces) => faces.includes('LengthMin')],
  ['EDGE_BREAK', allBut(['LengthMin'])],
]
async function armrestBoard(api: Api, part: number, value: Value, m: (planes: HalfSpace[]) => HalfSpace[]) {
  const whole = (name: string) => roundedBoard(api, part, value, name, m(armrest('$ARM_FRONT', '$ARM_END')), ARMREST_ROUNDS)
  if (value('$EDGE_BREAK') === 0) return whole('Armrest')
  // Beyond a plane square to y: a large box on one side of it.
  const beyond = (name: string, y: string) => block(api, part, name, CHAIR_FRAME, [`${-BIG / 2}`, y, `${-BIG / 2}`], [`${BIG}`, `${BIG}`, `${BIG}`])
  const front = await subtract(api, part, 'ArmrestFront', await whole('ArmrestFront'), [await beyond('OverBoards', '$ARM_EDGE_FRONT')])
  const glued = await roundedBoard(api, part, value, 'ArmrestGlued', m(armrest('$ARM_EDGE_FRONT', '$ARM_EDGE_REAR')), [
    ['EDGE_BREAK', allBut(['LengthMin', 'LengthMax', 'Underside'])],
  ])
  const rear = await roundedBoard(api, part, value, 'ArmrestRear', m(armrest('$ARM_EDGE_REAR', '$ARM_END')), [['EDGE_BREAK', allBut(['LengthMin'])]])
  return union(api, part, 'Armrest', glued, [front, rear])
}

/** One side's boards in the variant, its +x side as written, the other mirrored. */
function side(s: 'Left' | 'Right', groove: boolean): Record<string, Builder> {
  const m = (planes: HalfSpace[]) => (s === 'Left' ? planes : mirror(planes))
  // A point's x on this side, and the sign of +x on it.
  const x = (value: string) => (s === 'Left' ? value : `-(${value})`)
  const sx = s === 'Left' ? 1 : -1
  // Every board's arrises are rounded before its joints are cut (`allBut`).
  return {
    // Rounded but on the seam and on the top: both glued flush over their whole extent, to the other board and under
    // the armrest, the joint one surface but for a hairline (the seam's at the notch too, in the arch's inside corner).
    // Its half of the spline's slot, the side rail's tenon's mortise.
    [`FrontLeg${s}`]: async (api, part, value) =>
      subtract(api, part, 'SplineAndTenon', await roundedBoard(api, part, value, 'Leg', m(FRONT_LEG), [['EDGE_BREAK', allBut(['Seam', 'UnderArm'])]]), [
        await board(api, part, 'Spline', m(SPLINE)),
        await board(api, part, 'Tenon', m(railTenon('-$TENON_Y'))),
      ]),
    [`RearLeg${s}`]: async (api, part, value) =>
      subtract(api, part, 'SplineAndTenon', await roundedBoard(api, part, value, 'Leg', m(REAR_LEG), [['EDGE_BREAK', allBut(['Seam', 'UnderArm'])]]), [
        await board(api, part, 'Spline', m(SPLINE)),
        await board(api, part, 'Tenon', m(railTenon('$TENON_Y'))),
      ]),
    [`Spline${s}`]: (api, part) => board(api, part, 'Spline', m(SPLINE)),
    // Rounded but its inner face's top arris, which the cane laps, and its ends', on the dovetails' joint lines; its
    // inner face's bottom arris only between the cross rails, in the opening (`arrisSliver`): under them it is flush with
    // their bottoms, and a round there would be a notch in their continuous round across the seat's front and back. Its
    // outer face's top and bottom arrises sharp where they lie against the boards, in an inside corner, rounded before,
    // behind and between them (`insideCorner`). The tenons' mortises, its pins (what the tails leave), the cane's groove.
    [`SideRail${s}`]: async (api, part, value) =>
      subtract(api, part, 'MortisesSocketsAndGroove', await sharpInside(api, part, await roundedBoard(api, part, value, 'Rail', m(SIDE_RAIL), [['EDGE_BREAK', allBut([], [['ThickMin', 'HighMax'], ['ThickMin', 'HighMin'], ['ThickMin', 'LongMin'], ['ThickMin', 'LongMax']])]]), [
        await insideCorner(api, part, value, 'AgainstBoardsTop', await arrisSliver(api, part, value, 'AgainstBoardsTop', ALONG_Y_FRAME, [x('$X_BOARD'), '$SEAT_TOP'], [-sx, -1], ['-$SEAT_BACK', '-$SEAT_FRONT']), m(SIDE_HULL)),
        await insideCorner(api, part, value, 'AgainstBoardsBottom', await arrisSliver(api, part, value, 'AgainstBoardsBottom', ALONG_Y_FRAME, [x('$X_BOARD'), '$SEAT_TOP - $RAIL_H'], [-sx, 1], ['-$SEAT_BACK', '-$SEAT_FRONT']), m(SIDE_HULL), { planes: m(NOTCH), below: '$SEAT_TOP - $RAIL_H' }),
      ]), [
        ...present(await arrisSliver(api, part, value, 'Opening', ALONG_Y_FRAME, [x('$X_RAIL'), '$SEAT_TOP - $RAIL_H'], [sx, 1], ['-$REAR_RAIL_Y', '-$CANE_FRONT'])),
        await board(api, part, 'FrontTenon', m(railTenon('-$TENON_Y'))),
        await board(api, part, 'RearTenon', m(railTenon('$TENON_Y'))),
        await seatTails(api, part, 'FrontTails', m(seatTail(...FRONT_RAIL_Y))),
        await seatTails(api, part, 'RearTails', m(seatTail(...REAR_RAIL_Y))),
        ...(await grooves(groove, seatGroove, api, part)),
      ]),
    [`FrontRailTenon${s}`]: (api, part) => board(api, part, 'Tenon', m(railTenon('-$TENON_Y'))),
    [`RearRailTenon${s}`]: (api, part) => board(api, part, 'Tenon', m(railTenon('$TENON_Y'))),
    // Its rounds (`armrestBoard`); the spline's and the tenon's mortises.
    [`Armrest${s}`]: async (api, part, value) =>
      subtract(api, part, 'Mortises', await armrestBoard(api, part, value, m), [
        await board(api, part, 'Spline', m(SPLINE)),
        await board(api, part, 'Tenon', m(tilt(ARM_TENON))),
      ]),
    // Its arrises rounded as if after glue-up. Sharp are its front inner arris (the cane laps it, the rails' fronts are
    // flush with it at their dovetails) and its inner face's arrises where the rails' ends cover it: its ends' (flush
    // with the rails' tops and bottoms, the rails as deep as the post there) and its rear one over the rails' height
    // (flush with their rear faces); a round there would be a notch in the rail's continuous round. Its rear one
    // between the rails, in the opening, is rounded (`arrisSliver`): the round runs from rail to rail. Its outer face's
    // front and rear arrises sharp where they lie against the armrest, in an inside corner, rounded above and below it
    // (`insideCorner`). Its ends cut
    // into sockets by the rails' tails, the tenon's mortise, the cane's groove.
    [`BackPost${s}`]: async (api, part, value) =>
      subtract(api, part, 'SocketsMortiseAndGroove', await sharpInside(api, part, await roundedBoard(api, part, value, 'Post', m(POST), [['EDGE_BREAK', allBut([], [['AcrossMin', 'DeepMin'], ['AcrossMin', 'DeepMax'], ['AcrossMin', 'LongMin'], ['AcrossMin', 'LongMax']])]], true), [
        await insideCorner(api, part, value, 'AgainstArmrestFront', await arrisSliver(api, part, value, 'AgainstArmrestFront', UPRIGHT_FRAME, [x('$X_BOARD'), '-$POST_D/2'], [-sx, 1], ['$LOW_RAIL_BOTTOM', '$HIGH_RAIL_TOP']), m(ARMREST_OUTLINE)),
        await insideCorner(api, part, value, 'AgainstArmrestRear', await arrisSliver(api, part, value, 'AgainstArmrestRear', UPRIGHT_FRAME, [x('$X_BOARD'), '$POST_D/2'], [-sx, -1], ['$LOW_RAIL_BOTTOM', '$HIGH_RAIL_TOP']), m(ARMREST_OUTLINE)),
      ]), [
        ...present(await arrisSliver(api, part, value, 'Opening', UPRIGHT_FRAME, [x('$X_POST'), '$POST_D/2'], [sx, -1], ['$LOW_RAIL_TOP', '$HIGH_RAIL_BOTTOM'])),
        await board(api, part, 'LowTail', m(tilt(backTail(BACK_RAILS[0])))),
        await board(api, part, 'HighTail', m(tilt(backTail(BACK_RAILS[1])))),
        await board(api, part, 'Tenon', m(tilt(ARM_TENON))),
        ...(await grooves(groove, backGroove, api, part)),
      ]),
    [`ArmTenon${s}`]: (api, part) => board(api, part, 'Tenon', m(tilt(ARM_TENON))),
  }
}

/**
 * A cross rail between the side rails' inner faces, its tails through them, the cane's groove in its top. Its arrises
 * rounded but on its ends (glued to the side rails) and the top one on the opening's side (`lapped`, its face there),
 * which the cane laps; its tails' corner on the seat's outside (`outside`).
 */
const crossRailBuilder = (y: readonly [string, string], lapped: string, outside: string, groove: boolean): Builder => async (api, part, value) => {
  const middle = await roundedBoard(api, part, value, 'Rail', crossRail(y), [['EDGE_BREAK', allBut(['LongMin', 'LongMax'], [[lapped, 'HighMax']])]])
  const rail = await union(api, part, 'Tails', middle, [
    await seatTails(api, part, 'TailsLeft', seatTail(...y), { value, outside }),
    await seatTails(api, part, 'TailsRight', mirror(seatTail(...y)), { value, outside }),
  ])
  const cuts = await grooves(groove, seatGroove, api, part)
  return cuts.length ? subtract(api, part, 'Groove', rail, cuts) : rail
}

/**
 * A back rail: an arc between the posts' inner faces, its arcs rounded but the front one on the opening's side
 * (`lapped`, z0 or z1), which the cane laps (its ends are glued), its ends cut into tails through the posts, the
 * cane's groove in its front face. Each tail's end through the post is rounded as the post's own arris there, at the
 * post's end (`end`: the low rail's bottom, the high rail's top): the post's round runs on across the tail, which
 * would stand proud of it square.
 */
const backRailBuilder = (z: readonly [string, string], lapped: string, end: 'HighMin' | 'HighMax', groove: boolean): Builder => async (api, part, value) => {
  const whole = await roundRing(api, part, value, 'Rail', await ring(api, part, 'Rail', '$R_OUT', '$R_IN', z), lapped)
  const tail = async (name: string, planes: HalfSpace[]) =>
    round(api, part, value, name, await board(api, part, name, planes), planes, [
      ['EDGE_BREAK', (faces) => faces.includes('ThroughMax') && faces.includes(end)],
    ])
  const rail = await union(api, part, 'Tails', await cut(api, part, 'Rail', whole, tilt(BETWEEN_POSTS)), [
    await tail('TailLeft', tilt(backTail(z))),
    await tail('TailRight', mirror(tilt(backTail(z)))),
  ])
  const cuts = await grooves(groove, backGroove, api, part)
  return cuts.length ? subtract(api, part, 'Groove', rail, cuts) : rail
}

// The leather variant's seat: a plywood board on teak cleats, the cushion on it, in the opening between the rails.
//
// The board rests on cleats glued and screwed to the four rails' inner faces rather than in a rebate milled into them:
// the rails are cut flat from the top on the ShopBot, and a rebate on their inner face is a side-machining operation
// (or a rebating bit by hand after the dovetails), while the cleats are more flat parts, cut from the top like any
// board. They also let the board be screwed from below, and the cushion lifted out.
const CLEAT_HEIGHT = slab('High', 2, '$CLEAT_TOP - $CLEAT', '$CLEAT_TOP')
const SIDE_CLEAT = [...slab('Thick', 0, '$CLEAT_X', '$X_RAIL'), ...slab('Long', 1, '$CANE_FRONT', '$REAR_RAIL_Y'), ...CLEAT_HEIGHT]
const crossCleat = (y0: string, y1: string) => [...slab('Long', 0, '-$CLEAT_X', '$CLEAT_X'), ...slab('Thick', 1, y0, y1), ...CLEAT_HEIGHT]
const fill = (z0: string, z1: string) => [
  ...slab('Wide', 0, '-$X_RAIL + $GAP', '$X_RAIL - $GAP'),
  ...slab('Deep', 1, '$CANE_FRONT + $GAP', '$REAR_RAIL_Y - $GAP'),
  ...slab('Thick', 2, z0, z1),
]

// The leather variant's back, an upholstered panel between the posts and the rails: a bending-plywood backer and its
// pad, screwed from behind through the backer into two curved teak fillets. The rails are arcs in plan, so the fillets
// are flat parts too: arc bands at the rails' rear face, on the low rail and under the high one. The backer is just in
// front of them, the pad in front of it, to just proud of the rails' front face.
// The arcs' heights are written z1 - z0 (`ring`): an expression for z0 goes in parentheses.
const BACK_OPEN = ['$LOW_RAIL_TOP', '$HIGH_RAIL_BOTTOM'] as const

/**
 * The chair's boards in the variant, by name: 26 with cane, 24 without its groove (`groove` false: no splines), 32
 * with leather.
 */
function boards(variant: Variant, groove: boolean): Record<string, Builder> {
  const seat: Record<string, Builder> = {
    ...side('Left', groove),
    ...side('Right', groove),
    FrontRail: crossRailBuilder(FRONT_RAIL_Y, 'ThickMax', 'RailMin', groove),
    RearRail: crossRailBuilder(REAR_RAIL_Y, 'ThickMin', 'RailMax', groove),
  }
  const back: Record<string, Builder> = {
    LowBackRail: backRailBuilder(BACK_RAILS[0], BACK_RAILS[0][1], 'HighMin', groove),
    HighBackRail: backRailBuilder(BACK_RAILS[1], BACK_RAILS[1][0], 'HighMax', groove),
  }
  if (variant === 'leather') {
    return {
      ...seat,
      ...back,
      SeatCleatLeft: (api, part) => board(api, part, 'Cleat', SIDE_CLEAT),
      SeatCleatRight: (api, part) => board(api, part, 'Cleat', mirror(SIDE_CLEAT)),
      FrontSeatCleat: (api, part) => board(api, part, 'Cleat', crossCleat('$CANE_FRONT', '$CANE_FRONT + $CLEAT')),
      RearSeatCleat: (api, part) => board(api, part, 'Cleat', crossCleat('$REAR_RAIL_Y - $CLEAT', '$REAR_RAIL_Y')),
      SeatBoard: (api, part) => board(api, part, 'Board', fill('$CLEAT_TOP', '$BOARD_TOP')),
      SeatCushion: (api, part) => board(api, part, 'Cushion', fill('$BOARD_TOP', '$SEAT_TOP + $CUSHION_PROUD')),
      LowBackFillet: (api, part) => arc(api, part, 'Fillet', '$R_OUT', '$BACKER_OUT', [BACK_OPEN[0], `(${BACK_OPEN[0]} + $FILLET)`]),
      HighBackFillet: (api, part) => arc(api, part, 'Fillet', '$R_OUT', '$BACKER_OUT', [`(${BACK_OPEN[1]} - $FILLET)`, BACK_OPEN[1]]),
      BackBoard: (api, part) => arc(api, part, 'Board', '$BACKER_OUT', '$BACKER_IN', BACK_OPEN),
      BackPad: (api, part) => arc(api, part, 'Pad', '$BACKER_IN', '$R_IN - $BACK_PAD_PROUD', BACK_OPEN),
    }
  }
  return {
    ...seat,
    // The splines are rattan, glued in; none without the groove.
    ...(groove && { SeatCaneSpline: spline(seatBand) }),
    // The seat's panel in its opening, just under the rails' top, and up into the cane's sheet on it (`cane`).
    SeatCane: cane(seatBand, (api, part) => board(api, part, 'Cane', SEAT_CANE), groove),
    ...back,
    ...(groove && { BackCaneSpline: spline(backBand) }),
    // The back's panel in its opening, just behind its front, and up into the cane's sheet on it (`cane`).
    BackCane: cane(backBand, (api, part) => arc(api, part, 'Cane', '$R_IN + $CANE_T', '$R_IN - $CANE_SHEET/2', ['$LOW_RAIL_TOP', '$HIGH_RAIL_BOTTOM']), groove),
  }
}

/** A board's colour, by its name. */
function color(name: string): [number, number, number] {
  if (name.includes('Cane')) return CANE
  if (name === 'SeatCushion' || name === 'BackPad') return LEATHER
  if (name === 'SeatBoard' || name === 'BackBoard') return PLYWOOD
  return TEAK
}

/**
 * Build the chair: one part whose expressions drive every board, each board a named body in it; returns the part,
 * the boards' feature ids and their volumes.
 * @param given Every master's value: the masters are the part's first expressions (EDGE_BREAK under 1 mm taken as 0).
 * @param variant The variant's id (compass-armchair.masters.ts): cane, or leather.
 */
export default async function build(api: Api, given: ChairValues, variant: string) {
  // Under 1 mm, no round (as the browser model): the part's EDGE_BREAK is the one built.
  const values = { ...given, EDGE_BREAK: edgeBreak(given.EDGE_BREAK) }
  const id: Variant = variant === 'leather' ? 'leather' : 'cane'
  const part = await created(api.v1.part.create({ name: 'CompassArmchair' }))
  await api.v1.part.expression({
    id: part,
    toCreate: [
      ...Object.entries(values).map(([name, value]) => ({ name, value })),
      ...Object.entries(derived(id)).map(([name, value]) => ({ name, value })),
    ],
  })

  const value = evaluator(values, id)
  const bodies: Record<string, number> = {}
  for (const [name, make] of Object.entries(boards(id, grooved(id, values.GROOVE)))) {
    const body = await make(api, part, value)
    await api.v1.part.setAppearance({ target: body, color: color(name) })
    bodies[name] = body
  }
  return { part, boards: bodies, volumes: await nameSolids(api, bodies) }
}
