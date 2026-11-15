// The pan-tilt phone stand's parameters: none here. Its geometry is the Rhino model (phone-stand-pan-tilt.rhino.step,
// written by phone-stand-pan-tilt.rhino.py from its own parameters and the base stand's), imported as it is
// (phone-stand-pan-tilt.ts), so there is nothing to set, and no configurator: the stand has no
// phone-stand-pan-tilt.model.ts.

import type { Control } from '../configurator/src/models.ts'

/** No master: the stand is imported, not built from parameters. */
export const MASTERS = {} satisfies Record<string, Control>
