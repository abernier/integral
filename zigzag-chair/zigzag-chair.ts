// Zigzag chair, a parametric ClassCAD part. `nr build` calls this module's default export with the ClassCAD
// script API (`api.v1`, as the ClassCAD MCP's run_script gives it), on an empty drawing, and the masters' values.
//
// Four cherry boards 19 mm thick, after Rietveld's 1934 Zig-Zag: the seat, the slant and the base tapered and
// mitred at 45 degrees with a glued cleat in each mitre's acute angle, the base's sides planed flush with the
// slant's, the back dovetailed through the seat, a hand grip in its rear face.
// The chair faces -Y, x = 0 is its middle, the floor is z = 0.
//
// Every board is a large box cut down by half-spaces: work planes whose position and normal are expressions.
// Changing a parameter moves the planes and the whole history rebuilds. The chair is one part: its expressions are
// the parameters, and every board is a named body in it, so changing one rebuilds them all.

import { type Api, created, nameSolids } from '../scripts/part.ts'
import type { CamConfig } from '../scripts/cam.config.ts'
import type { Values } from '../scripts/masters.ts'
import type { MASTERS } from './zigzag-chair.masters.ts'

const CHERRY: [number, number, number] = [168, 96, 58] // #a8603a

/** The masters' values, one per name of zigzag-chair.masters.ts. */
type ChairValues = Values<typeof MASTERS>

/** How `pnpm cam` cuts the parts of the chair made with `values` (see CamConfig): what Fusion cannot know from the STEP. */
export function CAM(values: ChairValues): CamConfig {
  const lean = values.BACK_LEAN
  return {
    defaults: { material: 'cherry' },
    parts: {
      // The tails are square to the back, which leans: once cut on its sheet, the seat goes on a wedge of the back's
      // lean, turned as much about x, and the tool comes along the tails' walls; it cuts only those.
      Seat: { setups: [{ name: `wedge${lean}`, wedge: lean, rotate: [lean, 0, 0], cut: 'squared' }] },
      // Near square, wider than high: its grain runs up its height, across its tails, not along its longest side.
      Back: { grain: 90 },
      // The triangular cleats: the table saw.
      SeatCleat: { skip: true },
      FootCleat: { skip: true },
    },
  }
}

// Everything else, derived. The slant is fixed at 45 degrees, both mitres bisect it (22.5 degrees).
const DERIVED = {
  S2: 'sqrt(2)',
  MITRE: 'tan(C:PI/8)',
  LEAN: 'BACK_LEAN*C:PI/180',
  SL: 'sin(LEAN)',
  CL: 'cos(LEAN)',
  HEIGHT: 'SEAT_TOP + BACK_H*CL', // the back's rear top corner
  DEPTH: 'SEAT_LEN + BACK_H*SL',
  Y_NOSE: '-DEPTH/2',
  SEAT_BOTTOM: 'SEAT_TOP - T',
  REAR_TOP_Y: 'Y_NOSE + DEPTH',
  REAR_SB: 'REAR_TOP_Y - (HEIGHT - SEAT_BOTTOM)*SL/CL', // the back's rear face at the seat's underside
  FRONT_SB: 'REAR_SB - T/CL', // its front face there
  FRONT_MID: 'REAR_TOP_Y - (HEIGHT - SEAT_TOP + T/2)*SL/CL - T/CL', // its front face at the seat's mid-thickness
  SI_Y: 'Y_NOSE + T/MITRE', // the top mitre's inner corner
  FOOT_Y: 'Y_NOSE + SEAT_TOP + T*S2', // the bottom mitre's outer corner, on the floor
  BI_Y: 'Y_NOSE + SEAT_TOP - T', // the bottom mitre's inner corner, on the base's top
  BASE_FRONT_Y: 'FOOT_Y - BASE_LENGTH',
  SLANT_LEN: '(2*SEAT_TOP + T*S2)/S2', // from the nose to the foot, along the slant
  RATE: '(W_NOSE - W_FOOT)/2/SLANT_LEN', // how much each side comes in, a millimeter along a board
  RATE_S: 'RATE/S2',
  W_BACK: 'W_NOSE - 2*RATE*(FRONT_MID - Y_NOSE)', // the back, as wide as the seat at its front face
  TAIL_REAR: '(W_BACK - 2*HALF_PIN - (TAILS - 1)*PIN)/TAILS',
  TAIL_FRONT: 'TAIL_REAR - 2*T*SLOPE',
  TAIL_PITCH: 'TAIL_REAR + PIN',
  TAIL_X0: '-W_BACK/2 + HALF_PIN + TAIL_REAR/2',
  // The base's planed sides: x = W_FOOT/2 + BASE_Y (y - FOOT_Y) + BASE_Z z, through the foot, through the bottom
  // mitre's inner corner at the slant's width there, W_BASE_FRONT wide on the top face's front edge.
  AT_INNER: 'W_NOSE/2 - RATE*(2*SEAT_TOP - 2*T)/S2 - W_FOOT/2',
  AT_FRONT: '(W_BASE_FRONT - W_FOOT)/2',
  DY_INNER: '-T - T*S2',
  BASE_Y: '(AT_INNER - AT_FRONT)/(DY_INNER + BASE_LENGTH)',
  BASE_Z: '(AT_INNER - BASE_Y*DY_INNER)/T',
  BEVEL: 'BASE_Z*T',
  // The grip's middle on its floor, GRIP_DEEP inside the rear face; GRIP_ALONG is measured up the rear face.
  GRIP_ALONG: '(REAR_TOP_Y - FRONT_SB - T*CL)*SL + (HEIGHT - SEAT_BOTTOM + T*SL)*CL - GRIP_BELOW - GRIP_HIGH/2',
  GRIP_CY: 'FRONT_SB + (T - GRIP_DEEP)*CL + GRIP_ALONG*SL',
  GRIP_CZ: 'SEAT_BOTTOM - (T - GRIP_DEEP)*SL + GRIP_ALONG*CL',
}


// Half-spaces as [name, a point on the plane, its normal], the normal pointing into the material. `@expr.X` is
// written `$X` here for brevity.
type HalfSpace = [name: string, position: string, normal: string]

const TOP = (z: string | number) => [`[0, 0, ${z}]`, '[0, 0, -1]'] as const
const BOTTOM = (z: string | number) => [`[0, 0, ${z}]`, '[0, 0, 1]'] as const
const SEAT_SIDES: HalfSpace[] = [
  ['SeatRight', '[$W_NOSE/2, $Y_NOSE, 0]', '[-1, -$RATE, 0]'],
  ['SeatLeft', '[-$W_NOSE/2, $Y_NOSE, 0]', '[1, -$RATE, 0]'],
]
const SLANT_SIDES: HalfSpace[] = [
  ['SlantRight', '[$W_NOSE/2, $Y_NOSE, $SEAT_TOP]', '[-1, -$RATE_S, $RATE_S]'],
  ['SlantLeft', '[-$W_NOSE/2, $Y_NOSE, $SEAT_TOP]', '[1, -$RATE_S, $RATE_S]'],
]
const BASE_SIDES: HalfSpace[] = [
  ['BaseRight', '[$W_FOOT/2, $FOOT_Y, 0]', '[-1, $BASE_Y, $BASE_Z]'],
  ['BaseLeft', '[-$W_FOOT/2, $FOOT_Y, 0]', '[1, $BASE_Y, $BASE_Z]'],
]
const BACK_FRONT: HalfSpace = ['BackFront', '[0, $FRONT_SB, $SEAT_BOTTOM]', '[0, $CL, -$SL]']
const BACK_REAR: HalfSpace = ['BackRear', '[0, $REAR_SB, $SEAT_BOTTOM]', '[0, -$CL, $SL]']
const SEAT_SLAB: HalfSpace[] = [
  ['SeatTop', ...TOP('$SEAT_TOP')],
  ['SeatUnderside', ...BOTTOM('$SEAT_BOTTOM')],
]

const BOARDS: Record<string, HalfSpace[]> = {
  Seat: [
    ...SEAT_SLAB,
    ['SeatRearEnd', '[0, $FRONT_SB, $SEAT_BOTTOM]', '[0, -$CL, $SL]'], // on the back's front face
    ['SeatMitre', '[0, $Y_NOSE, $SEAT_TOP]', '[0, $MITRE, 1]'],
    ...SEAT_SIDES,
  ],
  Back: [
    BACK_FRONT,
    BACK_REAR,
    ['BackBottom', ...BOTTOM('$SEAT_BOTTOM')], // flush with the seat's underside
    ['BackTopEdge', '[0, $REAR_TOP_Y, $HEIGHT]', '[0, -$SL, -$CL]'], // square to its faces
    ['BackRight', '[$W_BACK/2, 0, 0]', '[-1, 0, 0]'],
    ['BackLeft', '[-$W_BACK/2, 0, 0]', '[1, 0, 0]'],
  ],
  Slant: [
    ['SlantFront', '[0, $Y_NOSE, $SEAT_TOP]', '[0, 1, 1]'],
    ['SlantRear', '[0, $FOOT_Y, 0]', '[0, -1, -1]'],
    ['SlantTopMitre', '[0, $Y_NOSE, $SEAT_TOP]', '[0, -$MITRE, -1]'],
    ['SlantFootMitre', '[0, $FOOT_Y, 0]', '[0, $MITRE, 1]'],
    ...SLANT_SIDES,
  ],
  Base: [
    ['BaseUnderside', ...BOTTOM(0)],
    ['BaseTop', ...TOP('$T')],
    ['BaseFrontEnd', '[0, $BASE_FRONT_Y, 0]', '[0, 1, 0]'],
    ['BaseMitre', '[0, $FOOT_Y, 0]', '[0, -$MITRE, -1]'],
    ...BASE_SIDES,
  ],
  // A cleat is flush with the narrower board's sides: cut by both boards' side planes.
  SeatCleat: [
    ['CleatTop', ...TOP('$SEAT_BOTTOM')],
    ['CleatFace', '[0, $SI_Y + $CLEAT, 0]', '[0, -1, 0]'],
    ['CleatOnSlant', '[0, $SI_Y, $SEAT_BOTTOM]', '[0, 1, 1]'],
    ...SEAT_SIDES,
    ...SLANT_SIDES,
  ],
  FootCleat: [
    ['CleatBottom', ...BOTTOM('$T')],
    ['CleatFace', '[0, $BI_Y - $CLEAT, 0]', '[0, 1, 0]'],
    ['CleatOnSlant', '[0, $BI_Y, $T]', '[0, -1, -1]'],
    ...BASE_SIDES,
    ...SLANT_SIDES,
  ],
}

// The first dovetail tail, square to the back, wide at its rear face; patterned TAILS times across the chair.
const TAIL: HalfSpace[] = [
  BACK_FRONT,
  BACK_REAR,
  ...SEAT_SLAB,
  ['TailLeftFlank', '[$TAIL_X0 - $TAIL_FRONT/2, $FRONT_SB, $SEAT_BOTTOM]', '[1, $SLOPE*$CL, -$SLOPE*$SL]'],
  ['TailRightFlank', '[$TAIL_X0 + $TAIL_FRONT/2, $FRONT_SB, $SEAT_BOTTOM]', '[-1, $SLOPE*$CL, -$SLOPE*$SL]'],
]

const expr = (s: string) => s.replace(/\$/g, '@expr.')
const BIG = 3000

async function cutBoard(api: Api, part: number, name: string, planes: HalfSpace[]) {
  const corner = await created(api.v1.part.workCSys({ id: part, name: `${name}Stock`, offset: [-BIG / 2, -BIG / 2, -BIG / 2] }))
  let body = await created(api.v1.part.box({ id: part, name: `${name}Stock`, length: BIG, width: BIG, height: BIG, references: [corner] }))
  for (const [planeName, position, normal] of planes) {
    const plane = await created(api.v1.part.workPlane({ id: part, name: `${name}_${planeName}`, position: expr(position), normal: expr(normal) }))
    body = await created(api.v1.part.slice({ id: part, name: `${name}_${planeName}`, targets: [body], reference: plane }))
  }
  return body
}

async function tails(api: Api, part: number, board: string) {
  const first = await cutBoard(api, part, `${board}Tail`, TAIL)
  const across = await created(api.v1.part.workAxis({ id: part, name: `${board}Across`, position: [0, 0, 0], direction: [1, 0, 0] }))
  return created(api.v1.part.linearPattern({
    id: part, name: `${board}Tails`, targets: [first],
    dir1: { references: [across], distance: '@expr.TAIL_PITCH', count: '@expr.TAILS', merged: true },
  }))
}

// The grip's pocket: a box between two cylinders, sunk square into the back's rear face. The work csys turns
// about x so that its z axis runs through the back (front face to rear face) and its y axis down the back.
async function grip(api: Api, part: number) {
  const rotation = '[-(C:PI/2 + @expr.LEAN), 0, 0]'
  const mid = await created(api.v1.part.workCSys({
    id: part, name: 'GripMid', rotation,
    offset: expr('[-($GRIP - $GRIP_HIGH)/2, $GRIP_CY + $GRIP_HIGH/2*$SL, $GRIP_CZ + $GRIP_HIGH/2*$CL]'),
  }))
  const tools = [await created(api.v1.part.box({
    id: part, name: 'GripMid', references: [mid],
    length: expr('$GRIP - $GRIP_HIGH'), width: '@expr.GRIP_HIGH', height: '@expr.GRIP_DEEP',
  }))]
  for (const [side, sign] of [['Right', ''], ['Left', '-']]) {
    const end = await created(api.v1.part.workCSys({
      id: part, name: `GripEnd${side}`, rotation,
      offset: expr(`[${sign}($GRIP - $GRIP_HIGH)/2, $GRIP_CY, $GRIP_CZ]`),
    }))
    tools.push(await created(api.v1.part.cylinder({
      id: part, name: `GripEnd${side}`, references: [end], diameter: '@expr.GRIP_HIGH', height: '@expr.GRIP_DEEP',
    })))
  }
  return tools
}

/**
 * Build the chair: one part whose expressions drive every board, each board a named body in it; returns the part,
 * the boards' feature ids and their volumes.
 * @param values Every master's value: the masters are the part's first expressions.
 */
export default async function build(api: Api, values: ChairValues) {
  const part = await created(api.v1.part.create({ name: 'ZigzagChair' }))
  await api.v1.part.expression({
    id: part,
    toCreate: [...Object.entries(values), ...Object.entries(DERIVED)].map(([name, value]) => ({ name, value })),
  })

  const boards: Record<string, number> = {}
  for (const [name, planes] of Object.entries(BOARDS)) {
    let body = await cutBoard(api, part, name, planes)
    if (name === 'Seat') {
      body = await created(api.v1.part.boolean({ id: part, name: 'Dovetails', type: 'UNION', target: body, tools: [await tails(api, part, name)] }))
    }
    if (name === 'Back') {
      const cut = [await tails(api, part, name), ...(await grip(api, part))]
      body = await created(api.v1.part.boolean({ id: part, name: 'SocketsAndGrip', type: 'SUBTRACTION', target: body, tools: cut }))
    }
    await api.v1.part.setAppearance({ target: body, color: CHERRY })
    boards[name] = body
  }
  return { part, boards, volumes: await nameSolids(api, boards) }
}
