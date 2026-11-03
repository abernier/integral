// The zigzag chair's parameters, shared by zigzag-chair.ts (ClassCAD) and zigzag-chair.model.ts (the browser).

import type { Control } from '../configurator/src/models.ts'

const DEG = Math.PI / 180

/** The back's lean from the vertical, degrees: the default of BACK_LEAN, and what SEAT_LEN and BACK_H are chosen for. */
const LEAN = 8

/**
 * The parameters a maker changes: each one's default, its range and step, and what it means. Millimeters, and
 * degrees for the lean. The seat length and the back height are chosen so that the chair has a 480 depth and
 * 740 height (the back's rear top corner) with its 8 degree lean.
 */
export const MASTERS = {
  T: { value: 19, min: 12, max: 30, step: 0.5, hint: 'board thickness' },
  W_NOSE: { value: 370, min: 300, max: 500, step: 1, hint: "width at the seat's nose" },
  W_FOOT: { value: 330, min: 260, max: 460, step: 1, hint: "width at the slant's foot: with W_NOSE, it sets the taper" },
  W_BASE_FRONT: { value: 300, min: 220, max: 420, step: 1, hint: "width of the base's top face at its front edge" },
  SEAT_TOP: { value: 430, min: 380, max: 500, step: 1, hint: "height of the seat's top face" },
  SEAT_LEN: { value: 480 - 310 * Math.tan(LEAN * DEG), min: 350, max: 520, step: 1, hint: "the seat's top face, from the nose to the back's rear face" },
  BACK_H: { value: 310 / Math.cos(LEAN * DEG), min: 200, max: 450, step: 1, hint: 'the back above the seat, along its rear face' },
  BACK_LEAN: { value: LEAN, min: 0, max: 20, step: 0.5, hint: "the back's lean from the vertical, degrees" },
  BASE_LENGTH: { value: 418, min: 330, max: 500, step: 1, hint: "the base's underside, from the foot to its square front end" },
  CLEAT: { value: 30, min: 15, max: 50, step: 1, hint: "a cleat's legs" },
  TAILS: { value: 6, min: 2, max: 8, step: 1, hint: 'dovetail count' },
  SLOPE: { value: 1 / 6, min: 0.1, max: 0.25, step: 0.01, hint: 'dovetail slope, 1 in 6' },
  PIN: { value: 20, min: 10, max: 30, step: 1, hint: "a pin, at the back's rear face" },
  HALF_PIN: { value: 20, min: 10, max: 30, step: 1, hint: "the half pins at the back's edges" },
  GRIP: { value: 140, min: 80, max: 200, step: 1, hint: 'hand grip length, round ends included' },
  GRIP_HIGH: { value: 20, min: 10, max: 40, step: 1, hint: 'hand grip height' },
  GRIP_DEEP: { value: 10, min: 4, max: 14, step: 0.5, hint: 'hand grip depth into the rear face' },
  GRIP_BELOW: { value: 20, min: 10, max: 60, step: 1, hint: "from the back's top edge to the grip, along the rear face" },
} satisfies Record<string, Control>
