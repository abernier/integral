# Phone stand

A motorized desk stand that turns a phone between portrait and landscape, after Braun's product language, modelled in Rhino, printed in PETG.

![Phone stand, three-quarter front](https://abernier.github.io/integral/phone-stand/renders/phone-stand.three-quarter.webp)
![Phone stand, front](https://abernier.github.io/integral/phone-stand/renders/phone-stand.front.webp)
![Phone stand, side](https://abernier.github.io/integral/phone-stand/renders/phone-stand.side.webp)
![Phone stand, three-quarter back](https://abernier.github.io/integral/phone-stand/renders/phone-stand.back.webp)

<Intro>

A servo turns the phone a quarter turn about the axis through its screen's center, so that an app playing portrait and landscape media (a video feed) can turn the phone to match each one. The phone clips onto the turning dial through a Quad Lock compatible head; an ESP32 in the base drives the servo, and the app talks to it over Bluetooth Low Energy ([protocol](https://github.com/abernier/integral/blob/main/phone-stand/protocol.md); why: [ADR 0001](https://github.com/abernier/integral/blob/main/docs/adr/0001-phone-stand-web-bluetooth.md)). The model is Rhino's, not code: [`phone-stand.rhino.step`](https://github.com/abernier/integral/blob/main/phone-stand/phone-stand.rhino.step), six named solids in mm, is its master geometry, written by the parametric Rhino script [`phone-stand.rhino.py`](https://github.com/abernier/integral/blob/main/phone-stand/phone-stand.rhino.py), and the build imports it as it is. No configurator: to change the stand, edit the script's parameters and run it again.

It is drawn after the Braun product language of the 1960s and 70s (Dieter Rams, Dietrich Lubs): circles and cylinders only, one body colour, and one accent on the one detail that does something, as the hand of Lubs' AB 1 alarm clock. A low disc base, a slim column with a flat back, and a drum that hides the servo; the turning plate is a dial set flush in the drum's face behind a 0.75 mm shadow gap, its orange index pointing at one of two notches in the rim, portrait or landscape. The proportions are simple ones: the base is φ times the drum (Ø 142 to Ø 88), the drum φ times the length of column that shows (88 to 54), and the column a drum's diameter over π (28). No fastener shows from the front or the sides, and the one cable, 5 V on USB-C, leaves at the back of the base, under the column.

**Status: modelled only.** Nothing has been printed or checked on the bench: read [Verify before printing](#verify-before-printing) first. The firmware and the app side do not exist yet.

</Intro>

[![Open in Buerligons](https://img.shields.io/badge/Open_in-Buerligons-c4553e)](https://buerligons.io/editor/?url=https://abernier.github.io/integral/phone-stand/phone-stand.ofb) [![download .ofb](https://img.shields.io/badge/download-.ofb-1f6feb)](https://abernier.github.io/integral/phone-stand/phone-stand.ofb) [![download STEP](https://img.shields.io/badge/download-STEP-238636)](https://abernier.github.io/integral/phone-stand/phone-stand.step) [![download GLB](https://img.shields.io/badge/download-GLB-8957e5)](https://abernier.github.io/integral/phone-stand/phone-stand.glb)

![Phone stand, from behind](https://abernier.github.io/integral/phone-stand/phone-stand.png)

| | |
|---|---|
| Material | PETG, 0.2 mm layers, no supports |
| Colour | warm white (every part, the head too) and orange (the index alone) |
| Size | Ø 142 × 164 mm; the phone sweeps a circle of R 86 about an axis 120 mm above the desk |
| Travel | 0 to 90 degrees, hard stops 5 degrees beyond each end |
| Parts | base, body, plate, index, head, lid |
| Model | ClassCAD part imported from Rhino's STEP, 6 named bodies |
| Source | [`phone-stand.rhino.py`](https://github.com/abernier/integral/blob/main/phone-stand/phone-stand.rhino.py), Rhino 8 or 9, writes [`phone-stand.rhino.step`](https://github.com/abernier/integral/blob/main/phone-stand/phone-stand.rhino.step) |
| Engine | ClassCAD WASM 21.2, free plan (non-commercial) |

## Parts

| Part | What |
|---|---|
| Base | Low disc, Ø 142 × 22: electronics bay at the back (open to the bottom), the USB-C port, a round ballast cavity, 1/4"-20 tripod nut trap, rubber feet recesses, and the socket the column stands in |
| Lid | Round, closes the ballast cavity from below (4 × M3) |
| Body | Column and drum (Ø 88 × 58) in one piece: the servo goes into the drum from the front and screws by its flange onto a bulkhead inside; carries the stop block; screwed onto the base from inside the bay (3 × M3) |
| Plate | The dial, Ø 78.5: turning disc bolted to the servo horn, flush in the drum's face, carries the two stop tabs |
| Index | Orange key pressed into the dial: the orientation indicator |
| Head | Quad Lock compatible head (vendor STEP, see [Credits](#credits-and-licensing)) with two anti-rotation pins on its back |

The head and the plate are two parts on purpose. The head is a print-in-place mechanism: a fixed core and a sliding release sleeve joined by a printed spring. Its sleeve must stay free to travel back toward the plate, and a fused head and plate would have no support-free print orientation. One M3 button-head screw from the plate's back holds the head; two pins take the twist torque.

## Bill of materials

| Qty | Item | Note |
|---|---|---|
| 1 | MG996R-class metal-gear servo, with round horn | Modelled at 40.7 × 19.7 × 42.9 mm, horn Ø 20 |
| 1 | ESP32 DevKit | Lies across the bay, slot 56 × 29 × 15 mm; its own USB port is reached from below, for flashing |
| 1 | 5 V 2 A USB-C power breakout | Behind a 12.5 × 7 mm stadium port at the back of the base |
| 1 | 1/4"-20 hex nut | 11.1 mm across flats, 5.6 mm thick |
| 7 | M3 heat-set inserts (Ø 4 hole, 6 deep) | 3 in the column foot, 4 around the lid |
| 7 | M3 screws | 3 base to column (from inside the bay), 4 lid |
| 4 | M4 self-tapping screws | Servo flange into the bulkhead (Ø 3.4 pilots, 12 deep) |
| 4 | Small self-tapping screws (about M2, the horn's own) | Horn to plate, from behind (Ø 2.4 blind pilots) |
| 1 | M3 button-head screw (ISO 7380) | Plate to head, from the back |
| 4 | Self-adhesive rubber feet, Ø 10 | 1 mm recesses |
| - | Ballast, about 150 g (steel shot, washers) | The centre-of-mass estimate assumes 150 g |
| 1 | Quad Lock case (or adapter) on the phone | Phone with case modelled at 155 × 75 × 12 mm |
| 1 | Electrolytic capacitor, about 470 µF, 10 V or more | Servo supply decoupling |

## Wiring

```
USB-C 5 V breakout  +5V ──┬──────────────── servo V+ (red)
                          ├── 470 µF + ──┐
                          └── ESP32 5V/VIN
                    GND ──┴──────────────┴─ servo GND (brown) ── ESP32 GND
ESP32 PWM-capable GPIO ─────────────────── servo signal (orange)
```

- The servo takes its power from the 5 V rail, never from the ESP32's regulator.
- All grounds are common: breakout, servo and ESP32.
- The capacitor sits across the servo supply, close to the servo connector.
- Any LEDC-capable GPIO drives the signal (50 Hz, 500 to 2500 µs pulses); pick one that is not a strapping pin.

## Printing

PETG, 0.2 mm layers, no supports. `phone-stand.rhino.py` writes one STL per part into `phone-stand/stl/`, already in print orientation (generated, out of git); the STEP above slices too, oriented by hand:

| Part | On the bed |
|---|---|
| Base | Upside down, top face on the bed (its top edge is a 45 degree chamfer, not a round, for that) |
| Body | On its flat back face: the column's back is flush with the drum's, its half-round front rises from the bed |
| Plate | Dial face down |
| Index | On its side |
| Head | Lug face down: the vendor's print-in-place orientation, the only one the sleeve prints in without support |
| Lid | Flat |

Body and plate in warm white PETG (the head too, so it reads as part of the dial), the index alone in orange.

The head's sliding sleeve must come off the bed free: check that it moves before assembly.

## Assembly

1. Press the M3 heat-set inserts into the column foot (3) and around the base's lid recess (4). Press the index into the dial.
2. Push the 1/4"-20 nut sideways into its trap, from the ballast cavity.
3. Fill the ballast cavity, then screw the lid on (4 × M3).
4. Stick the rubber feet into their recesses.
5. Feed the servo's cable into the drum's pocket and down the column's channel, then slide the servo in from the front, shaft up and forward, and screw its flange onto the bulkhead (4 × M4 self-tapping).
6. Put the M3 button-head screw through the plate from the back, engage the head's two pins in the plate's holes, and screw the head on (thread-forming into its Ø 2.8 hole).
7. Screw the round horn onto the plate's back, in its recess, over that screw head (4 screws through the horn's holes into the blind pilots on the Ø 14 circle).
8. Drive the servo to 0 degrees (portrait), then press the plate and horn onto the spline with the index at the top notch, between the stop block's two sides.
9. Stand the column in its socket on the base and screw it from inside the bay (3 × M3 into the inserts).
10. Fit the USB-C breakout behind the back port and the ESP32 across the bay, and wire them (see [Wiring](#wiring)).
11. Sweep the full travel by hand, then by command: the tabs must stop on the block 5 degrees beyond each end, the dial must turn free in its shadow gap, and the phone must clear the base.

## Regenerating

`phone-stand.rhino.py` builds every part from its `P` parameters, every path relative to its own folder. In Rhino 8 or 9:

```
RunPythonScript <repository>/phone-stand/phone-stand.rhino.py
```

It writes `phone-stand.rhino.step` (the six parts alone, the servo and phone envelopes left out, turned half a turn about Z so the phone faces -Y, the repository's front) and `stl/`; `EXPORT=False` rebuilds the model without writing files. It prints a report and ends with `checks: all passed` or the list of what failed: solids' validity, the phone's clearance, the proportions, the servo against the body and through the bore, the stops and the whole dial against the body over the travel and beyond it, the ESP32 in the bay, the index and the head, the centre of mass and the tripod nut's position, every print under 220 mm. Then `nr build:parts` imports the new STEP, and `pnpm render phone-stand` draws it again.

<details>
<summary>Key figures</summary>

In the script's frame: mm, Z up, desk at Z = 0, phone facing +Y, rotation axis along Y at Z = 120 (98 above the base top).

| Y (mm) | What |
|---|---|
| -1.0 to 141.0 | Base, a disc of Ø 142 centred at Y = 70 |
| 8.0 | Body back: the drum's and the column's, one plane |
| 38.0 | Bulkhead front, servo flange seat |
| 53.9 | Servo top face |
| 60.4 to 66.4 | Plate (horn top at 61.9, seated in a 1.5 mm recess), its face flush with the drum's |
| 89.4 | Head front (lug face, 23 mm head) |
| 89.4 to 101.4 | Phone with case |

- Drum Ø 88, bore Ø 80; the servo flange's corner is at R 38.9, 1.1 mm inside the bore, so the servo goes in from the front.
- Dial Ø 78.5 in the bore: 0.75 mm shadow gap all round; the column stands in its socket with the same gap.
- Swept radius of the phone: 86.1 mm (half the diagonal of 155 × 75).
- Swept circle to the base top: 11.9 mm (8 required); to the desk, 33.9 mm.
- Stop tabs to the servo's top face: 1.5 mm.
- Head sleeve flange to the plate: 5.0 mm of free sleeve travel.
- Centre of mass (150 g ballast, 250 g phone): 75 mm from the base's back reference, 76 mm up, over the tripod nut.

</details>

## Verify before printing

- [ ] **Horn hole circle Ø 14** is a guess: measure the horn, then set `HORN_HOLE_BC` and `HORN_HOLE_D`.
- [ ] **MG996R flange** (holes 49.5 × 10, flange 27 from the bottom, shaft 10 from the end) is unconfirmed: measure the servo bought.
- [ ] **USB-C port** (`PWR_ZC`, 12.5 × 7 stadium) is placed for a generic breakout: check its height against the board bought, and how the board is held behind the curved back wall (glue or a printed clip).
- [ ] **Servo through the bore**: 1.1 mm of margin around the flange's corners; check that the servo bought, cable and connector included, goes in.
- [ ] **Dial shadow gap** (0.75 mm): check that the printed dial turns free in the bore with no rub, the stand on its side included.
- [ ] **Index press fit** (0.08 mm a side): check it holds, or glue it.
- [ ] **ESP32 flashing from below**: check that the DevKit's USB port is reachable through the bay with the stand on its back.
- [ ] **Head lugs versus the case** (`HEAD_SPIN`): at 0 the lugs sit on ±X and ±Z; check that the phone hangs square in portrait once twisted in.
- [ ] **Sleeve travel**: 5 mm in the model; check that it releases the case.
- [ ] **Print-in-place gap** (0.4 mm) of the head: check that the sleeve comes free on the printer and material used.
- [ ] **M3 thread-forming in a Ø 2.8 PETG hole**: check that it holds without splitting the head's boss.
- [ ] **Rotor held axially**: the plate and horn go onto the spline last, without the spline screw, so they stay on by the horn's clamp alone; check that they do not pull off.
- [ ] **Anti-rotation pins** (Ø 3, 2.5 mm): check that they survive the Quad Lock twist.
- [ ] **Direction**: the stops allow a counter-clockwise quarter turn from portrait, as seen by the user (the protocol's 0 to 90 degrees); the firmware maps the angle to the servo's pulse, so check the servo's sense once wired.

## Credits and licensing

The head is "Quadlock Mount (Locking Mechanism)" by **jimmysinkers**, [Thingiverse thing:3870880](https://www.thingiverse.com/thing:3870880), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). It remixes "Male Quad Lock Interface w/ Inventor File" by ryan_slam ([thing:2122826](https://www.thingiverse.com/thing:2122826)) and "Ortho-Planar Spring" by BYU_CMR ([thing:3007261](https://www.thingiverse.com/thing:3007261)). Its STEP is kept unmodified in [`vendor/quadlock-jimmysinkers/`](https://github.com/abernier/integral/tree/main/phone-stand/vendor/quadlock-jimmysinkers), with its licence notice; the Rhino script only imports it, places it and adds the two pins.

Quad Lock is a trademark of its owner; this head is a third-party compatible interface, not an official product. The Quad Lock interface is covered by patent US 9,243,739 B2 (Annex Products), with an estimated expiry in 2033: the printed head is meant for personal use, and anything commercial should use an official Quad Lock mount. This is not legal advice.
