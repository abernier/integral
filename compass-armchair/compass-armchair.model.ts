// Compass armchair for the browser: the same chair as compass-armchair.ts, built with smlibwasm (the SMLib kernel in
// WebAssembly, smlibpy's modeling API for JavaScript) and handed back as three.js objects.
//
// The geometry is the smlibpy example `examples/compass_armchair.py`, parametrised by the same MASTERS as the
// ClassCAD part. The chair is modelled as in CAD, z up, facing -Y with x = 0 its middle; `build` turns it into
// three's y up at the very end (x, y, z -> x, z, -y), so it faces +z and stands on y = 0, in mm.
//
// `schema` is the masters (compass-armchair.masters.ts), one Control per master. Their ranges keep every joint
// valid (a tenon in its mortise, a tail in its socket): `build` does not throw for any combination of values inside
// them, W and BOW included (a shallow bow on a wide chair is a long, flat arc, which the span must reach). Checked on
// the all-min and all-max corners, W max x BOW min, and 600 random in-range combinations (a back rail's round the
// kernel refuses is a chamfer: breakRing). Values outside the ranges are not guaranteed.

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
  type Edge,
  type Part,
  type Sketch,
} from '@classcad/smlibwasm'
import type { Control } from '../configurator/src/models.ts'
import { MASTERS, edgeBreak } from './compass-armchair.masters.ts'

const TEAK = '#9b6a3c'
const CANE_COLOR = '#e6d2a0'

/** The configurator's controls: every master with its default, range, step and meaning. */
export const schema: Record<keyof typeof MASTERS, Control> = MASTERS

/** The masters' values, by name. */
type Masters = { [K in keyof typeof MASTERS]: number }

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
  // The back rails' faces, two arcs about one centre on the back's axis, flush with the posts' faces at their inner
  // face: the rear one through the posts' rear inner corners and BOW behind them in the middle, the front one through
  // their front inner corners. The rail is a little less deep in the middle than the posts (R_OUT - R_IN), its ends
  // exactly as deep.
  const R_OUT = (X_POST ** 2 + p.BOW ** 2) / (2 * p.BOW)
  const ARC_Y = p.POST_D / 2 + p.BOW - R_OUT // the centre, in the back's frame
  const R_IN = Math.hypot(X_POST, ARC_Y + p.POST_D / 2)
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
  // The side rail tenons' middle height, in the middle of the wood the cane groove leaves under it.
  const Z_TENON = p.SEAT_TOP - (p.RAIL_H + p.GROOVE_D) / 2
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
    ARM_END,
    ARM_TENON_TOP,
    ARM_TENON_BOTTOM,
    SEAT_TAIL_END,
    SEAT_TAIL_BASE,
    BACK_TAIL_BASE,
    BACK_TAIL_END,
    Z_TENON,
  }
}

type Point = [number, number]
type Span = [number, number] // [z0, z1]: a rail's extent along the posts, in the back's frame
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

/**
 * The planes a body's straight edges are told apart by: an edge lies on the two faces whose planes hold both its ends.
 * Each plane is a point on it and its normal, by the face's name.
 */
type Planes = Record<string, { at: [number, number, number]; normal: [number, number, number] }>

/** The names of the planes of `planes` that hold both ends of `edge`. */
function facesOf(edge: Edge, planes: Planes) {
  const on = ({ at, normal }: Planes[string], point: { x: number; y: number; z: number }) =>
    Math.abs((point.x - at[0]) * normal[0] + (point.y - at[1]) * normal[1] + (point.z - at[2]) * normal[2]) < 1e-6
  return Object.keys(planes).filter((name) => on(planes[name], edge.start) && on(planes[name], edge.end))
}

/** A box's six faces, by name: `-x` and `+x` its faces square to x at its least and its greatest x, and so on. */
function boxPlanes(part: Part): Planes {
  const { min, max } = part.bbox()
  const planes: Planes = {}
  for (const [axis, i] of [['x', 0], ['y', 1], ['z', 2]] as const) {
    const normal: [number, number, number] = [0, 0, 0]
    normal[i] = 1
    planes[`-${axis}`] = { at: [min.x, min.y, min.z], normal }
    planes[`+${axis}`] = { at: [max.x, max.y, max.z], normal }
  }
  return planes
}

/** A side-view prism's faces (`sidePrism`): its profile's sides by their index (side i from point i to point i + 1),
 * `in` and `out` its faces at x_min and x_min + thickness. */
function prismPlanes(profile: Point[], xMin: number, thickness: number): Planes {
  const planes: Planes = { in: { at: [xMin, 0, 0], normal: [1, 0, 0] }, out: { at: [xMin + thickness, 0, 0], normal: [1, 0, 0] } }
  profile.forEach(([y, z], i) => {
    const [y1, z1] = profile[(i + 1) % profile.length]
    const length = Math.hypot(y1 - y, z1 - z)
    planes[i] = { at: [0, y, z], normal: [0, -(z1 - z) / length, (y1 - y) / length] }
  })
  return planes
}

/**
 * Round the straight edges of `part` that `radius` gives a radius, from the names of the two faces each lies on
 * (`planes`); 0 or undefined leaves an edge sharp. The rounds are made by hand on the cut parts: EDGE_BREAK and
 * ARM_NOSE_R are 0 in the CAM files' geometry (their masters' `cam`), which this leaves square.
 */
function round(part: Part, planes: Planes, radius: (faces: string[]) => number | undefined): Part {
  const edges: Edge[] = []
  const radii: number[] = []
  for (const edge of part.edges()) {
    const r = edge.geomType === 'line' ? radius(facesOf(edge, planes)) : undefined
    if (!r) continue
    edges.push(edge)
    radii.push(r)
  }
  return edges.length ? part.fillet(edges, radii) : part
}

/**
 * Every straight edge broken at EDGE_BREAK, but those along both faces of a pair of `sharp`: EDGE_BREAK is the one
 * break of the assembled chair's outside arrises, as if broken after glue-up and flush-planing, continuous across its
 * members. Sharp are the edges along a flush glued seam, on both members (the joint one surface but for a hairline, no
 * V), and those no one sees or touches once assembled: between two faces glued over their whole extent, in an inside
 * corner, along a dovetail's joint line, or under the cane's lap.
 */
const breakAllBut = (d: Dims, sharp: [string, string][]) => (faces: string[]) =>
  sharp.some(([a, b]) => faces.includes(a) && faces.includes(b)) ? undefined : d.EDGE_BREAK

/**
 * The cane groove's outlines, in the plane of a frame: a rectangle around the opening (u from -halfU to halfU, v from
 * v0 to v1), `o` out from its edges, its corners rounded on the groove's middle radius `o` out as well. At o =
 * GROOVE_INSET it is the groove's middle line; GROOVE_W/2 less, its inner edge; GROOVE_W/2 more, its outer edge.
 */
function outline(d: Dims, halfU: number, v0: number, v1: number, o: number): Sketch {
  const r = d.GROOVE_R + o - d.GROOVE_INSET
  return Rectangle(2 * (halfU + o), v1 - v0 + 2 * o, { fillet: r }).translate(0, (v0 + v1) / 2, 0)
}

/** The band between two of the groove's outlines (o0 inside o1), or the whole of outline o1 when o0 is null. */
const band = (d: Dims, halfU: number, v0: number, v1: number, o0: number | null, o1: number) =>
  o0 === null ? outline(d, halfU, v0, v1, o1) : outline(d, halfU, v0, v1, o1).cut(outline(d, halfU, v0, v1, o0))

/** In the seat: a band of the groove's outlines around the cane's opening, through the rails' height and above. */
function seatBand(d: Dims, o0: number | null, o1: number): Part {
  const front = d.SEAT_FRONT + d.FRONT_RAIL_T
  const z0 = d.SEAT_TOP - d.RAIL_H
  return band(d, d.X_RAIL, front, d.SEAT_BACK - d.REAR_RAIL_T, o0, o1)
    .extrude(d.RAIL_H + d.CANE_SHEET + 1)
    .translate(0, 0, z0)
}

/** In the seat: the layer between `d0` and `d1` below the rails' top face (above it where negative). */
function seatLayer(d: Dims, d0: number, d1: number): Part {
  return Box(2 * d.W, 2 * d.W, d1 - d0, { align: [Align.CENTER, Align.CENTER, Align.MAX] }).translate(0, 0, d.SEAT_TOP - d0)
}

/** In the back's frame: a band of the groove's outlines around the cane's opening, through the back's depth. */
function backBand(d: Dims, o0: number | null, o1: number): Part {
  const prism = band(d, d.X_POST, d.LOW_RAIL_TOP, d.HIGH_RAIL_BOTTOM, o0, o1).on(Plane.XZ).extrude(4 * d.POST_D)
  return prism.translate(0, -2 * d.POST_D - prism.bbox().min.y, 0)
}

/**
 * In the back's frame: the layer between `d0` and `d1` behind the face the cane lies on, its front (in front of it
 * where negative): the rails' arc between the posts, the posts' front faces on either side.
 */
function backLayer(d: Dims, d0: number, d1: number): Part {
  const z0 = d.LOW_RAIL_BOTTOM - 1
  const z1 = d.HIGH_RAIL_TOP + 1
  const rails = arcBand(d, d.R_IN + d1, d.R_IN + d0).extrude(z1 - z0).translate(0, 0, z0)
  const post = Box(d.POST_W, d1 - d0, z1 - z0, { align: [Align.MIN, Align.MIN, Align.MIN] }).translate(d.X_POST, -d.POST_D / 2 + d0, z0)
  return rails.fuse(post, post.mirror(Plane.YZ))
}

/**
 * The cane of an opening, pressed into a groove around it and held there by a glued spline: the groove (cut into the
 * frame), the spline in its outer half, and the cane: its `panel` across the opening, its sheet lapping the frame out
 * to the groove's middle and down the groove's inner half. `layer(d0, d1)` is the frame's depth between d0 and d1
 * below the face the cane lies on, `ring(o0, o1)` a band of the groove's outlines (`outline`) through it.
 */
function caning(d: Dims, panel: Part, layer: (d0: number, d1: number) => Part, ring: (o0: number | null, o1: number) => Part) {
  const inner = d.GROOVE_INSET - d.GROOVE_W / 2
  const outer = d.GROOVE_INSET + d.GROOVE_W / 2
  const groove = ring(inner, outer).intersect(layer(-1, d.GROOVE_D))
  const spline = ring(d.GROOVE_INSET, outer).intersect(layer(-d.CANE_SHEET, d.GROOVE_D))
  const lap = ring(null, d.GROOVE_INSET).intersect(layer(-d.CANE_SHEET, 0))
  const cane = panel.fuse(lap, ring(inner, d.GROOVE_INSET).intersect(layer(0, d.GROOVE_D)))
  return { groove, spline, cane }
}

/** The tails at the +x end of a cross rail between y0 and y1: trapezoids on its face (x, z), through its
 * thickness, wide at the side rail's outer face; the side rail's pins are what they leave of it. */
function seatTails(d: Dims, y0: number, y1: number): Part {
  const sketches: Sketch[] = []
  for (let i = 0; i < d.SEAT_TAILS; i++) {
    const z = d.SEAT_TOP - d.RAIL_H + d.SEAT_PIN_EDGE + d.SEAT_TAIL_END / 2 + i * (d.SEAT_TAIL_END + d.SEAT_PIN_MID)
    sketches.push(Polygon(...trapezoid(d.X_BOARD, d.X_RAIL, z, d.SEAT_TAIL_END, d.SEAT_TAIL_BASE)))
  }
  // SEAT_TAILS is at least 1, so there is always a first tail to fuse the others onto.
  const tails = sketches.reduce((a, b) => a.fuse(b)).on(Plane.XZ).extrude(y1 - y0)
  return tails.translate(0, y0 - tails.bbox().min.y, 0)
}

/** In the back's frame: the tail at the +x end of a back rail, a trapezoid in plan (x, y) through the rail's
 * height, from the post's inner face to its outer face; it slides in along the post, and locks the rail against
 * pulling out of it. `into`: on, past the post's inner face, into the rail it is fused onto. */
function backTail(d: Dims, z0: number, z1: number, into = 0): Part {
  const base = d.BACK_TAIL_BASE - 2 * into * d.SLOPE // on its flanks, `into` past the post's inner face
  const tail = Polygon(...trapezoid(d.X_BOARD, d.X_POST - into, 0, d.BACK_TAIL_END, base))
  return tail.extrude(z1 - z0).translate(0, 0, z0)
}

/** In the back's frame: the loose tenon of the +x post, along x across the post's outer face. */
function armTenon(d: Dims): Part {
  const tenon = Box(2 * d.ARM_TENON_DEPTH, d.ARM_TENON, d.ARM_TENON_TOP - d.ARM_TENON_BOTTOM, {
    align: [Align.CENTER, Align.CENTER, Align.MIN],
  })
  return tenon.translate(d.X_BOARD, 0, d.ARM_TENON_BOTTOM)
}

/**
 * The wood a round of radius r takes off a square arris, in the plane square to it: the r x r square in the corner
 * at `corner`, the faces running on toward `toward` (+1 or -1 along each axis), less the round's circle.
 */
function arrisSliver(r: number, [u, v]: Point, [su, sv]: Point): Sketch {
  return Rectangle(r, r)
    .translate(u + (su * r) / 2, v + (sv * r) / 2, 0)
    .cut(Circle(r).translate(u + su * r, v + sv * r, 0))
}

/**
 * In the back's frame: the +x post, its arrises broken as if after glue-up, then its ends cut into sockets by the
 * rails' tails, the tenon's mortise, the cane's groove. Sharp are its front inner arris (the cane laps it, the rails'
 * fronts are flush with it at their dovetails) and its inner face's arrises where the rails' ends cover it: its ends'
 * (flush with the rails' tops and bottoms, the rails as deep as the post there) and its rear one over the rails'
 * height (flush with their rear faces); a round there would be a notch in the rail's continuous round. Its rear one
 * between the rails, in the opening, is broken: the round runs from rail to rail.
 */
function backPost(d: Dims, rails: Span[], groove: Part): Part {
  const post = Box(d.POST_W, d.POST_D, rails[1][1] - rails[0][0], { align: [Align.MIN, Align.CENTER, Align.MIN] })
  const stock = post.translate(d.X_POST, 0, rails[0][0])
  const glued: [string, string][] = [['-x', '-y'], ['-x', '+y'], ['-x', '-z'], ['-x', '+z']]
  const rounded = round(stock, boxPlanes(stock), breakAllBut(d, glued))
  const opening = () =>
    arrisSliver(d.EDGE_BREAK, [d.X_POST, d.POST_D / 2], [1, -1]).extrude(rails[1][0] - rails[0][1]).translate(0, 0, rails[0][1])
  return (d.EDGE_BREAK ? rounded.cut(opening()) : rounded)
    .cut(rails.map(([z0, z1]) => backTail(d, z0, z1)))
    .cut(armTenon(d), groove)
}

/**
 * A back rail's ring with its edges rounded at `radius`; chamfered at it instead when the round fails, as the ClassCAD
 * part does (scripts' `fillet`). The ring's circles are metres across on a shallow bow: smlibwasm checks a round by the
 * volume it takes off, a bound its arcs of that size can overshoot for some widths and bows (W 473, POST_D 38, BOW
 * 9), though the round is a few millimetres by hand either way. Sharp, with a warning, if the chamfer fails too.
 */
function breakRing(ring: Part, edges: Edge[], radius: number): Part {
  try {
    return ring.fillet(edges, radius)
  } catch (error) {
    console.warn(`back rail: ${(error as Error).message}; chamfered at ${radius} instead`)
  }
  try {
    return ring.chamfer(edges, radius)
  } catch (error) {
    console.warn(`back rail: ${(error as Error).message}; left sharp`)
    return ring
  }
}

/**
 * The back's rails, in the back's own frame: arcs between the posts' inner faces, their arcs broken but the front one
 * on the opening's side, which the cane laps (their ends are glued), their ends cut into tails through the posts, the
 * cane's groove in their front face.
 */
function backRails(d: Dims, rails: Span[], groove: Part): Named[] {
  return rails.map(([z0, z1], i) => {
    // Rounded as a whole ring, then cut to the posts: a round that stops on the end face, at a slant to it, is a
    // corner the kernel cannot build.
    const ring = Circle(d.R_OUT).cut(Circle(d.R_IN)).translate(0, d.ARC_Y, 0).extrude(z1 - z0).translate(0, 0, z0)
    const lapped = i === 0 ? z1 : z0
    const broken = ring.edges().filter((edge) => !(Math.abs(edge.start.z - lapped) < 1e-6 && Math.abs(edge.radius - d.R_IN) < 1e-6))
    const rounded = d.EDGE_BREAK > 0 ? breakRing(ring, broken, d.EDGE_BREAK) : ring
    const rail = rounded.intersect(arcBand(d, d.R_OUT + 1, d.R_IN - 1).extrude(z1 - z0 + 2).translate(0, 0, z0 - 1))
    // The tails reach into the rail: its end face, as deep as the post, flush with its faces, and a tail's base on it
    // make a fuse the kernel fails for some values (W 471, LEG_T 26, POST_W 31, POST_D 41, BOW 9, BACK_TILT 19.5).
    // Its end through the post rounded as the post's own arris there, at the post's end (the low rail's bottom, the
    // high rail's top): the post's round runs on across the tail, which would stand proud of it square.
    const end = i === 0 ? z0 : z1
    const tailPlanes: Planes = { end: { at: [d.X_BOARD, 0, end], normal: [0, 0, 1] }, out: { at: [d.X_BOARD, 0, end], normal: [1, 0, 0] } }
    const tail = round(backTail(d, z0, z1, 1), tailPlanes, (faces) => (faces.length === 2 ? d.EDGE_BREAK : undefined))
    return { part: rail.fuse(tail, tail.mirror(Plane.YZ)).cut(groove), name: 'back rail' }
  })
}

/** The chair's 26 bodies, in CAD coordinates (z up, facing -Y). */
function model(d: Dims): Named[] {
  const rails: Span[] = [
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
  const frontTails = seatTails(d, d.SEAT_FRONT, d.SEAT_FRONT + d.FRONT_RAIL_T)
  const rearTails = seatTails(d, d.SEAT_BACK - d.REAR_RAIL_T, d.SEAT_BACK)
  const parts: Named[] = []

  // The cane lies on the seat's top and on the back's front, the sitter's side, as on the chair it follows; each panel
  // in its opening, just under that face. The back's in the back's frame.
  const seatPanel = Box(2 * d.X_RAIL, d.SEAT_BACK - d.REAR_RAIL_T - d.SEAT_FRONT - d.FRONT_RAIL_T, d.CANE_T, {
    align: [Align.CENTER, Align.MIN, Align.MAX],
  }).translate(0, d.SEAT_FRONT + d.FRONT_RAIL_T, d.SEAT_TOP)
  const seat = caning(d, seatPanel, (d0, d1) => seatLayer(d, d0, d1), (o0, o1) => seatBand(d, o0, o1))
  const backPanel = arcBand(d, d.R_IN + d.CANE_T, d.R_IN)
    .extrude(rails[1][0] - rails[0][1])
    .translate(0, 0, rails[0][1])
  const back = caning(d, backPanel, (d0, d1) => backLayer(d, d0, d1), (o0, o1) => backBand(d, o0, o1))

  // The +x side as written, the -x side its mirror image.
  const spline = Box(d.SPLINE_W, d.SPLINE_T, underside(d, 0) + d.SPLINE_IN_ARM - d.SPLINE_Z, {
    align: [Align.CENTER, Align.CENTER, Align.MIN],
  }).translate(xMid, 0, d.SPLINE_Z) // through the seam and on into the armrest
  // the side rail's loose tenons, across its outer face and the board's inner face
  const tenons = [-d.TENON_Y, d.TENON_Y].map((y) =>
    Box(d.TENON_IN_RAIL + d.TENON_LEN, d.TENON_T, d.TENON_H, {
      align: [Align.MIN, Align.CENTER, Align.CENTER],
    }).translate(d.X_BOARD - d.TENON_IN_RAIL, y, d.Z_TENON),
  )
  // Every board's arrises are broken before its joints are cut, but those on the seam and on the top: both glued flush
  // over their whole extent, to the other board and under the armrest, the joint one surface but for a hairline (the
  // seam's at the notch too, in the arch's inside corner). Its half of the spline's slot, the side rail's tenon's
  // mortise.
  const leg = (profile: Point[], seam: string, top: string) =>
    round(sidePrism(profile, d.X_BOARD, d.LEG_T), prismPlanes(profile, d.X_BOARD, d.LEG_T), (faces) =>
      faces.includes(seam) || faces.includes(top) ? undefined : d.EDGE_BREAK,
    )
  const front = leg(frontLeg, '2', '3').cut(spline, tenons[0])
  const rear = leg(rearLeg, '3', '2').cut(spline, tenons[1])
  // Broken but its inner face's top arris, which the cane laps, and its ends', on the dovetails' joint lines; its inner
  // face's bottom arris only between the cross rails, in the opening: under them it is flush with their bottoms, and a
  // round there would be a notch in their continuous round across the seat's front and back. The tenons' mortises,
  // its pins (what the tails leave), the cane's groove.
  const stock = Box(d.RAIL_T, d.SEAT_BACK - d.SEAT_FRONT, d.RAIL_H, { align: [Align.MAX, Align.MIN, Align.MAX] }).translate(
    d.X_BOARD,
    d.SEAT_FRONT,
    d.SEAT_TOP,
  )
  const glued: [string, string][] = [['-x', '+z'], ['-x', '-y'], ['-x', '+y'], ['-x', '-z']]
  const railRounded = round(stock, boxPlanes(stock), breakAllBut(d, glued))
  const opening = () => {
    const y0 = d.SEAT_FRONT + d.FRONT_RAIL_T
    const sliver = arrisSliver(d.EDGE_BREAK, [d.X_RAIL, d.SEAT_TOP - d.RAIL_H], [1, 1]).on(Plane.XZ).extrude(d.SEAT_BACK - d.REAR_RAIL_T - y0)
    return sliver.translate(0, y0 - sliver.bbox().min.y, 0)
  }
  const rail = (d.EDGE_BREAK ? railRounded.cut(opening()) : railRounded)
    .cut(tenons)
    .cut(frontTails, rearTails)
    .cut(seat.groove)
  const loose = tilt(d, armTenon(d))
  // The nose's four edges (side 0) rounded at ARM_NOSE_R, every other arris broken, but the underside's over the
  // boards' tops, glued flush on them (sharp on the boards' too): before and behind the boards they are broken and run
  // on into the round of the boards' edges. Made in three lengths, each rounded, then fused: before the boards, over
  // them, behind them; the faces between two lengths, inside the armrest, sharp. The spline's and the tenon's mortises.
  const armLength = (y0: number, y1: number, nose: boolean, end: boolean, glued: boolean) => {
    const profile: Point[] = [
      [y0, underside(d, y0)],
      [y0, d.ARM_TOP],
      [y1, d.ARM_TOP],
      [y1, underside(d, y1)],
    ]
    const radius = (faces: string[]) => {
      if (faces.includes('0')) return nose ? d.ARM_NOSE_R : undefined
      if (faces.includes('2')) return end ? d.EDGE_BREAK : undefined
      return faces.includes('3') && glued ? undefined : d.EDGE_BREAK
    }
    return round(sidePrism(profile, d.X_BOARD, d.LEG_T), prismPlanes(profile, d.X_BOARD, d.LEG_T), radius)
  }
  // Without EDGE_BREAK, one length: its nose's rounds alone.
  const armStock = d.EDGE_BREAK
    ? armLength(d.ARM_FRONT, d.ARM_EDGE_FRONT, true, false, false).fuse(
        armLength(d.ARM_EDGE_FRONT, d.ARM_EDGE_REAR, false, false, true),
        armLength(d.ARM_EDGE_REAR, d.ARM_END, false, true, false),
      )
    : armLength(d.ARM_FRONT, d.ARM_END, true, true, false)
  const arm = armStock.cut(spline, loose)
  const side: Named[] = [
    { part: front, name: 'front leg' },
    { part: rear, name: 'rear leg' },
    { part: spline, name: 'spline' },
    { part: rail, name: 'side rail' },
    { part: tenons[0], name: 'rail tenon' },
    { part: tenons[1], name: 'rail tenon' },
    { part: arm, name: 'armrest' },
    { part: tilt(d, backPost(d, rails, back.groove)), name: 'back post' },
    { part: loose, name: 'arm tenon' },
  ]
  for (const mirrored of [false, true]) {
    for (const { part, name } of side) parts.push({ part: mirrored ? part.mirror(Plane.YZ) : part, name })
  }

  // A cross rail between the side rails' inner faces, its tails through them, the cane's groove in its top. Its
  // arrises broken but on its ends (glued to the side rails) and the top one on the opening's side, which the cane
  // laps; its tails' corner on the seat's outside, as the side rail's own corner there.
  const crossRail = (y0: number, t: number, tails: Part, outside: '-y' | '+y', name: string): Named => {
    const stock = Box(2 * d.X_RAIL, t, d.RAIL_H, { align: [Align.CENTER, Align.MIN, Align.MAX] }).translate(0, y0, d.SEAT_TOP)
    const lapped = outside === '-y' ? '+y' : '-y'
    const middle = round(stock, boxPlanes(stock), (faces) =>
      faces.includes('-x') || faces.includes('+x') || (faces.includes(lapped) && faces.includes('+z')) ? undefined : d.EDGE_BREAK,
    )
    const end = round(tails, boxPlanes(tails), (faces) => (faces.includes('+x') && faces.includes(outside) ? d.EDGE_BREAK : undefined))
    return { part: middle.fuse(end, end.mirror(Plane.YZ)).cut(seat.groove), name }
  }
  parts.push(crossRail(d.SEAT_FRONT, d.FRONT_RAIL_T, frontTails, '-y', 'front rail'))
  parts.push(crossRail(d.SEAT_BACK - d.REAR_RAIL_T, d.REAR_RAIL_T, rearTails, '+y', 'rear rail'))
  // The cane is flat: the weave is not modelled. The splines are rattan, glued in.
  parts.push({ part: seat.spline, name: 'seat cane spline' })
  parts.push({ part: seat.cane, name: 'seat cane' })
  for (const { part, name } of backRails(d, rails, back.groove)) parts.push({ part: tilt(d, part), name })
  parts.push({ part: tilt(d, back.spline), name: 'back cane spline' })
  parts.push({ part: tilt(d, back.cane), name: 'back cane' })
  return parts
}

/** One body as a three.js mesh: its faces tessellated, turned from CAD's z up to three's y up. */
function toGeometryData(part: Part) {
  const meshes = faceMeshes(part)
  const triangles = meshes.reduce((sum, m) => sum + m.triangles.length, 0)
  const hasNormals = meshes.every((m) => m.normals)
  const position = new Float32Array(triangles * 3)
  // Without normals from the kernel, the caller computes them from the triangles.
  const normal = hasNormals ? new Float32Array(triangles * 3) : undefined
  let at = 0
  for (const m of meshes) {
    const { vertices, normals } = m
    // `triangles` indexes `vertices` (one entry per vertex, shared between triangles); `normals` holds one normal
    // per triangle corner, so it is read in order, by a corner counter.
    let corner = 0
    for (const index of m.triangles) {
      const v = index * 3
      position[at] = vertices[v]
      position[at + 1] = vertices[v + 2]
      position[at + 2] = -vertices[v + 1]
      if (normal && normals) {
        const c = corner * 3
        normal[at] = normals[c]
        normal[at + 1] = normals[c + 2]
        normal[at + 2] = -normals[c + 1]
      }
      corner++
      at += 3
    }
  }
  return { position, normal }
}

/**
 * Builds the chair from the masters in `values` (missing ones take their default, extra ones are ignored). It
 * returns a Group of 26 named meshes, in mm, standing on y = 0, facing +z, x = 0 its middle.
 *
 * @param values The masters to change, keyed by the names in `schema`; a missing key takes its default.
 */
export async function build(values: Record<string, number> = {}): Promise<THREE.Object3D> {
  const p = {} as Masters
  for (const name of Object.keys(MASTERS) as (keyof Masters)[]) p[name] = values[name] ?? MASTERS[name].value
  p.EDGE_BREAK = edgeBreak(p.EDGE_BREAK) // under 1 mm, no round (as the ClassCAD part)
  const d = derive(p)
  // The kernel's bodies are freed once their triangles are copied out; only plain arrays leave the scope.
  const bodies = scope(() => model(d).map(({ part, name }) => ({ name, ...toGeometryData(part) })))
  const chair = new THREE.Group()
  chair.name = 'compass armchair'
  for (const { name, position, normal } of bodies) {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3))
    if (normal) geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3))
    else geometry.computeVertexNormals()
    const color = name.includes('cane') ? CANE_COLOR : TEAK
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.7 }))
    mesh.name = name
    chair.add(mesh)
  }
  return chair
}
