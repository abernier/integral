// Zigzag chair, a parametric ClassCAD assembly. `nr build` calls this module's default export with the ClassCAD
// script API (`api.v1`, as the ClassCAD MCP's run_script gives it), on an empty drawing.
//
// Geometry and joinery follow smlibpy's examples/zigzag_chair.py: four cherry boards 19 mm thick, the seat, the
// slant and the base tapered and mitred at 45 degrees with a glued cleat in each mitre's acute angle, the base's
// sides planed flush with the slant's, the back dovetailed through the seat, a hand grip in its rear face.
// The chair faces -Y, x = 0 is its middle, the floor is z = 0.
//
// Every board is a large box cut down by half-spaces: work planes whose position and normal are expressions.
// Changing a parameter moves the planes and the whole history rebuilds. The parameters live in the `Params` part
// (assemblies hold no expressions); each board mirrors them as `Params.ExpressionSet.<name>`.

import type { V1T } from '@classcad/api-js'

/** The part of the ClassCAD script API this build uses. */
export type Api = { v1: V1T }

const DEG = Math.PI / 180
const CHERRY: [number, number, number] = [168, 96, 58] // smlibpy's #a8603a

/**
 * The parameters a maker changes. The seat length and the back height are chosen so that the chair has smlibpy's
 * 480 depth and 740 height (the back's rear top corner) with its 8 degree lean.
 */
export const MASTERS = {
  T: 19, // every board's thickness
  W_NOSE: 370, // width at the seat's nose
  W_FOOT: 330, // width at the slant's rear bottom corner: with W_NOSE, it sets the taper
  W_BASE_FRONT: 300, // the base's top face at its front edge
  SEAT_TOP: 430, // height of the seat's top face
  SEAT_LEN: 480 - 310 * Math.tan(8 * DEG), // the seat's top face, from the nose to the back's rear face (436.43)
  BACK_H: 310 / Math.cos(8 * DEG), // the back above the seat, along its rear face (313.04)
  BACK_LEAN: 8, // the back's lean from the vertical, degrees
  BASE_LENGTH: 418, // the base's underside, from the foot to its square front end
  CLEAT: 30, // a cleat's legs
  TAILS: 6, // dovetail count
  SLOPE: 1 / 6, // dovetail slope, 1 in 6
  PIN: 20, // a pin, at the back's rear face
  HALF_PIN: 20, // the half pins at the back's edges
  GRIP: 140, // hand grip length, round ends included
  GRIP_HIGH: 20,
  GRIP_DEEP: 10,
  GRIP_BELOW: 20, // from the back's top edge to the grip, along the rear face
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

const NAMES = [...Object.keys(MASTERS), ...Object.keys(DERIVED)]

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

/** The id a call created; the engine answers null when it created nothing. */
async function created(call: Promise<{ result: number | null }>) {
  const { result } = await call
  if (result === null) throw new Error('ClassCAD created nothing')
  return result
}

async function cutBoard(api: Api, part: number, name: string, planes: HalfSpace[]) {
  const corner = await created(api.v1.part.workCSys({ id: part, name: `${name}Stock`, offset: [-BIG / 2, -BIG / 2, -BIG / 2] }))
  let body = await created(api.v1.part.box({ id: part, name: `${name}Stock`, length: BIG, width: BIG, height: BIG, references: [corner] }))
  for (const [planeName, position, normal] of planes) {
    const plane = await created(api.v1.part.workPlane({ id: part, name: `${name}_${planeName}`, position: expr(position), normal: expr(normal) }))
    body = await created(api.v1.part.slice({ id: part, name: `${name}_${planeName}`, targets: [body], reference: plane }))
  }
  return body
}

async function tails(api: Api, part: number) {
  const first = await cutBoard(api, part, 'Tail', TAIL)
  const across = await created(api.v1.part.workAxis({ id: part, name: 'Across', position: [0, 0, 0], direction: [1, 0, 0] }))
  return created(api.v1.part.linearPattern({
    id: part, name: 'Tails', targets: [first],
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

/** Build the chair: a root assembly, the `Params` part, one part per board; returns their ids and volumes. */
export default async function build(api: Api) {
  const asm = await created(api.v1.assembly.create({ name: 'ZigzagChair' }))
  const params = await created(api.v1.assembly.partTemplate({ name: 'Params' }))
  await api.v1.part.expression({
    id: params,
    toCreate: [...Object.entries(MASTERS), ...Object.entries(DERIVED)].map(([name, value]) => ({ name, value })),
  })

  const parts: Record<string, number> = {}
  for (const [name, planes] of Object.entries(BOARDS)) {
    const part = await created(api.v1.assembly.partTemplate({ name }))
    await api.v1.part.expression({ id: part, toCreate: NAMES.map((n) => ({ name: n, value: `Params.ExpressionSet.${n}` })) })
    let body = await cutBoard(api, part, name, planes)
    if (name === 'Seat') {
      body = await created(api.v1.part.boolean({ id: part, name: 'Dovetails', type: 'UNION', target: body, tools: [await tails(api, part)] }))
    }
    if (name === 'Back') {
      const cut = [await tails(api, part), ...(await grip(api, part))]
      body = await created(api.v1.part.boolean({ id: part, name: 'SocketsAndGrip', type: 'SUBTRACTION', target: body, tools: cut }))
    }
    await api.v1.part.setAppearance({ target: body, color: CHERRY })
    parts[name] = part
  }

  await api.v1.assembly.setCurrentProduct({ id: asm })
  for (const [name, part] of Object.entries(parts)) {
    await api.v1.assembly.instance({ productId: part, ownerId: asm, name: name.toLowerCase() })
  }

  const volumes: Record<string, number | undefined> = {}
  for (const [name, part] of Object.entries(parts)) {
    volumes[name] = (await api.v1.part.calculateMassProperties({ id: part })).result?.volume
  }
  return { asm, parts, volumes }
}
