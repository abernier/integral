import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { stepAssembly, stepParts } from './step-assembly.ts'

/** A one-product STEP shaped like ClassCAD's: two named solids in the root's B-rep representation (geometry elided). */
const STEP = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('STEP'), '1');
FILE_NAME('Chair', '2026-11-03T00:00:00', (''), (''), 'Express 3.1.3.0', 'Express Tool', 'Unknown');
FILE_SCHEMA(('AUTOMOTIVE_DESIGN'));
ENDSEC;

DATA;
#1 = MANIFOLD_SOLID_BREP('Seat', #2);
#2 = CLOSED_SHELL('', ());
#3 = MANIFOLD_SOLID_BREP('Bob''s leg', #4);
#4 = CLOSED_SHELL('', ());
#5 = (
   GEOMETRIC_REPRESENTATION_CONTEXT (3)
   REPRESENTATION_CONTEXT ('', '3D')
);
#6 = SHAPE_REPRESENTATION('', (#20), #5);
#7 = PRODUCT_DEFINITION_SHAPE('', '', #8);
#8 = PRODUCT_DEFINITION('', '', #10, #13);
#9 = APPLICATION_CONTEXT('configuration controlled 3D designs of mechanical parts and assemblies');
#10 = PRODUCT_DEFINITION_FORMATION_WITH_SPECIFIED_SOURCE('', '', #11, .NOT_KNOWN.);
#11 = PRODUCT('Chair', 'Chair', '', (#12));
#12 = PRODUCT_CONTEXT('', #9, 'mechanical');
#13 = PRODUCT_DEFINITION_CONTEXT('part definition', #9, 'design');
#14 = SHAPE_DEFINITION_REPRESENTATION(#7, #6);
#15 = SHAPE_REPRESENTATION_RELATIONSHIP('', '', #6, #16);
#16 = ADVANCED_BREP_SHAPE_REPRESENTATION('', (#20, #1, #3), #5);
#20 = AXIS2_PLACEMENT_3D('', #21, #22, #23);
#21 = CARTESIAN_POINT('', (0., 0., 0.));
#22 = DIRECTION('', (0., 0., 1.));
#23 = DIRECTION('', (1., 0., 0.));
ENDSEC;
END-ISO-10303-21;
`

/** The parts `stepParts` reads back from `text`, written to a temporary file. */
function partsOf(text: string) {
  const file = join(mkdtempSync(join(tmpdir(), 'step-assembly-')), 'model.step')
  writeFileSync(file, text)
  return stepParts(file)
}

test('each named solid becomes a part, in file order, its name unescaped', () => {
  assert.deepEqual(partsOf(stepAssembly(STEP)), ['Seat', "Bob's leg"])
})

test('a STEP without named solids comes back unchanged', () => {
  const unnamed = STEP.replace("('Seat'", "(''").replace("('Bob''s leg'", "(''")
  assert.equal(stepAssembly(unnamed), unnamed)
})

test('an already rewritten STEP is refused', () => {
  assert.throws(() => stepAssembly(stepAssembly(STEP)), /expected one PRODUCT/)
})
