// Compass armchair for the browser: the same chair as compass-armchair.ts, built with smlibwasm (the SMLib kernel in
// WebAssembly, smlibpy's modeling API for JavaScript) and handed back as three.js objects.
//
// The geometry is the smlibpy example `examples/compass_armchair.py`, parametrised by the same MASTERS as the
// ClassCAD part. The chair is modelled as in CAD, z up, facing -Y with x = 0 its middle; `build` turns it into
// three's y up at the very end (x, y, z -> x, z, -y), so it faces +z and stands on y = 0, in mm.
//
// `schema` is a leva schema (`{ NAME: { value, min, max, step } }`) with one entry per master. The ranges keep every
// joint valid (a tenon in its mortise, a tail in its socket): `build` does not throw for any combination of values
// inside them, W and BOW included (a shallow bow on a wide chair is a long, flat arc, which the span must reach).
// Checked on the all-min and all-max corners, W max x BOW min, and 600 random in-range combinations. Values outside
// the ranges are not guaranteed.

import * as THREE from 'three'
import {
  Align,
  Box,
  Circle,
  faceMeshes,
  Plane,
  Polygon,
  Pos,
  Rectangle,
  Rot,
  scope,
  type Part,
  type Sketch,
} from '@classcad/smlibwasm'

const TEAK = '#9b6a3c'
const CANE_COLOR = '#e6d2a0'

/** The parameters a maker changes, in mm (angles in degrees): the ClassCAD part's MASTERS. */
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
  BOW: 10, // the back's arc bows this much between the posts; its rails are that much less deep than the posts
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

type Masters = typeof MASTERS

// [min, max, step] of each master. Tight enough that the joinery stays valid at every corner of the box.
const RANGES: Record<keyof Masters, [number, number, number]> = {
  W: [440, 520, 1],
  LEG_T: [26, 36, 1],
  FRONT_FOOT_FRONT: [-200, -165, 1],
  FRONT_FOOT_BACK: [-155, -125, 1],
  REAR_FOOT_FRONT: [125, 155, 1],
  REAR_FOOT_BACK: [165, 200, 1],
  NOTCH_Z: [380, 420, 1],
  ARM_EDGE_FRONT: [-85, -55, 1],
  ARM_EDGE_REAR: [55, 85, 1],
  SPLINE_W: [16, 24, 1],
  SPLINE_T: [14, 18, 1],
  SPLINE_Z: [450, 465, 1],
  SPLINE_IN_ARM: [30, 50, 1],
  ARM_TOP: [630, 660, 1],
  ARM_FRONT: [-245, -225, 1],
  ARM_NOSE_H: [50, 70, 1],
  ARM_BACK_Y: [270, 290, 1],
  ARM_BACK_H: [85, 105, 1],
  ARM_BEHIND: [30, 50, 1],
  SEAT_TOP: [425, 450, 1],
  RAIL_H: [55, 65, 1],
  RAIL_T: [22, 28, 1],
  CANE_T: [6, 10, 0.5],
  SEAT_FRONT: [-240, -220, 1],
  SEAT_BACK: [230, 250, 1],
  FRONT_RAIL_T: [26, 34, 1],
  REAR_RAIL_T: [36, 44, 1],
  TENON_LEN: [16, 24, 1],
  TENON_T: [8, 12, 1],
  TENON_H: [34, 44, 1],
  TENON_Y: [50, 60, 1],
  TENON_IN_RAIL: [12, 18, 1],
  BACK_TILT: [10, 20, 0.5],
  POST_W: [26, 34, 1],
  POST_D: [36, 44, 1],
  POST_Y_AT_ARM: [250, 270, 1],
  BOW: [6, 14, 0.5],
  LOW_RAIL_BOTTOM: [60, 70, 1],
  LOW_RAIL_TOP: [95, 105, 1],
  HIGH_RAIL_BOTTOM: [325, 335, 1],
  HIGH_RAIL_TOP: [360, 370, 1],
  ARM_TENON: [10, 14, 0.5],
  ARM_TENON_DEPTH: [12, 18, 1],
  ARM_TENON_MARGIN: [6, 10, 0.5],
  SLOPE: [0.12, 0.2, 0.005],
  SEAT_TAILS: [1, 2, 1],
  SEAT_PIN_EDGE: [5, 7, 0.5],
  SEAT_PIN_MID: [5, 7, 0.5],
  BACK_TAIL_SHOULDER: [10, 14, 0.5],
}

/** The leva schema: every master with its default and range. */
export const schema = Object.fromEntries(
  Object.entries(MASTERS).map(([name, value]) => {
    const [min, max, step] = RANGES[name as keyof Masters]
    return [name, { value, min, max, step }]
  }),
)

/** The masters and everything derived from them: the model's dimensions. */
type Dims = ReturnType<typeof derive>

function derive(p: Masters) {
  const X_BOARD = p.W / 2 - p.LEG_T // the side boards' inner face, on which the posts' outer face lies
  const X_POST = X_BOARD - p.POST_W // the posts' inner face
  const X_RAIL = X_BOARD - p.RAIL_T // the side rails' inner face
  const LEAN = (p.BACK_TILT * Math.PI) / 180
  const SL = Math.sin(LEAN)
  const CL = Math.cos(LEAN)
  const TL = SL / CL
  // The armrest's underside is z = U0 - K y.
  const K = (p.ARM_BACK_H - p.ARM_NOSE_H) / (p.ARM_BACK_Y - p.ARM_FRONT)
  const U0 = p.ARM_TOP - p.ARM_NOSE_H + K * p.ARM_FRONT
  const POST_Y = p.POST_Y_AT_ARM - (p.ARM_TOP - p.SEAT_TOP) * TL // the posts' axis at seat height
  // The back rails' faces, two arcs about one centre. The rails are BOW less deep than the posts: their rear face is
  // flush with the posts' rear face in the middle, their front face with the posts' front face at the ends, so that
  // nothing of the back shows beyond the posts in a side view.
  const RAIL_D = p.POST_D - p.BOW
  const R_BACK = (X_POST ** 2 + p.BOW ** 2) / (2 * p.BOW) + RAIL_D / 2 // the arc's middle line, the cane's
  const R_OUT = R_BACK + RAIL_D / 2
  const R_IN = R_BACK - RAIL_D / 2
  const ARC_Y = p.POST_D / 2 - R_OUT // the centre, in the back's frame
  // Where the posts' rear face crosses the armrest's underside, in the side view; the armrest's square rear end.
  const POST_REAR_0 = POST_Y - p.SEAT_TOP * TL + p.POST_D / 2 / CL
  const MEET_Y = (POST_REAR_0 + TL * U0) / (1 + TL * K)
  const MEET_Z = U0 - K * MEET_Y
  const ARM_END = POST_REAR_0 + ((p.ARM_TOP + MEET_Z) / 2) * TL + p.ARM_BEHIND
  // The posts' loose tenon along the post, ARM_TENON_MARGIN within the armrest at every corner of its section.
  const ARM_TENON_TOP = (p.ARM_TOP - p.ARM_TENON_MARGIN - p.SEAT_TOP - (p.ARM_TENON / 2) * SL) / CL
  const ARM_TENON_BOTTOM =
    (U0 - K * POST_Y + p.ARM_TENON_MARGIN - p.SEAT_TOP + (p.ARM_TENON / 2) * (SL - K * CL)) / (CL + K * SL)
  // The seat's tails, on the cross rails: at the side rail's outer face (end) and at its inner face (base).
  const SEAT_TAIL_END = (p.RAIL_H - 2 * p.SEAT_PIN_EDGE - (p.SEAT_TAILS - 1) * p.SEAT_PIN_MID) / p.SEAT_TAILS
  const SEAT_TAIL_BASE = SEAT_TAIL_END - 2 * p.RAIL_T * p.SLOPE
  // The back's tail, on a rail's end, centred on the post's axis: at the post's inner face and at its outer face.
  const BACK_TAIL_BASE = p.POST_D - 2 * p.BACK_TAIL_SHOULDER
  const BACK_TAIL_END = BACK_TAIL_BASE + 2 * p.POST_W * p.SLOPE
  return {
    ...p,
    X_BOARD,
    X_POST,
    X_RAIL,
    LEAN,
    K,
    U0,
    POST_Y,
    R_OUT,
    ARC_Y,
    R_IN,
    R_BACK,
    ARM_END,
    ARM_TENON_TOP,
    ARM_TENON_BOTTOM,
    SEAT_TAIL_END,
    SEAT_TAIL_BASE,
    BACK_TAIL_BASE,
    BACK_TAIL_END,
  }
}

type Point = [number, number]
type Named = { part: Part; name: string }

/** The armrest's lower face: a straight slope from the nose to the back. */
const underside = (d: Dims, y: number) => d.U0 - d.K * y

/** A board seen from the side: its profile in (y, z), extruded across the chair from x_min. */
function sidePrism(profile: Point[], xMin: number, thickness: number): Part {
  const board = Polygon(...profile).on(Plane.YZ).extrude(thickness)
  return board.translate(xMin - board.bbox().min.x, 0, 0)
}

/** From the back's own frame (upright, its origin at seat height) to the chair: leaned back. */
function tilt<T extends Part>(d: Dims, shape: T): T {
  return Pos(0, d.POST_Y, d.SEAT_TOP).mul(Rot(-d.BACK_TILT).mul(shape)) as T
}

/** The back's curve between two radii, from post to post: concave toward the sitter. The span reaches up to the
 * outer radius, past the whole band: the arc is shallow (radius ~ X_POST^2 / 2 BOW, over 3 m for a wide chair with a
 * slight bow), so a fixed height would stop short of it and leave nothing. */
function arcBand(d: Dims, rOut: number, rIn: number): Sketch {
  const band = Circle(rOut).cut(Circle(rIn)).translate(0, d.ARC_Y, 0)
  const span = Rectangle(2 * d.X_POST, rOut, { align: [Align.CENTER, Align.MIN] }).translate(0, d.ARC_Y, 0)
  return band.intersect(span)
}

/** A tail in its plane: its end at xEnd, its base at xBase, both centered on `middle`. */
function trapezoid(xEnd: number, xBase: number, middle: number, end: number, base: number): Point[] {
  return [
    [xEnd, middle - end / 2],
    [xBase, middle - base / 2],
    [xBase, middle + base / 2],
    [xEnd, middle + end / 2],
  ]
}

/** The tails at the +x end of a cross rail between y0 and y1: trapezoids on its face (x, z), through its
 * thickness, wide at the side rail's outer face; the side rail's pins are what they leave of it. */
function seatTails(d: Dims, y0: number, y1: number): Part {
  let sketch: Sketch | undefined
  for (let i = 0; i < d.SEAT_TAILS; i++) {
    const z = d.SEAT_TOP - d.RAIL_H + d.SEAT_PIN_EDGE + d.SEAT_TAIL_END / 2 + i * (d.SEAT_TAIL_END + d.SEAT_PIN_MID)
    const tail = Polygon(...trapezoid(d.X_BOARD, d.X_RAIL, z, d.SEAT_TAIL_END, d.SEAT_TAIL_BASE))
    sketch = sketch ? sketch.fuse(tail) : tail
  }
  const tails = sketch!.on(Plane.XZ).extrude(y1 - y0)
  return tails.translate(0, y0 - tails.bbox().min.y, 0)
}

/** In the back's frame: the tail at the +x end of a back rail, a trapezoid in plan (x, y) through the rail's
 * height, from the post's inner face to its outer face; it slides in along the post, and locks the rail against
 * pulling out of it. */
function backTail(d: Dims, z0: number, z1: number): Part {
  const tail = Polygon(...trapezoid(d.X_BOARD, d.X_POST, 0, d.BACK_TAIL_END, d.BACK_TAIL_BASE))
  return tail.extrude(z1 - z0).translate(0, 0, z0)
}

/** In the back's frame: the loose tenon of the +x post, along x across the post's outer face. */
function armTenon(d: Dims): Part {
  const tenon = Box(2 * d.ARM_TENON_DEPTH, d.ARM_TENON, d.ARM_TENON_TOP - d.ARM_TENON_BOTTOM, {
    align: [Align.CENTER, Align.CENTER, Align.MIN],
  })
  return tenon.translate(d.X_BOARD, 0, d.ARM_TENON_BOTTOM)
}

/** In the back's frame: the +x post, its ends cut into sockets by the rails' tails, the tenon's mortise. */
function backPost(d: Dims, rails: Point[]): Part {
  const post = Box(d.POST_W, d.POST_D, rails[1][1] - rails[0][0], { align: [Align.MIN, Align.CENTER, Align.MIN] })
  return post
    .translate(d.X_POST, 0, rails[0][0])
    .cut(rails.map(([z0, z1]) => backTail(d, z0, z1)))
    .cut(armTenon(d))
}

/** The back's rails and cane panel, in the back's own frame: arcs between the posts' inner faces, the rails' ends
 * cut into tails through the posts. */
function backFrame(d: Dims, rails: Point[]): Named[] {
  const members: Named[] = []
  for (const [z0, z1] of rails) {
    const rail = arcBand(d, d.R_OUT, d.R_IN).extrude(z1 - z0).translate(0, 0, z0)
    const tail = backTail(d, z0, z1)
    members.push({ part: rail.fuse(tail, tail.mirror(Plane.YZ)), name: 'back rail' })
  }
  const panel = arcBand(d, d.R_BACK + d.CANE_T / 2, d.R_BACK - d.CANE_T / 2).extrude(rails[1][0] - rails[0][1])
  members.push({ part: panel.translate(0, 0, rails[0][1]), name: 'back cane' })
  return members
}

/** The chair's 24 bodies, in CAD coordinates (z up, facing -Y). */
function model(d: Dims): Named[] {
  const rails: Point[] = [
    [d.LOW_RAIL_BOTTOM, d.LOW_RAIL_TOP],
    [d.HIGH_RAIL_BOTTOM, d.HIGH_RAIL_TOP],
  ]
  // A side's two boards, in (y, z). The rear board is the front one's mirror image about the seam, but for the top:
  // both boards' tops follow the armrest's sloping underside.
  const frontLeg: Point[] = [
    [d.FRONT_FOOT_FRONT, 0],
    [d.FRONT_FOOT_BACK, 0],
    [0, d.NOTCH_Z],
    [0, underside(d, 0)],
    [d.ARM_EDGE_FRONT, underside(d, d.ARM_EDGE_FRONT)],
  ]
  const rearLeg: Point[] = [
    [d.REAR_FOOT_FRONT, 0],
    [d.REAR_FOOT_BACK, 0],
    [d.ARM_EDGE_REAR, underside(d, d.ARM_EDGE_REAR)],
    [0, underside(d, 0)],
    [0, d.NOTCH_Z],
  ]
  const armProfile: Point[] = [
    [d.ARM_FRONT, underside(d, d.ARM_FRONT)],
    [d.ARM_FRONT, d.ARM_TOP],
    [d.ARM_END, d.ARM_TOP],
    [d.ARM_END, underside(d, d.ARM_END)],
  ]

  const xMid = d.X_BOARD + d.LEG_T / 2 // the middle of a board's thickness, where the spline sits
  const zTenon = d.SEAT_TOP - d.RAIL_H / 2
  const frontTails = seatTails(d, d.SEAT_FRONT, d.SEAT_FRONT + d.FRONT_RAIL_T)
  const rearTails = seatTails(d, d.SEAT_BACK - d.REAR_RAIL_T, d.SEAT_BACK)
  const parts: Named[] = []

  // The +x side as written, the -x side its mirror image.
  const spline = Box(d.SPLINE_W, d.SPLINE_T, underside(d, 0) + d.SPLINE_IN_ARM - d.SPLINE_Z, {
    align: [Align.CENTER, Align.CENTER, Align.MIN],
  }).translate(xMid, 0, d.SPLINE_Z) // through the seam and on into the armrest
  // the side rail's loose tenons, across its outer face and the board's inner face
  const tenons = [-d.TENON_Y, d.TENON_Y].map((y) =>
    Box(d.TENON_IN_RAIL + d.TENON_LEN, d.TENON_T, d.TENON_H, {
      align: [Align.MIN, Align.CENTER, Align.CENTER],
    }).translate(d.X_BOARD - d.TENON_IN_RAIL, y, zTenon),
  )
  // its half of the spline's slot, and the side rail's tenon's mortise
  const front = sidePrism(frontLeg, d.X_BOARD, d.LEG_T).cut(spline, tenons[0])
  const rear = sidePrism(rearLeg, d.X_BOARD, d.LEG_T).cut(spline, tenons[1])
  // the tenons' mortises; its pins, what the tails leave
  const rail = Box(d.RAIL_T, d.SEAT_BACK - d.SEAT_FRONT, d.RAIL_H, { align: [Align.MAX, Align.MIN, Align.MAX] })
    .translate(d.X_BOARD, d.SEAT_FRONT, d.SEAT_TOP)
    .cut(tenons)
    .cut(frontTails, rearTails)
  const loose = tilt(d, armTenon(d))
  const arm = sidePrism(armProfile, d.X_BOARD, d.LEG_T).cut(spline, loose) // the spline's and the tenon's mortises
  const side: Named[] = [
    { part: front, name: 'front leg' },
    { part: rear, name: 'rear leg' },
    { part: spline, name: 'spline' },
    { part: rail, name: 'side rail' },
    { part: tenons[0], name: 'rail tenon' },
    { part: tenons[1], name: 'rail tenon' },
    { part: arm, name: 'armrest' },
    { part: tilt(d, backPost(d, rails)), name: 'back post' },
    { part: loose, name: 'arm tenon' },
  ]
  for (const mirrored of [false, true]) {
    for (const { part, name } of side) parts.push({ part: mirrored ? part.mirror(Plane.YZ) : part, name })
  }

  // A cross rail to the side rails' outer faces, its ends cut into tails.
  const crossRail = (y0: number, t: number, tails: Part, name: string): Named => {
    const whole = Box(2 * d.X_BOARD, t, d.RAIL_H, { align: [Align.CENTER, Align.MIN, Align.MAX] }).translate(0, y0, d.SEAT_TOP)
    const end = Box(d.RAIL_T, t, d.RAIL_H, { align: [Align.MIN, Align.MIN, Align.MAX] })
      .translate(d.X_RAIL, y0, d.SEAT_TOP)
      .cut(tails)
    return { part: whole.cut(end, end.mirror(Plane.YZ)), name }
  }
  parts.push(crossRail(d.SEAT_FRONT, d.FRONT_RAIL_T, frontTails, 'front rail'))
  parts.push(crossRail(d.SEAT_BACK - d.REAR_RAIL_T, d.REAR_RAIL_T, rearTails, 'rear rail'))
  // The cane is a flat panel that touches its rails: the weave is not modelled.
  const seat = Box(2 * d.X_RAIL, d.SEAT_BACK - d.REAR_RAIL_T - d.SEAT_FRONT - d.FRONT_RAIL_T, d.CANE_T, {
    align: [Align.CENTER, Align.MIN, Align.MAX],
  })
  parts.push({ part: seat.translate(0, d.SEAT_FRONT + d.FRONT_RAIL_T, d.SEAT_TOP), name: 'seat cane' })
  for (const { part, name } of backFrame(d, rails)) parts.push({ part: tilt(d, part), name })
  return parts
}

/** One body as a three.js mesh: its faces tessellated, turned from CAD's z up to three's y up. */
function toGeometryData(part: Part) {
  const meshes = faceMeshes(part)
  const triangles = meshes.reduce((sum, m) => sum + m.triangles.length, 0)
  const position = new Float32Array(triangles * 3)
  const normal = new Float32Array(triangles * 3)
  let at = 0
  for (const m of meshes) {
    for (const index of m.triangles) {
      const [x, y, z] = [m.vertices[index * 3], m.vertices[index * 3 + 1], m.vertices[index * 3 + 2]]
      position.set([x, z, -y], at)
      if (m.normals) normal.set([m.normals[index * 3], m.normals[index * 3 + 2], -m.normals[index * 3 + 1]], at)
      at += 3
    }
  }
  // Without normals from the kernel, the caller computes them from the triangles.
  return { position, normal, hasNormals: meshes.every((m) => m.normals) }
}

/**
 * Builds the chair from the masters in `values` (missing ones take their default, extra ones are ignored). It
 * returns a Group of 24 named meshes, in mm, standing on y = 0, facing +z, x = 0 its middle.
 *
 * @param values The masters to change, keyed by the names in `schema`; a missing key takes its default.
 */
export async function build(values: Record<string, number> = {}): Promise<THREE.Object3D> {
  const p = { ...MASTERS }
  for (const name of Object.keys(p) as (keyof Masters)[]) p[name] = values[name] ?? p[name]
  const d = derive(p)
  // The kernel's bodies are freed once their triangles are copied out; only plain arrays leave the scope.
  const bodies = scope(() => model(d).map(({ part, name }) => ({ name, ...toGeometryData(part) })))
  const chair = new THREE.Group()
  chair.name = 'compass armchair'
  for (const { name, position, normal, hasNormals } of bodies) {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3))
    if (hasNormals) geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3))
    else geometry.computeVertexNormals()
    const color = name.includes('cane') ? CANE_COLOR : TEAK
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.7 }))
    mesh.name = name
    chair.add(mesh)
  }
  return chair
}
