// The desk's parameters: none. Its geometry is the Rhino model (desk.rhino.step), imported as it is (desk.ts), so
// there is nothing to set, and no configurator: the desk has no desk.model.ts.

import type { Control } from '../configurator/src/models.ts'

/** No master: the desk is imported, not built from parameters. */
export const MASTERS = {} satisfies Record<string, Control>
