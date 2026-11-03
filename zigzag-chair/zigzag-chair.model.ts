// Zigzag chair for the browser: the same chair as zigzag-chair.ts, built with smlibwasm (smlibpy's API on the SMLib
// kernel in WebAssembly) instead of ClassCAD, and returned as three.js meshes. A port of smlibpy's
// examples/zigzag_chair.py, its constants taken from `values`.
//
// Four cherry boards 19 mm thick, after Rietveld's 1934 Zig-Zag: the seat, the slant and the base tapered and
// mitred at 45 degrees with a glued cleat in each mitre's acute angle, the base's sides planed flush with the
// slant's, the back dovetailed through the seat, a hand grip in its rear face.
// The model is built Z up, facing -Y, x = 0 its middle, the floor z = 0; `build` turns it into three's Y up.
//
// Not ported: the Python's `check` and `assembly_order` (volume, contact and assembly assertions).

import { Align, Box, Plane, Polygon, Slot, scope, type Part, type Sketch } from '@classcad/smlibwasm'
import * as THREE from 'three'

const DEG = Math.PI / 180

/** A point of a board's side view, (y, z). */
type Point = [number, number]

/** The leva schema of one parameter. */
interface Control {
  value: number
  min: number
  max: number
  step: number
}

/**
 * The parameters a maker changes, as a leva schema: mm, and degrees for the lean. Defaults are the MASTERS of
 * zigzag-chair.ts; the seat length and the back height are chosen so that the chair has a 480 depth and 740
 * height with its 8 degree lean.
 */
export const schema = {
  T: { value: 19, min: 12, max: 30, step: 0.5 }, // every board's thickness
  W_NOSE: { value: 370, min: 300, max: 500, step: 1 }, // width at the seat's nose
  W_FOOT: { value: 330, min: 260, max: 460, step: 1 }, // width at the slant's rear bottom corner
  W_BASE_FRONT: { value: 300, min: 220, max: 420, step: 1 }, // the base's top face at its front edge
  SEAT_TOP: { value: 430, min: 380, max: 500, step: 1 }, // height of the seat's top face
  SEAT_LEN: { value: 480 - 310 * Math.tan(8 * DEG), min: 350, max: 520, step: 1 }, // nose to the back's rear face
  BACK_H: { value: 310 / Math.cos(8 * DEG), min: 200, max: 450, step: 1 }, // the back above the seat
  BACK_LEAN: { value: 8, min: 0, max: 20, step: 0.5 }, // the back's lean from the vertical, degrees
  BASE_LENGTH: { value: 418, min: 330, max: 500, step: 1 }, // the base's underside
  CLEAT: { value: 30, min: 15, max: 50, step: 1 }, // a cleat's legs
  TAILS: { value: 6, min: 2, max: 8, step: 1 }, // dovetail count
  SLOPE: { value: 1 / 6, min: 0.1, max: 0.25, step: 0.01 }, // dovetail slope, 1 in 6
  PIN: { value: 20, min: 10, max: 30, step: 1 }, // a pin, at the back's rear face
  HALF_PIN: { value: 20, min: 10, max: 30, step: 1 }, // the half pins at the back's edges
  GRIP: { value: 140, min: 80, max: 200, step: 1 }, // hand grip length, round ends included
  GRIP_HIGH: { value: 20, min: 10, max: 40, step: 1 },
  GRIP_DEEP: { value: 10, min: 4, max: 14, step: 0.5 },
  GRIP_BELOW: { value: 20, min: 10, max: 60, step: 1 }, // from the back's top edge to the grip, along the rear face
} satisfies Record<string, Control>

type Values = { [K in keyof typeof schema]: number }

/**
 * The chair, one named cherry mesh per board, in three's coordinates (Y up), standing on the floor at y = 0.
 *
 * @param values The sliders to change, keyed by the names in `schema`; a missing key takes its default.
 */
export async function build(values: Record<string, number>): Promise<THREE.Object3D> {
  const v: Values = { ...defaults(), ...values }
  const { T, W_NOSE, W_FOOT, W_BASE_FRONT, SEAT_TOP, BASE_LENGTH, CLEAT } = v
  const { TAILS, SLOPE, GRIP, GRIP_HIGH, GRIP_DEEP, GRIP_BELOW } = v
  const BIG = 3000

  // Derived: the depth and height come from the seat length, the back height and its lean.
  const S2 = Math.sqrt(2)
  const MITRE = Math.tan((45 / 2) * DEG) // both mitres bisect the 45 degree slant: 22.5 degrees to the floor
  const LEAN = v.BACK_LEAN * DEG
  const HEIGHT = SEAT_TOP + v.BACK_H * Math.cos(LEAN) // the back's rear top corner
  const DEPTH = v.SEAT_LEN + v.BACK_H * Math.sin(LEAN)
  const Y_NOSE = -DEPTH / 2
  const UP = [0, Math.sin(LEAN), Math.cos(LEAN)] as const // along the back, upward
  const ACROSS = [0, Math.cos(LEAN), -Math.sin(LEAN)] as const // through the back, front face to rear face

  // The side view, (y, z). The slant's front face runs from the nose down backward at 45 degrees, its rear face
  // is T * sqrt(2) behind it along y.
  const NOSE: Point = [Y_NOSE, SEAT_TOP]
  const SEAT_INNER: Point = [Y_NOSE + T / MITRE, SEAT_TOP - T] // the top mitre's inner corner
  const FOOT: Point = [Y_NOSE + SEAT_TOP + T * S2, 0] // the bottom mitre's outer corner, on the floor
  const BASE_INNER: Point = [Y_NOSE + SEAT_TOP - T, T] // the base's top on the slant's front face
  const BASE_FRONT = FOOT[0] - BASE_LENGTH
  const REAR_TOP: Point = [Y_NOSE + DEPTH, HEIGHT] // the back's rear face at its top
  const FRONT_TOP: Point = [REAR_TOP[0] - T * ACROSS[1], REAR_TOP[1] - T * ACROSS[2]] // square to its faces
  const SEAT_BOTTOM = SEAT_TOP - T // the back ends flush with the seat's underside

  /** y of the back's rear face at height z; the seat's rear end lies on it. */
  const rear = (z: number) => REAR_TOP[0] - (HEIGHT - z) * Math.tan(LEAN)
  /** y of the back's front face at height z. */
  const front = (z: number) => rear(z) - T / Math.cos(LEAN)

  const SEAT: Point[] = [NOSE, [front(SEAT_TOP), SEAT_TOP], [front(SEAT_BOTTOM), SEAT_BOTTOM], SEAT_INNER]
  const SLANT_BOARD: Point[] = [NOSE, SEAT_INNER, FOOT, BASE_INNER]
  const BASE: Point[] = [FOOT, BASE_INNER, [BASE_FRONT, T], [BASE_FRONT, 0]]
  const BACK: Point[] = [[rear(SEAT_BOTTOM), SEAT_BOTTOM], REAR_TOP, FRONT_TOP, [front(SEAT_BOTTOM), SEAT_BOTTOM]]
  // The cleats: right isosceles, one leg on the horizontal board, a vertical face, the hypotenuse on the slant.
  const TOP_CLEAT: Point[] = [SEAT_INNER, [SEAT_INNER[0] + CLEAT, SEAT_BOTTOM], [SEAT_INNER[0] + CLEAT, SEAT_BOTTOM - CLEAT]]
  const FOOT_CLEAT: Point[] = [BASE_INNER, [BASE_INNER[0] - CLEAT, T], [BASE_INNER[0] - CLEAT, T + CLEAT]]

  // The widths. The seat and the slant narrow at one rate along their faces, measured from the nose, so that
  // their mitre is flush; the base is cut square to its top face's widths and planed flush with the slant's.
  const alongSlant = (y: number, z: number) => ((y - Y_NOSE) - (z - SEAT_TOP)) / S2 // from the nose, downward
  const RATE = (W_NOSE - W_FOOT) / 2 / alongSlant(...FOOT) // how much each side comes in, a millimeter along a board
  const seatHalf = (y: number) => W_NOSE / 2 - RATE * (y - Y_NOSE)
  const slantHalf = (y: number, z: number) => W_NOSE / 2 - RATE * alongSlant(y, z)

  // The base's side: x = W_FOOT / 2 + BASE_Y (y - FOOT_y) + BASE_Z z, through the foot, through the mitre's inner
  // corner at the slant's width there, and W_BASE_FRONT wide on the top face's front edge.
  const dyInner = BASE_INNER[0] - FOOT[0]
  const dyFront = BASE_FRONT - FOOT[0]
  const atInner = slantHalf(...BASE_INNER) - W_FOOT / 2
  const atFront = W_BASE_FRONT / 2 - W_FOOT / 2
  const BASE_Y = (atInner - atFront) / (dyInner - dyFront)
  const BASE_Z = (atInner - BASE_Y * dyInner) / T

  // The back is not tapered: as wide as the seat at its front face, at the seat's mid-thickness.
  const W_BACK = 2 * seatHalf(front(SEAT_TOP - T / 2))
  // The tails at the back's rear face (widest) and at its front face, where the pins are 2 T / 6 wider.
  // Narrow boards with many tails and a steep slope leave no room for the pins asked for: a tail would end up
  // narrower than TAIL_MIN at its front face, or even negative. The pins and half pins then shrink together, just
  // enough to give every tail at least TAIL_MIN at its front, so any combination of the sliders builds.
  const TAIL_MIN = 2
  const pinRoom = W_BACK - TAILS * (TAIL_MIN + 2 * T * SLOPE) // what the pins and half pins may take in all
  const pinWant = 2 * v.HALF_PIN + (TAILS - 1) * v.PIN
  const squeeze = Math.min(1, pinRoom / pinWant)
  const PIN = v.PIN * squeeze
  const HALF_PIN = v.HALF_PIN * squeeze
  const TAIL_REAR = (W_BACK - 2 * HALF_PIN - (TAILS - 1) * PIN) / TAILS
  const TAIL_FRONT = TAIL_REAR - 2 * T * SLOPE

  /** A board seen from the side: its profile in (y, z), extruded across the chair, centered on x = 0. */
  const sidePrism = (profile: Point[], width = BIG) => {
    const board = Polygon(...profile).on(Plane.YZ).extrude(width)
    return board.translate(-width / 2 - board.bbox().min.x, 0, 0)
  }

  /** The body between a board's two side planes: a trapezoid in `plane`, half-width half(s) at s along the board. */
  const sides = (plane: Plane, half: (s: number) => number) => {
    const s0 = -BIG / 4
    const s1 = BIG / 4
    const outline = Polygon([-half(s0), s0], [half(s0), s0], [half(s1), s1], [-half(s1), s1])
    return outline.on(plane.offset(-BIG / 2)).extrude(BIG)
  }

  /** The body between the base's two planed sides, which lean in toward the floor. */
  const baseSides = () => {
    let body = Box(BIG, BIG, BIG)
    for (const side of [1, -1]) {
      body = body.split(new Plane([side * W_FOOT / 2, FOOT[0], 0], null, [side, -BASE_Y, -BASE_Z]), 'below')
    }
    return body
  }

  /** The back's own frame: x across the chair, y through the back (front face 0, rear face T); its origin on the
   * front face at the seat's underside, `along` it upward. */
  const backPlane = (t = 0, along = 0, normal: readonly number[] = UP) => {
    const origin = [0, front(SEAT_BOTTOM) + t * ACROSS[1] + along * UP[1], SEAT_BOTTOM + t * ACROSS[2] + along * UP[2]]
    return new Plane(origin, [1, 0, 0], normal)
  }

  /** The seat's tails: trapezoids square to the back, wide at its rear face, as prisms along the back, cut to the
   * seat's thickness. The back's pins are what they leave of the joint. */
  const tails = () => {
    let sketch: Sketch | null = null
    for (let i = 0; i < TAILS; i++) {
      const x = -W_BACK / 2 + HALF_PIN + TAIL_REAR / 2 + i * (TAIL_REAR + PIN)
      const tail = Polygon([x - TAIL_FRONT / 2, 0], [x + TAIL_FRONT / 2, 0], [x + TAIL_REAR / 2, T], [x - TAIL_REAR / 2, T])
      sketch = sketch === null ? tail : sketch.fuse(tail)
    }
    const prisms = sketch!.on(backPlane(0, -T)).extrude(4 * T)
    const slab = Box(BIG, BIG, T, { align: [Align.CENTER, Align.CENTER, Align.MIN] }).translate(0, 0, SEAT_BOTTOM)
    return prisms.intersect(slab)
  }

  /** The hand grip's pocket, a slot with round ends sunk square into the back's rear face. */
  const grip = () => {
    // Where its middle is along the back's rear face, from the seat's underside in the back's frame.
    const origin = backPlane(T).origin
    const top = (REAR_TOP[0] - origin.y) * UP[1] + (REAR_TOP[1] - origin.z) * UP[2]
    const along = top - GRIP_BELOW - GRIP_HIGH / 2
    return Slot(GRIP, GRIP_HIGH).on(backPlane(T - GRIP_DEEP, along, ACROSS)).extrude(GRIP_DEEP)
  }

  // The kernel's bodies are freed once their triangles are copied out; only the geometries leave the scope.
  const meshes = scope(() => {
    // The seat's sides are vertical; the slant's contain its normal (0, 1, 1).
    const seatSides = sides(new Plane([0, Y_NOSE, 0], [1, 0, 0], [0, 0, 1]), (s) => seatHalf(Y_NOSE + s))
    const slantSides = sides(new Plane([0, ...NOSE], [1, 0, 0], [0, 1, 1]), (s) => W_NOSE / 2 - RATE * s)
    const baseSidesBody = baseSides()

    const dovetails = tails()
    const seat = sidePrism(SEAT).intersect(seatSides).fuse(dovetails)
    const back = sidePrism(BACK, W_BACK).cut(dovetails).cut(grip())
    // A cleat is flush with the narrower board's sides: each half of it takes that board's side planes.
    const boards: [string, Part][] = [
      ['seat', seat],
      ['back', back],
      ['slant', sidePrism(SLANT_BOARD).intersect(slantSides)],
      ['base', sidePrism(BASE).intersect(baseSidesBody)],
      ['seat cleat', sidePrism(TOP_CLEAT).intersect(seatSides).intersect(slantSides)],
      ['foot cleat', sidePrism(FOOT_CLEAT).intersect(baseSidesBody).intersect(slantSides)],
    ]
    return boards.map(([name, part]) => ({ name, geometry: geometryOf(part) }))
  })

  const chair = new THREE.Group()
  chair.name = 'zigzag-chair'
  const cherry = new THREE.MeshStandardMaterial({ color: '#a8603a', roughness: 0.6, side: THREE.DoubleSide })
  for (const { name, geometry } of meshes) {
    const mesh = new THREE.Mesh(geometry, cherry)
    mesh.name = name
    chair.add(mesh)
  }
  return chair
}

/** The schema's defaults, by name. */
function defaults(): Values {
  return Object.fromEntries(Object.entries(schema).map(([name, { value }]) => [name, value])) as Values
}

/** A part's triangles as a flat shaded geometry, its Z up turned into three's Y up: (x, y, z) -> (x, z, -y). */
function geometryOf(part: Part): THREE.BufferGeometry {
  const { vertices, triangles } = part.mesh()
  const positions = new Float32Array(triangles.length * 3)
  for (let i = 0; i < triangles.length; i++) {
    const at = triangles[i] * 3
    positions.set([vertices[at], vertices[at + 2], -vertices[at + 1]], i * 3)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  return geometry
}
