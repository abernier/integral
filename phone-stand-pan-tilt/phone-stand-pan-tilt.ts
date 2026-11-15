// Pan-tilt phone stand, the motorized variant of the phone stand (../phone-stand/): two Feetech STS3215 serial bus
// servos aim the phone (pan and tilt) where the base stand has a lockable ball joint, and the base stand's MG996R still
// turns it between portrait and landscape. Modelled in Rhino, not in code: `nr build` calls this module's default
// export with the ClassCAD script API on an empty drawing, and it imports the Rhino model as it is,
// phone-stand-pan-tilt.rhino.step (Rhino 9's STEP export, mm), its 13 solids by name (scripts/part.ts importSolids).
// The STEP is written by phone-stand-pan-tilt.rhino.py, which runs the base stand's script as a library: the drum, the
// dial, the stops, the index, the head, the base and the lid come from its builders and parameters.
//
// Thirteen parts printed in PETG, after Braun's 1960s and 70s product language: a low disc base holding the pan servo
// and the electronics, a short column turning on the pan servo, a fork of two leaning arms and a bar (one section,
// half the drum's diameter, everywhere), the tilt servo in the left arm, a bearing in the right, the arms' covers, a
// plug over the bar's one screw, the drum on its two trunnions, the axle, and the base stand's dial, index and head.
// The stand faces -Y, the desk is z = 0; the roll axis runs along Y at x = 0, z = 158.75, the tilt axis along X
// through it at y = -54, the pan axis is vertical at y = -30.
//
// No CAM: nothing here is cut on the ShopBot. No ROLES: every body is part of the stand, so the build's image shows
// all of them.

import { join } from 'node:path'
import { type Api, type Rgb, importSolids } from '../scripts/part.ts'

/** The master geometry: the Rhino model, exported as STEP, one named solid per printed part. */
export const SOURCE = join(import.meta.dirname, 'phone-stand-pan-tilt.rhino.step')

/** The printed parts, by their solid's name in the STEP. */
export const PARTS = [
  'Base',
  'Lid',
  'Column',
  'YokeLeft',
  'YokeRight',
  'CoverLeft',
  'CoverRight',
  'Plug',
  'Drum',
  'Axle',
  'Plate',
  'Index',
  'Head',
]

const PETG: Rgb = [230, 227, 220] // #e6e3dc, warm white PETG: every part, the head and the fork too
const ACCENT: Rgb = [226, 83, 31] // #e2531f, orange PETG: the index alone, the one functional detail in colour

/** A part's colour in the files: warm white PETG, the index in the accent colour. */
function colorOf(name: string) {
  return name === 'Index' ? ACCENT : PETG
}

/** Import the stand: one part, every printed part a named body in it; returns the part and the bodies' volumes. */
export default async function build(api: Api) {
  return importSolids(api, SOURCE, 'Pan-tilt phone stand', colorOf)
}
