# Phone stand

A motorized desk stand that turns a phone between portrait and landscape, modelled in Rhino, printed in PETG.

![Phone stand, three-quarter front](https://abernier.github.io/integral/phone-stand/renders/phone-stand.three-quarter.webp)
![Phone stand, front](https://abernier.github.io/integral/phone-stand/renders/phone-stand.front.webp)
![Phone stand, side](https://abernier.github.io/integral/phone-stand/renders/phone-stand.side.webp)
![Phone stand, three-quarter back](https://abernier.github.io/integral/phone-stand/renders/phone-stand.back.webp)

<Intro>

A servo turns the phone a quarter turn about the axis through its screen's center, so that an app playing portrait and landscape media (a video feed) can turn the phone to match each one. The phone clips onto the turning plate through a Quad Lock compatible head; an ESP32 in the base drives the servo, and the app talks to it over Bluetooth Low Energy ([protocol](https://github.com/abernier/integral/blob/main/phone-stand/protocol.md); why: [ADR 0001](https://github.com/abernier/integral/blob/main/docs/adr/0001-phone-stand-web-bluetooth.md)). The model is Rhino's, not code: [`phone-stand.rhino.step`](https://github.com/abernier/integral/blob/main/phone-stand/phone-stand.rhino.step), five named solids in mm, is its master geometry, written by the parametric Rhino script [`phone-stand.rhino.py`](https://github.com/abernier/integral/blob/main/phone-stand/phone-stand.rhino.py), and the build imports it as it is. No configurator: to change the stand, edit the script's parameters and run it again.

**Status: modelled only.** Nothing has been printed or checked on the bench: read [Verify before printing](#verify-before-printing) first. The firmware and the app side do not exist yet.

</Intro>

[![Open in Buerligons](https://img.shields.io/badge/Open_in-Buerligons-c4553e)](https://buerligons.io/editor/?url=https://abernier.github.io/integral/phone-stand/phone-stand.ofb) [![download .ofb](https://img.shields.io/badge/download-.ofb-1f6feb)](https://abernier.github.io/integral/phone-stand/phone-stand.ofb) [![download STEP](https://img.shields.io/badge/download-STEP-238636)](https://abernier.github.io/integral/phone-stand/phone-stand.step) [![download GLB](https://img.shields.io/badge/download-GLB-8957e5)](https://abernier.github.io/integral/phone-stand/phone-stand.glb)

![Phone stand, from behind](https://abernier.github.io/integral/phone-stand/phone-stand.png)

| | |
|---|---|
| Material | PETG, 0.2 mm layers, no supports |
| Size | 130 × 115 × 148 mm; the phone sweeps a circle of R 86 about an axis 121 mm above the desk |
| Travel | 0 to 90 degrees, hard stops 5 degrees beyond each end |
| Parts | base, tower, plate, head, lid |
| Model | ClassCAD part imported from Rhino's STEP, 5 named bodies |
| Source | [`phone-stand.rhino.py`](https://github.com/abernier/integral/blob/main/phone-stand/phone-stand.rhino.py), Rhino 8 or 9, writes [`phone-stand.rhino.step`](https://github.com/abernier/integral/blob/main/phone-stand/phone-stand.rhino.step) |
| Engine | ClassCAD WASM 21.2, free plan (non-commercial) |

## Parts

| Part | What |
|---|---|
| Base | Electronics bay (open to the bottom), ballast cavity, 1/4"-20 tripod nut trap, rubber feet recesses |
| Lid | Closes the ballast cavity (4 × M3) |
| Tower | Holds the servo by its flange, carries the stop block; screwed onto the base (4 × M3) |
| Plate | Turning disc bolted to the servo horn, carries the two stop tabs |
| Head | Quad Lock compatible head (vendor STEP, see [Credits](#credits-and-licensing)) with two anti-rotation pins on its back |

The head and the plate are two parts on purpose. The head is a print-in-place mechanism: a fixed core and a sliding release sleeve joined by a printed spring. Its sleeve must stay free to travel back toward the plate, and a fused head and plate would have no support-free print orientation. One M3 button-head screw from the plate's back holds the head; two pins take the twist torque.

## Bill of materials

| Qty | Item | Note |
|---|---|---|
| 1 | MG996R-class metal-gear servo, with round horn | Modelled at 40.7 × 19.7 × 42.9 mm, horn Ø 20 |
| 1 | ESP32 DevKit | Slot sized 56 × 29 × 15 mm |
| 1 | 5 V 2 A USB-C power breakout | Opening 12 × 10 mm in the back wall |
| 1 | 1/4"-20 hex nut | 11.1 mm across flats, 5.6 mm thick |
| 8 | M3 heat-set inserts (Ø 4 hole, 6 deep) | 4 in the tower foot, 4 around the lid |
| 8 | M3 screws | 4 base to tower (from inside the bay), 4 lid |
| 4 | M4 self-tapping screws | Servo flange into the tower (Ø 3.4 pilots, 12 deep) |
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
| Base | Upside down, top face on the bed |
| Tower | On its back face |
| Plate | Front (head) face down |
| Head | Lug face down: the vendor's print-in-place orientation, the only one the sleeve prints in without support |
| Lid | Flat |

The head's sliding sleeve must come off the bed free: check that it moves before assembly.

## Assembly

1. Press the M3 heat-set inserts into the tower foot (4) and around the base's lid recess (4).
2. Push the 1/4"-20 nut sideways into its trap, from the ballast cavity.
3. Fill the ballast cavity, then screw the lid on (4 × M3).
4. Stick the rubber feet into their recesses.
5. Slide the servo into the tower's pocket, shaft up, cable out through the back and down the cable channel. Screw the flange on (4 × M4 self-tapping).
6. Fit the round horn on the spline at mid-travel, then drive the servo to 0 degrees (portrait) before fixing the plate.
7. Seat the horn in the plate's recess and bolt the plate to the horn through the 4 holes on the Ø 14 circle.
8. Put the M3 button-head screw through the plate from the back, engage the head's two pins in the plate's holes, and screw the head on (thread-forming into its Ø 2.8 hole).
9. Set the tower into its recess on the base and screw it from inside the bay (4 × M3 into the inserts).
10. Fit the ESP32 and the USB-C breakout against their back-wall openings and wire them (see [Wiring](#wiring)).
11. Sweep the full travel by hand, then by command: the tabs must stop on the block 5 degrees beyond each end, and the phone must clear the base.

## Regenerating

`phone-stand.rhino.py` builds every part from its `P` parameters, every path relative to its own folder. In Rhino 8 or 9:

```
RunPythonScript <repository>/phone-stand/phone-stand.rhino.py
```

It writes `phone-stand.rhino.step` (the five parts alone, the servo and phone envelopes left out, turned half a turn about Z so the phone faces -Y, the repository's front) and `stl/`; `EXPORT=False` rebuilds the model without writing files. It prints a report: solids' validity, clearances, the stops over the travel, the centre of mass and the tripod nut's position. Then `nr build:parts` imports the new STEP, and `pnpm render phone-stand` draws it again.

<details>
<summary>Key figures</summary>

In the script's frame: mm, Z up, desk at Z = 0, phone facing +Y, rotation axis along Y at Z = 121 (96 above the base top).

| Y (mm) | What |
|---|---|
| 8.0 | Tower back |
| 38.0 | Tower front, servo flange seat |
| 53.9 | Servo top face |
| 60.4 to 66.4 | Plate (horn top at 61.9, seated in a 1.5 mm recess) |
| 89.4 | Head front (lug face, 23 mm head) |
| 89.4 to 101.4 | Phone with case |

- Swept radius of the phone: 86.1 mm (half the diagonal of 155 × 75).
- Swept circle to the base top: 9.9 mm (8 required); to the desk, 34.9 mm.
- Stop tabs to the servo's top face: 1.5 mm.
- Head sleeve flange to the plate: 5.0 mm of free sleeve travel.
- Centre of mass (150 g ballast, 250 g phone): 76 mm from the base's back edge, over the tripod nut.

</details>

## Verify before printing

- [ ] **Horn hole circle Ø 14** is a guess: measure the horn, then set `HORN_HOLE_BC` and `HORN_HOLE_D`.
- [ ] **MG996R flange** (holes 49.5 × 10, flange 27 from the bottom, shaft 10 from the end) is unconfirmed: measure the servo bought.
- [ ] **USB opening heights** in the base's back wall (`USB_OPEN_Z`, `PWR_Z0`) are approximate: check them against the ESP32 and the breakout.
- [ ] **Head lugs versus the case** (`HEAD_SPIN`): at 0 the lugs sit on ±X and ±Z; check that the phone hangs square in portrait once twisted in.
- [ ] **Sleeve travel**: 5 mm in the model; check that it releases the case.
- [ ] **Print-in-place gap** (0.4 mm) of the head: check that the sleeve comes free on the printer and material used.
- [ ] **M3 thread-forming in a Ø 2.8 PETG hole**: check that it holds without splitting the head's boss.
- [ ] **Rotor held axially**: the head covers the servo's spline screw, so the horn stays on the spline by its clamp alone; check that it does not pull off.
- [ ] **Anti-rotation pins** (Ø 3, 2.5 mm): check that they survive the Quad Lock twist.
- [ ] **Direction**: the stops allow a counter-clockwise quarter turn from portrait, as seen by the user (the protocol's 0 to 90 degrees); the firmware maps the angle to the servo's pulse, so check the servo's sense once wired.

## Credits and licensing

The head is "Quadlock Mount (Locking Mechanism)" by **jimmysinkers**, [Thingiverse thing:3870880](https://www.thingiverse.com/thing:3870880), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). It remixes "Male Quad Lock Interface w/ Inventor File" by ryan_slam ([thing:2122826](https://www.thingiverse.com/thing:2122826)) and "Ortho-Planar Spring" by BYU_CMR ([thing:3007261](https://www.thingiverse.com/thing:3007261)). Its STEP is kept unmodified in [`vendor/quadlock-jimmysinkers/`](https://github.com/abernier/integral/tree/main/phone-stand/vendor/quadlock-jimmysinkers), with its licence notice; the Rhino script only imports it, places it and adds the two pins.

Quad Lock is a trademark of its owner; this head is a third-party compatible interface, not an official product. The Quad Lock interface is covered by patent US 9,243,739 B2 (Annex Products), with an estimated expiry in 2033: the printed head is meant for personal use, and anything commercial should use an official Quad Lock mount. This is not legal advice.
