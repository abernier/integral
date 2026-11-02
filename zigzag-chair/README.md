# Zigzag chair

A parametric, history-based [ClassCAD](https://classcad.ch) model of the zigzag chair: four cherry boards 19 mm
thick (seat, back, slant, base) and two glue cleats, 370 x 480 x 742.6 mm over all. The seat, the slant and the
base taper from 370 at the nose to 330 at the foot (0.03189 mm a side per mm) and meet in 45 degree mitres; the
base is 300 wide on its top front edge, its sides planed flush with the slant's (3.49 mm a side of bevel); the seat
carries 6 through dovetail tails into the back; the back has a 140 x 20 x 10 grip pocket in its rear face.

The geometry and joinery follow smlibpy's
[`examples/zigzag_chair.py`](https://github.com/abernier/smlibpy/blob/main/examples/zigzag_chair.py), the
finished, planed-flush state.

**[Open it in Buerligons](https://buerligons.io/editor/?url=https://abernier.github.io/integral/zigzag-chair/zigzag-chair.ofb)** (a free classcad.ch account; then edit `Params` and recalculate).

![The chair from behind: tails through the back, the grip, the slant and the base](https://abernier.github.io/integral/zigzag-chair/zigzag-chair.png)

The script is the only source in git; `nr build` makes the rest, and GitHub Pages serves it:

| File | What it is |
|---|---|
| [`zigzag-chair.js`](https://github.com/abernier/integral/blob/main/zigzag-chair/zigzag-chair.js) | The build: one `run_script` body, for the ClassCAD MCP or `nr build` |
| [`zigzag-chair.ofb`](https://abernier.github.io/integral/zigzag-chair/zigzag-chair.ofb) | The model with its history; opens in [Buerligons](https://buerligons.io) |
| [`zigzag-chair.step`](https://abernier.github.io/integral/zigzag-chair/zigzag-chair.step) | STEP assembly, six solids (`Seat`, `Back`, `Slant`, `Base`, `SeatCleat`, `FootCleat`) |
| [`zigzag-chair.png`](https://abernier.github.io/integral/zigzag-chair/zigzag-chair.png) | Render, default parameters |

## How it is built

A root assembly holds a `Params` part (expressions only, no geometry) and one part per board, each instanced in
place. Every board is a 3 m stock box cut down by half-spaces: a `workPlane` whose `position` and `normal` are
expression strings, then a `slice` keeping the material side. The tails are one tail cut the same way, then a
merged `linearPattern` whose count and pitch are expressions; the seat unites it, the back subtracts it along
with the grip (a box and two cylinders on a work csys turned to the back's lean).

Assemblies hold no expressions in ClassCAD, so the parameters live in `Params` and every board mirrors all of
them as `Params.ExpressionSet.<name>`.

## Parameters

Edit these in the `Params` part. Lengths in mm.

| Name | Default | Meaning |
|---|---|---|
| `T` | 19 | Board thickness |
| `W_NOSE` | 370 | Width at the seat's nose |
| `W_FOOT` | 330 | Width at the slant's foot; with `W_NOSE` it sets the taper |
| `W_BASE_FRONT` | 300 | The base's top face at its front edge |
| `SEAT_TOP` | 430 | Height of the seat's top |
| `SEAT_LEN` | 436.43 | Seat top, from the nose to the back's rear face |
| `BACK_H` | 313.04 | The back above the seat, along its rear face |
| `BACK_LEAN` | 8 | The back's lean from vertical, degrees |
| `BASE_LENGTH` | 418 | The base's underside, foot to front end |
| `CLEAT` | 30 | Cleat legs |
| `TAILS` | 6 | Dovetail tail count |
| `SLOPE` | 1/6 | Dovetail slope |
| `PIN`, `HALF_PIN` | 20, 20 | Pin and edge half-pin, at the back's rear face |
| `GRIP`, `GRIP_HIGH`, `GRIP_DEEP`, `GRIP_BELOW` | 140, 20, 10, 20 | Grip pocket: length, height, depth, distance below the top edge |

Everything else (`HEIGHT`, `DEPTH`, `RATE`, `W_BACK`, `TAIL_REAR`, `BASE_Y`, `BASE_Z`, `BEVEL`, ...) is derived in
`Params`. The slant angle is fixed at 45 degrees.

## Rebuild

- From scratch: `nr build:parts` (this part and any other, into `.docs/`, about 9 s), or `nr build` for the whole
  site; or run `zigzag-chair.js` with the MCP's `run_script` on a new drawing, then `save` as OFB / STP.
- Change a parameter in an open model, from a script:

  ```js
  await api.v1.part.updateExpression({ id: paramsId, toUpdate: [{ name: 'T', value: 22 }, { name: 'TAILS', value: 5 }] })
  await api.v1.common.recalc() // the boards read Params by path; ClassCAD does not track that dependency
  ```

  Re-assigning one mirror in each board (`{ name: 'T', value: 'Params.ExpressionSet.T' }`) does the same.
- In Buerligons: edit the expression in `Params`, then recalculate the model.

Tested: `T` 19 -> 22 and `TAILS` 6 -> 5 rebuilt all six boards in 0.5 s, every board's volume equal to smlibpy's
for the same values (see below). `W_NOSE` 370 -> 400 and back through `recalc()`: rebuilt and returned to the
defaults' volumes exactly. The saved `.ofb`, loaded again, rebuilt `TAILS` 6 -> 4.

## Compared with smlibpy

Volumes in mm³, ClassCAD `calculateMassProperties` per board part against smlibpy's `Part.volume`:

| Board | ClassCAD | smlibpy | Difference |
|---|---|---|---|
| Seat | 2 725 472.074 | 2 725 472.074 | under 1e-6 |
| Back | 2 082 435.575 | 2 082 462.542 | -26.97 (0.0013 %) |
| Slant | 3 865 257.798 | 3 865 257.798 | under 1e-6 |
| Base | 2 356 487.869 | 2 356 487.869 | under 1e-8 |
| Seat cleat | 164 539.686 | 164 539.686 | under 1e-8 |
| Foot cleat | 150 176.501 | 150 176.501 | under 1e-8 |

With `T = 22`, `TAILS = 5`: the same picture, the back -26.7, the others within 2e-5.

The back is the only board with curved faces (the grip's round ends), and ClassCAD's volume is approximate on
curved faces: a lone 20 x 10 cylindrical pocket in a box measures 3149.49 against an exact 3141.59. The geometry
itself is right (section checked); smlibpy's volume is exact and matches its hand-worked `check()`.

### What ClassCAD did well

- **Live history.** The whole chair, taper, bevelled base, tails and grip included, follows its parameters and
  rebuilds in about half a second. smlibpy reruns the script (0.7 s), so speed is a wash; the gain is that the
  `.ofb` carries the parameters and the history to someone without the script.
- **Expression strings almost everywhere**: work plane position and normal, csys offset and rotation, box and
  cylinder sizes, pattern count and pitch. That made a half-space build possible with no sketch at all.
- **Exact planar volumes**: five of six boards agree with smlibpy to 1e-6 mm³ or better.
- **STEP export works on the free plan**, as an assembly with named products.

### What it did badly

- **No expressions on assemblies.** Shared parameters need a parameter part, a mirror of every name in every
  board (52 per board here), and an explicit refresh: changing `Params` alone changes nothing until `recalc()`.
- **Silent failures in the API.** Several calls succeed while doing nothing (the bare `{ id, name, value }` form
  of `expression`, unknown keys like `origin` on a work plane); the docs warn about each one, but nothing in the
  call does. The STEP export reported `maxLevel 51` for a complete, correct file.
- **Volumes on curved faces are approximate** (above), so checks against hand-worked volumes need a tolerance
  there, where smlibpy needs none.
- **No verification layer of its own.** smlibpy's `check()` asserts touching faces, matching mitre corners, the
  assembly order and the base's measured bevel; here only volumes and a section render were checked.
- **Long feature trees.** One work plane and one slice per cut: 6 to 9 cuts a board, 6 more for each tail tool.
  A sketch-based profile would be shorter, but each vertex would need two expression-bound dimensions, and the
  docs warn that the sketch solver can flip to another branch after a large parameter change.
- **Buerligons needs a sign-in.** The editor asks for a classcad.ch account before it fetches the file; once
  signed in, the link opens the chair.
