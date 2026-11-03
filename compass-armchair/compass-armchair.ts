// Compass armchair, a parametric ClassCAD part. `nr build` calls this module's default export with the ClassCAD
// script API (`api.v1`, as the ClassCAD MCP's run_script gives it), on an empty drawing.
//
// A teak and cane armchair on compass legs, after the 1955 Chandigarh office chair, measured from a side view (the
// smlibpy example `examples/compass_armchair.py`, whose dimensions and joinery this follows). Each side is two
// tapered boards in a V and an armrest on edge, all 30 mm thick and in one plane, joined by a loose tenon on the
// seam. The seat frame's side rails take the boards on loose tenons, its cross rails are dovetailed through them.
// The curved back hangs between the armrests: two leaning posts, each on one loose tenon into its armrest, and two
// arched rails dovetailed through the posts. The cane panels are flat, the weave is not modelled.
// The chair faces -Y, x = 0 is its middle, the floor is z = 0; +x is the sitter's left.
//
// As for the zigzag chair, every flat board is a large box cut down by half-spaces: work planes whose position and
// normal are expressions. The arched members are a cylinder less a smaller one, cut the same way. Changing a
// parameter moves the planes and the whole history rebuilds. The chair is one part: its expressions are the
// parameters, and every board is a named body in it, so changing one rebuilds them all.

import { type Api, created, nameSolids } from '../scripts/part.ts'
import type { CamConfig } from '../scripts/cam/config.ts'

const TEAK: [number, number, number] = [155, 106, 60] // #9b6a3c
const CANE: [number, number, number] = [230, 210, 160] // #e6d2a0

/** The parameters a maker changes, in mm (angles in degrees). */
export const MASTERS = {
  W: 480, // outside width over the side boards
  LEG_T: 30, // the side boards' thickness, across the chair
  FRONT_FOOT_FRONT: -181, // the front leg's foot on the floor, front edge to back edge
  FRONT_FOOT_BACK: -139,
  REAR_FOOT_FRONT: 139,
  REAR_FOOT_BACK: 181,
  NOTCH_Z: 400, // where the two boards of a side part, on the seam y = 0
  ARM_EDGE_FRONT: -70, // the boards' outer edges where they meet the armrest
  ARM_EDGE_REAR: 70,
  SPLINE_W: 20, // the loose tenon on the seam: across, thick, from this height up, on into the armrest
  SPLINE_T: 16,
  SPLINE_Z: 457,
  SPLINE_IN_ARM: 40,
  ARM_TOP: 645, // the armrest: its level top, its nose
  ARM_FRONT: -235,
  ARM_NOSE_H: 60, // its height at the nose and at y = ARM_BACK_Y: the underside slopes
  ARM_BACK_Y: 280,
  ARM_BACK_H: 95,
  ARM_BEHIND: 40, // the armrest runs on this much behind the posts, at its mid-height
  SEAT_TOP: 437, // the seat frame
  RAIL_H: 60,
  RAIL_T: 25,
  CANE_T: 8,
  SEAT_FRONT: -229, // the side rails, nose to back
  SEAT_BACK: 240,
  FRONT_RAIL_T: 30,
  REAR_RAIL_T: 40,
  TENON_LEN: 20, // a side rail's loose tenon: into the board, thick, high, at y = -+TENON_Y, into the rail
  TENON_T: 10,
  TENON_H: 40,
  TENON_Y: 55,
  TENON_IN_RAIL: 15,
  BACK_TILT: 15, // the back's lean, degrees
  POST_W: 30, // a post: across, deep
  POST_D: 40,
  POST_Y_AT_ARM: 260, // the posts' axis at the armrest's top
  BOW: 10, // the back's arc bows this much behind the posts, between them
  LOW_RAIL_BOTTOM: 65, // the back rails, along the posts from seat height; the posts end flush with them
  LOW_RAIL_TOP: 100,
  HIGH_RAIL_BOTTOM: 330,
  HIGH_RAIL_TOP: 365,
  ARM_TENON: 12, // a post's loose tenon into its armrest: thick, deep into each, wood left above and below it
  ARM_TENON_DEPTH: 15,
  ARM_TENON_MARGIN: 8,
  SLOPE: 1 / 6, // dovetail slope
  SEAT_TAILS: 2, // tails per seat corner
  SEAT_PIN_EDGE: 6, // the pins at the side rail's outside: at the rail's edges, between tails
  SEAT_PIN_MID: 6,
  BACK_TAIL_SHOULDER: 12, // the back rail's shoulders either side of its tail
}

/** How `pnpm cam` cuts the parts (see CamConfig): what Fusion cannot know from the STEP. */
export const CAM = {
  defaults: { material: 'teak' },
  parts: {
    // The loose tenons: their grain across the joint, along their length into both members, not their height.
    FrontRailTenonLeft: { grain: 90 },
    FrontRailTenonRight: { grain: 90 },
    RearRailTenonLeft: { grain: 90 },
    RearRailTenonRight: { grain: 90 },
    ArmTenonLeft: { grain: 90 },
    ArmTenonRight: { grain: 90 },
    // Woven cane on its frame, not milled.
    SeatCane: { skip: true },
    BackCane: { skip: true },
  },
} satisfies CamConfig

// Everything else, derived. The armrest's underside is z = U0 - K y.
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
  Z_TENON: 'SEAT_TOP - RAIL_H/2',
  LEAN: 'BACK_TILT*C:PI/180',
  SL: 'sin(LEAN)',
  CL: 'cos(LEAN)',
  TL: 'SL/CL',
  POST_Y: 'POST_Y_AT_ARM - (ARM_TOP - SEAT_TOP)*TL', // the posts' axis at seat height
  // The back rails' faces, two arcs about one centre: flush with the posts' faces at their inner face, the rear one
  // BOW behind them in the middle.
  R_OUT: '(X_POST*X_POST + BOW*BOW)/(2*BOW)',
  ARC_Y: 'POST_D/2 + BOW - R_OUT', // the centre, in the back's frame
  R_IN: 'sqrt(X_POST*X_POST + (ARC_Y + POST_D/2)*(ARC_Y + POST_D/2))',
  R_BACK: '(R_OUT + R_IN)/2', // the arc's middle line, the cane's
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
}


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
 * BACK_TILT about x.
 */
const tilt = (planes: HalfSpace[]) =>
  planes.map(({ name, at: [x, y, z], normal: [nx, ny, nz] }) =>
    H(
      name,
      [x, `$POST_Y + (${y})*$CL + (${z})*$SL`, `$SEAT_TOP - (${y})*$SL + (${z})*$CL`],
      [nx, `(${ny})*$CL + (${nz})*$SL`, `-(${ny})*$SL + (${nz})*$CL`],
    ),
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
const ARMREST = [
  ...BOARD,
  ...slab('Length', 1, '$ARM_FRONT', '$ARM_END'),
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
const SEAT_CANE = [
  ...slab('Wide', 0, '-$X_RAIL', '$X_RAIL'),
  ...slab('Deep', 1, '$CANE_FRONT', '$REAR_RAIL_Y'),
  ...slab('Thick', 2, '$SEAT_TOP - $CANE_T', '$SEAT_TOP'),
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

/** The seat tails at one end of a cross rail: the lowest, patterned up the rail. */
async function seatTails(api: Api, part: number, name: string, planes: HalfSpace[]) {
  const first = await board(api, part, name, planes)
  const up = await created(api.v1.part.workAxis({ id: part, name: `${name}Up`, position: [0, 0, 0], direction: [0, 0, 1] }))
  return created(api.v1.part.linearPattern({
    id: part, name, targets: [first],
    dir1: { references: [up], distance: '@expr.SEAT_TAIL_PITCH', count: '@expr.SEAT_TAILS', merged: true },
  }))
}

/** A band of the back's arc, between radii `outer` and `inner`, from z0 to z1 in the back's frame. */
async function arc(api: Api, part: number, name: string, outer: string, inner: string, [z0, z1]: readonly [string, string]) {
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
  const band = await created(api.v1.part.boolean({ id: part, name, type: 'SUBTRACTION', target: outside, tools: [inside] }))
  return cut(api, part, name, band, tilt(BETWEEN_POSTS))
}

const union = (api: Api, part: number, name: string, target: number, tools: number[]) =>
  created(api.v1.part.boolean({ id: part, name, type: 'UNION', target, tools }))
const subtract = (api: Api, part: number, name: string, target: number, tools: number[]) =>
  created(api.v1.part.boolean({ id: part, name, type: 'SUBTRACTION', target, tools }))

type Builder = (api: Api, part: number) => Promise<number>

/** One side's boards, its +x side as written, the other mirrored. */
function side(s: 'Left' | 'Right'): Record<string, Builder> {
  const m = (planes: HalfSpace[]) => (s === 'Left' ? planes : mirror(planes))
  return {
    [`FrontLeg${s}`]: async (api, part) =>
      subtract(api, part, 'SplineAndTenon', await board(api, part, 'Leg', m(FRONT_LEG)), [
        await board(api, part, 'Spline', m(SPLINE)),
        await board(api, part, 'Tenon', m(railTenon('-$TENON_Y'))),
      ]),
    [`RearLeg${s}`]: async (api, part) =>
      subtract(api, part, 'SplineAndTenon', await board(api, part, 'Leg', m(REAR_LEG)), [
        await board(api, part, 'Spline', m(SPLINE)),
        await board(api, part, 'Tenon', m(railTenon('$TENON_Y'))),
      ]),
    [`Spline${s}`]: (api, part) => board(api, part, 'Spline', m(SPLINE)),
    [`SideRail${s}`]: async (api, part) =>
      subtract(api, part, 'MortisesAndSockets', await board(api, part, 'Rail', m(SIDE_RAIL)), [
        await board(api, part, 'FrontTenon', m(railTenon('-$TENON_Y'))),
        await board(api, part, 'RearTenon', m(railTenon('$TENON_Y'))),
        await seatTails(api, part, 'FrontTails', m(seatTail(...FRONT_RAIL_Y))),
        await seatTails(api, part, 'RearTails', m(seatTail(...REAR_RAIL_Y))),
      ]),
    [`FrontRailTenon${s}`]: (api, part) => board(api, part, 'Tenon', m(railTenon('-$TENON_Y'))),
    [`RearRailTenon${s}`]: (api, part) => board(api, part, 'Tenon', m(railTenon('$TENON_Y'))),
    [`Armrest${s}`]: async (api, part) =>
      subtract(api, part, 'Mortises', await board(api, part, 'Armrest', m(ARMREST)), [
        await board(api, part, 'Spline', m(SPLINE)),
        await board(api, part, 'Tenon', m(tilt(ARM_TENON))),
      ]),
    [`BackPost${s}`]: async (api, part) =>
      subtract(api, part, 'SocketsAndMortise', await board(api, part, 'Post', m(tilt(POST))), [
        await board(api, part, 'LowTail', m(tilt(backTail(BACK_RAILS[0])))),
        await board(api, part, 'HighTail', m(tilt(backTail(BACK_RAILS[1])))),
        await board(api, part, 'Tenon', m(tilt(ARM_TENON))),
      ]),
    [`ArmTenon${s}`]: (api, part) => board(api, part, 'Tenon', m(tilt(ARM_TENON))),
  }
}

const crossRailBuilder = (y: readonly [string, string]): Builder => async (api, part) =>
  union(api, part, 'Tails', await board(api, part, 'Rail', crossRail(y)), [
    await seatTails(api, part, 'TailsLeft', seatTail(...y)),
    await seatTails(api, part, 'TailsRight', mirror(seatTail(...y))),
  ])

const backRailBuilder = (z: readonly [string, string]): Builder => async (api, part) =>
  union(api, part, 'Tails', await arc(api, part, 'Rail', '$R_OUT', '$R_IN', z), [
    await board(api, part, 'TailLeft', tilt(backTail(z))),
    await board(api, part, 'TailRight', mirror(tilt(backTail(z)))),
  ])

const BOARDS: Record<string, Builder> = {
  ...side('Left'),
  ...side('Right'),
  FrontRail: crossRailBuilder(FRONT_RAIL_Y),
  RearRail: crossRailBuilder(REAR_RAIL_Y),
  SeatCane: (api, part) => board(api, part, 'Cane', SEAT_CANE),
  LowBackRail: backRailBuilder(BACK_RAILS[0]),
  HighBackRail: backRailBuilder(BACK_RAILS[1]),
  BackCane: (api, part) => arc(api, part, 'Cane', '$R_BACK + $CANE_T/2', '$R_BACK - $CANE_T/2', ['$LOW_RAIL_TOP', '$HIGH_RAIL_BOTTOM']),
}

/**
 * Build the chair: one part whose expressions drive every board, each board a named body in it; returns the part,
 * the boards' feature ids and their volumes.
 */
export default async function build(api: Api) {
  const part = await created(api.v1.part.create({ name: 'CompassArmchair' }))
  await api.v1.part.expression({
    id: part,
    toCreate: [...Object.entries(MASTERS), ...Object.entries(DERIVED)].map(([name, value]) => ({ name, value })),
  })

  const boards: Record<string, number> = {}
  for (const [name, make] of Object.entries(BOARDS)) {
    const body = await make(api, part)
    await api.v1.part.setAppearance({ target: body, color: name.includes('Cane') ? CANE : TEAK })
    boards[name] = body
  }
  return { part, boards, volumes: await nameSolids(api, boards) }
}
