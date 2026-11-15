// The phone stand's parameters: none here. Its geometry is the Rhino model (phone-stand.rhino.step, written by
// phone-stand.rhino.py from its own parameters), imported as it is (phone-stand.ts), so there is nothing to set, and
// no configurator: the stand has no phone-stand.model.ts.

import type { Control } from '../configurator/src/models.ts'

/** No master: the stand is imported, not built from parameters. */
export const MASTERS = {} satisfies Record<string, Control>
