// The compass armchair's masters: the one list the ClassCAD part (compass-armchair.ts), the browser model
// (compass-armchair.model.ts) and the configurator's sliders all read. No imports but the contract's type, so that
// both the build script and the browser bundle can take it.

import type { Control, Variants } from '../configurator/src/models.ts'

/**
 * The chair's variants: its cane seat and back, the chair it follows, or a black leather cushion and back pad on
 * plywood, as some were upholstered. The masters' defaults are both's.
 */
export const VARIANTS = {
  cane: { label: 'Cane', hint: 'Sheet cane seat and back, pressed into a groove and held by a rattan spline' },
  leather: { label: 'Leather cushion', hint: 'A black leather seat cushion and back pad, on plywood' },
} satisfies Variants

/**
 * The parameters a maker changes, in mm (angles in degrees): each with its default, its range, its step and what it
 * means. The ranges keep every joint valid (a tenon in its mortise, a tail in its socket) at every corner of the box:
 * the browser model does not throw for any combination of values inside them. Values outside are not guaranteed.
 */
export const MASTERS = {
  W: { main: true, value: 480, min: 440, max: 520, step: 1, hint: 'Overall width, outside the side boards' },
  LEG_T: { main: true, value: 30, min: 26, max: 36, step: 1, hint: 'Thickness of the side boards' },
  FRONT_FOOT_FRONT: { value: -181, min: -200, max: -165, step: 1, hint: 'Front edge of the front foot on the floor' },
  FRONT_FOOT_BACK: { value: -139, min: -155, max: -125, step: 1, hint: 'Back edge of the front foot on the floor' },
  REAR_FOOT_FRONT: { value: 139, min: 125, max: 155, step: 1, hint: 'Front edge of the rear foot on the floor' },
  REAR_FOOT_BACK: { value: 181, min: 165, max: 200, step: 1, hint: 'Back edge of the rear foot on the floor' },
  NOTCH_Z: { value: 400, min: 380, max: 420, step: 1, hint: 'Height where the two boards of a side part, on the seam' },
  ARM_EDGE_FRONT: { value: -70, min: -85, max: -55, step: 1, hint: 'Front board outer edge where it meets the armrest' },
  ARM_EDGE_REAR: { value: 70, min: 55, max: 85, step: 1, hint: 'Rear board outer edge where it meets the armrest' },
  SPLINE_W: { value: 20, min: 16, max: 24, step: 1, hint: 'Seam tenon width, across the board' },
  SPLINE_T: { value: 16, min: 14, max: 18, step: 1, hint: 'Seam tenon thickness' },
  SPLINE_Z: { value: 457, min: 450, max: 465, step: 1, hint: 'Height the seam tenon starts from' },
  SPLINE_IN_ARM: { value: 40, min: 30, max: 50, step: 1, hint: 'How far the seam tenon runs into the armrest' },
  ARM_TOP: { main: true, value: 645, min: 630, max: 660, step: 1, hint: 'Height of the armrest top' },
  ARM_FRONT: { value: -235, min: -245, max: -225, step: 1, hint: 'Position of the armrest nose' },
  ARM_NOSE_H: { value: 60, min: 50, max: 70, step: 1, hint: 'Armrest height at the nose' },
  ARM_BACK_Y: { value: 280, min: 270, max: 290, step: 1, hint: 'Where the armrest reaches its back height' },
  ARM_BACK_H: { value: 95, min: 85, max: 105, step: 1, hint: 'Armrest height at the back' },
  ARM_BEHIND: { value: 40, min: 30, max: 50, step: 1, hint: 'How far the armrest runs on behind the back posts' },
  SEAT_TOP: { main: true, value: 437, min: 425, max: 450, step: 1, hint: 'Height of the seat frame top' },
  RAIL_H: { value: 60, min: 55, max: 65, step: 1, hint: 'Height of the seat rails' },
  RAIL_T: { value: 25, min: 22, max: 28, step: 1, hint: 'Thickness of the side rails' },
  CANE_T: { value: 8, min: 6, max: 10, step: 0.5, variants: ['cane'], hint: 'Thickness of the cane panels' },
  CANE_SHEET: { value: 2, min: 1.5, max: 3, step: 0.5, variants: ['cane'], hint: 'Thickness of the sheet cane where it laps the frame into its groove' },
  GROOVE_W: { value: 6, min: 5, max: 8, step: 0.5, variants: ['cane'], hint: 'Width of the cane groove around each opening' },
  // The side rail tenons sit in the wood under it, with a wall of at least 2.5 mm above and below: GROOVE_D + TENON_H
  // at most RAIL_H - 2 x 2.5 at every corner of the box (55 - 2 x 2.5 = 10 + 40). In the cane variant; without a
  // groove, they are centred on the rail's height.
  GROOVE_D: { value: 10, min: 6, max: 10, step: 0.5, variants: ['cane'], hint: 'Depth of the cane groove' },
  GROOVE_INSET: { value: 10, min: 8, max: 12, step: 0.5, variants: ['cane'], hint: "The cane groove's middle, out from the opening's edge" },
  GROOVE_R: { value: 15, min: 10, max: 16, step: 0.5, variants: ['cane'], hint: "Radius of the cane groove's corners, on its middle" },
  // The leather variant's seat: a plywood board on teak cleats under the rails' top, the cushion on it. The cleats and
  // the board at most RAIL_H deep at every corner of the box (22 + 12 + 20 < 55): the cleats stay within the rails.
  SEAT_BOARD_T: { value: 12, min: 9, max: 12, step: 0.5, variants: ['leather'], hint: 'Thickness of the plywood seat board' },
  SEAT_BOARD_DOWN: { value: 20, min: 15, max: 22, step: 1, variants: ['leather'], hint: "How far the seat board's top sits under the rails' top" },
  CLEAT: { value: 18, min: 15, max: 20, step: 1, variants: ['leather'], hint: 'Section of the teak cleats the seat board rests on' },
  CUSHION_PROUD: { value: 20, min: 10, max: 40, step: 1, variants: ['leather'], hint: "How far the seat cushion stands above the rails' top" },
  // The leather variant's back: a bending-plywood backer on teak fillets behind the rails, the pad in front of it. The
  // fillet and the backer less deep than the rails at every corner of the box (12 + 8 < 36 - 14): the pad has room.
  FILLET: { value: 10, min: 8, max: 12, step: 0.5, variants: ['leather'], hint: 'Section of the curved teak fillets the back board is screwed to' },
  BACK_BOARD_T: { value: 6, min: 4, max: 8, step: 0.5, variants: ['leather'], hint: 'Thickness of the bending-plywood back board' },
  BACK_PAD_PROUD: { value: 3, min: 2, max: 10, step: 0.5, variants: ['leather'], hint: "How far the back pad stands in front of the rails' front face" },
  SEAT_FRONT: { value: -229, min: -240, max: -220, step: 1, hint: 'Nose of the side rails' },
  SEAT_BACK: { value: 240, min: 230, max: 250, step: 1, hint: 'Back end of the side rails' },
  FRONT_RAIL_T: { value: 30, min: 26, max: 34, step: 1, hint: 'Thickness of the front cross rail' },
  REAR_RAIL_T: { value: 40, min: 36, max: 44, step: 1, hint: 'Thickness of the rear cross rail' },
  TENON_LEN: { value: 20, min: 16, max: 24, step: 1, hint: 'How far a side rail tenon goes into the board' },
  TENON_T: { value: 10, min: 8, max: 12, step: 1, hint: 'Side rail tenon thickness' },
  // Bound with GROOVE_D by RAIL_H: see the cane groove above.
  TENON_H: { value: 40, min: 34, max: 40, step: 1, hint: 'Side rail tenon height' },
  TENON_Y: { value: 55, min: 50, max: 60, step: 1, hint: 'Distance of the side rail tenons from the seam' },
  TENON_IN_RAIL: { value: 15, min: 12, max: 18, step: 1, hint: 'How far a side rail tenon goes into the rail' },
  BACK_TILT: { main: true, value: 15, min: 10, max: 20, step: 0.5, hint: 'Lean of the back, degrees' },
  POST_W: { value: 30, min: 26, max: 34, step: 1, hint: 'Width of a back post, across the chair' },
  POST_D: { value: 40, min: 36, max: 44, step: 1, hint: 'Depth of a back post' },
  POST_Y_AT_ARM: { value: 260, min: 250, max: 270, step: 1, hint: 'Position of the posts axis at the armrest top' },
  BOW: { value: 10, min: 6, max: 14, step: 0.5, hint: 'How far the back arc bows behind the posts' },
  LOW_RAIL_BOTTOM: { value: 65, min: 60, max: 70, step: 1, hint: 'Bottom of the lower back rail, along the posts from seat height' },
  LOW_RAIL_TOP: { value: 100, min: 95, max: 105, step: 1, hint: 'Top of the lower back rail' },
  HIGH_RAIL_BOTTOM: { value: 330, min: 325, max: 335, step: 1, hint: 'Bottom of the upper back rail' },
  HIGH_RAIL_TOP: { value: 365, min: 360, max: 370, step: 1, hint: 'Top of the upper back rail, where the posts end' },
  ARM_TENON: { value: 12, min: 10, max: 14, step: 0.5, hint: 'Thickness of a post tenon into its armrest' },
  ARM_TENON_DEPTH: { value: 15, min: 12, max: 18, step: 1, hint: 'How deep a post tenon goes into each member' },
  ARM_TENON_MARGIN: { value: 8, min: 6, max: 10, step: 0.5, hint: 'Wood left above and below a post tenon' },
  SLOPE: { value: 1 / 6, min: 0.12, max: 0.2, step: 0.005, hint: 'Dovetail slope' },
  SEAT_TAILS: { value: 2, min: 1, max: 2, step: 1, hint: 'Dovetails per seat corner' },
  SEAT_PIN_EDGE: { value: 6, min: 5, max: 7, step: 0.5, hint: 'Seat pins at the side rail edges' },
  SEAT_PIN_MID: { value: 6, min: 5, max: 7, step: 0.5, hint: 'Seat pins between the tails' },
  BACK_TAIL_SHOULDER: { value: 12, min: 10, max: 14, step: 0.5, hint: 'Shoulders either side of a back rail tail' },
  // The rounds are made by hand on the cut parts: the CAM files are cut square (`cam`).
  ARM_NOSE_R: { value: 8, min: 0, max: 12, step: 0.5, cam: 0, hint: "Round on the armrest nose's edges, by hand" },
  EDGE_BREAK: { value: 2.5, min: 0, max: 4, step: 0.5, cam: 0, hint: 'Round on every other outside arris of the assembled chair, by hand; flush glued seams stay sharp; under 1 mm, none' },
} satisfies Record<string, Control>

/** The smallest EDGE_BREAK that is made: a round under it is no round. */
export const MIN_EDGE_BREAK = 1

/**
 * The EDGE_BREAK both kernels build with: 0 under MIN_EDGE_BREAK. A sub-millimetre round is sanding, not a feature, and
 * on a back rail's ring the kernel refuses one as close to the largest its edges allow (W 458, POST_D 38, BOW 8).
 */
export function edgeBreak(value: number) {
  return value < MIN_EDGE_BREAK ? 0 : value
}
