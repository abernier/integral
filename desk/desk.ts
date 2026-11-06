// Desk, a mid-century writing desk modelled in Rhino, not in code: `nr build` calls this module's default export with
// the ClassCAD script API on an empty drawing, and it imports the Rhino model as it is, desk.rhino.step (Rhino 9's
// STEP export, mm), its 33 solids by name (scripts/part.ts importSolids). The joinery (rabbets, grooves, dowel and
// tenon holes, finger pulls) and the finishes (the top's 6 mm roundover, the drawer fronts' 1.5 mm one) are cut into
// those solids already. The desk has no masters (desk.masters.ts) and no configurator.
//
// A 1400 × 650 oak top on a frame: at the left, a leg cleat under the top and an apron along its front, on two long
// turned legs; at the right, a pedestal of three drawers in a birch plywood carcass, on two short turned legs.
// The desk faces -Y, the floor is z = 0, the top's back left corner x = 0, y = 650 (Rhino's coordinates).

import { join } from 'node:path'
import type { CamConfig } from '../scripts/cam.config.ts'
import { type Api, type Rgb, importSolids } from '../scripts/part.ts'

/** The master geometry: the Rhino model, exported as STEP, one named solid per part. */
export const SOURCE = join(import.meta.dirname, 'desk.rhino.step')

const DRAWERS = [1, 2, 3]

/**
 * The parts by the stock they are cut from, mm, by their solid's name: oak, birch plywood, or turned. The thickness
 * is the geometry's: `pnpm cam` measures it and groups the parts by material and thickness, a sheet each.
 */
export const STOCK = {
  oak30: ['Top_Panel', 'Frame_LegCleat', 'Carcass_LegBlockFront', 'Carcass_LegBlockBack'],
  oak18: ['Frame_Apron', ...DRAWERS.map((n) => `Drawer${n}_Front`)],
  // Veneered to match the oak where it shows (the cut list's "teak veneered").
  ply18: ['Carcass_SideLeft', 'Carcass_SideRight', 'Carcass_Bottom', 'Carcass_Back', 'Carcass_RailFront', 'Carcass_RailBack'],
  ply12: DRAWERS.flatMap((n) => ['SideLeft', 'SideRight', 'Front', 'Back'].map((side) => `DrawerBox${n}_${side}`)),
  ply6: DRAWERS.map((n) => `DrawerBox${n}_Bottom`),
  turned: ['Leg_FrontLeft', 'Leg_BackLeft', 'Leg_FrontRight', 'Leg_BackRight'],
}

const OAK: Rgb = [190, 140, 90] // #be8c5a
const BIRCH: Rgb = [225, 205, 165] // #e1cda5, the drawer boxes, told apart from the oak

/** A part's colour in the files: oak, the veneered carcass too; the drawer boxes birch. */
function colorOf(name: string) {
  const birch = [...STOCK.ply12, ...STOCK.ply6]
  return birch.includes(name) ? BIRCH : OAK
}

/**
 * How `pnpm cam` cuts the desk's parts (see CamConfig): what Fusion cannot know from the STEP. The finishes made by
 * hand are in the STEP it reads, the master geometry having no masters to build it without them (no `cam` value):
 * the outline is cut to the parts' silhouette, square, and the roundovers are routed on the cut parts.
 */
export function CAM(): CamConfig {
  const ply = [...STOCK.ply18, ...STOCK.ply12, ...STOCK.ply6]
  return {
    defaults: { material: 'oak' },
    parts: {
      ...Object.fromEntries(ply.map((name) => [name, { material: 'birch-ply' }])),
      // The carcass's sides stand 450 high and 620 deep: the face veneer's grain up their height, as the back's.
      Carcass_SideLeft: { material: 'birch-ply', grain: 90 },
      Carcass_SideRight: { material: 'birch-ply', grain: 90 },
      // The legs are turned on the lathe from 35 mm square oak, not milled.
      ...Object.fromEntries(STOCK.turned.map((name) => [name, { skip: true }])),
    },
  }
}

/**
 * Import the desk: one part, every board a named body in it, coloured by its stock; returns the part and the
 * boards' volumes.
 */
export default async function build(api: Api) {
  return importSolids(api, SOURCE, 'Desk', colorOf)
}
