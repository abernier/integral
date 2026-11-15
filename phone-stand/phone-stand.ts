// Phone stand, a motorized stand that turns a phone between portrait and landscape, modelled in Rhino, not in code:
// `nr build` calls this module's default export with the ClassCAD script API on an empty drawing, and it imports the
// Rhino model as it is, phone-stand.rhino.step (Rhino 9's STEP export, mm), its 10 solids by name (scripts/part.ts
// importSolids). The STEP is written by phone-stand.rhino.py, the parametric Rhino script every dimension comes
// from; the head is a vendor part (vendor/quadlock-jimmysinkers/, CC BY 4.0) the script places and pins.
//
// Ten parts printed in PETG, after Braun's 1960s and 70s product language: a low disc base (electronics bay, ballast
// cavity under a lid, 1/4"-20 tripod nut), a slim column capped by a ball socket, a ball hanging from the drum that
// encloses an MG996R-class servo (a lockable ball joint: a knob at the back pushes a shoe onto the ball, so the whole
// drum aims, tilt and swivel), the dial plate the servo turns 0 to 90 degrees between two stops, flush in the drum's
// face, the orange index pressed into it, and a Quad Lock compatible head. The stand faces -Y, the desk is z = 0, the
// rotation axis runs along Y at x = 0, z = 154, the ball's centre at z = 86.
//
// No CAM: nothing here is cut on the ShopBot. No ROLES: every body is part of the stand, so the build's image shows
// all of them.

import { join } from 'node:path'
import { type Api, type Rgb, importSolids } from '../scripts/part.ts'

/** The master geometry: the Rhino model, exported as STEP, one named solid per printed part. */
export const SOURCE = join(import.meta.dirname, 'phone-stand.rhino.step')

/** The printed parts, by their solid's name in the STEP. */
export const PARTS = ['Base', 'Column', 'Drum', 'Ball', 'Shoe', 'Knob', 'Plate', 'Head', 'Lid', 'Index']

const PETG: Rgb = [230, 227, 220] // #e6e3dc, warm white PETG: every part, the head, ball and knob too
const ACCENT: Rgb = [226, 83, 31] // #e2531f, orange PETG: the index alone, the one functional detail in colour

/** A part's colour in the files: warm white PETG, the index in the accent colour. */
function colorOf(name: string) {
  return name === 'Index' ? ACCENT : PETG
}

/** Import the stand: one part, every printed part a named body in it; returns the part and the bodies' volumes. */
export default async function build(api: Api) {
  return importSolids(api, SOURCE, 'Phone stand', colorOf)
}
