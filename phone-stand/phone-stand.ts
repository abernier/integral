// Phone stand, a motorized stand that turns a phone between portrait and landscape, modelled in Rhino, not in code:
// `nr build` calls this module's default export with the ClassCAD script API on an empty drawing, and it imports the
// Rhino model as it is, phone-stand.rhino.step (Rhino 9's STEP export, mm), its 5 solids by name (scripts/part.ts
// importSolids). The STEP is written by phone-stand.rhino.py, the parametric Rhino script every dimension comes
// from; the head is a vendor part (vendor/quadlock-jimmysinkers/, CC BY 4.0) the script places and pins.
//
// Five parts printed in PETG: a base (electronics bay, ballast cavity under a lid, 1/4"-20 tripod nut), a tower
// holding an MG996R-class servo, the plate the servo turns 0 to 90 degrees between two stops, and a Quad Lock
// compatible head on it. The stand faces -Y, the desk is z = 0, the rotation axis runs along Y at x = 0, z = 121.
//
// No CAM: nothing here is cut on the ShopBot. No ROLES: every body is part of the stand, so the build's image shows
// all of them.

import { join } from 'node:path'
import { type Api, type Rgb, importSolids } from '../scripts/part.ts'

/** The master geometry: the Rhino model, exported as STEP, one named solid per printed part. */
export const SOURCE = join(import.meta.dirname, 'phone-stand.rhino.step')

/** The printed parts, by their solid's name in the STEP. */
export const PARTS = ['Base', 'Tower', 'Plate', 'Head', 'Lid']

const PETG: Rgb = [70, 74, 80] // #464a50, charcoal PETG
const HEAD: Rgb = [196, 85, 62] // #c4553e, the head told apart from the rest

/** A part's colour in the files: charcoal PETG, the head in a second colour. */
function colorOf(name: string) {
  return name === 'Head' ? HEAD : PETG
}

/** Import the stand: one part, every printed part a named body in it; returns the part and the bodies' volumes. */
export default async function build(api: Api) {
  return importSolids(api, SOURCE, 'Phone stand', colorOf)
}
