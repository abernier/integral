# Phone stand

A motorized desk stand that turns a phone between portrait and landscape, aimed on a lockable ball joint, after Braun's product language, modelled in Rhino, printed in PETG.

![Phone stand, three-quarter front](https://abernier.github.io/integral/phone-stand/renders/phone-stand.three-quarter.webp)
![Phone stand, front](https://abernier.github.io/integral/phone-stand/renders/phone-stand.front.webp)
![Phone stand, side](https://abernier.github.io/integral/phone-stand/renders/phone-stand.side.webp)
![Phone stand, three-quarter back](https://abernier.github.io/integral/phone-stand/renders/phone-stand.back.webp)

<Intro>

A servo turns the phone a quarter turn about the axis through its screen's center, so that an app playing portrait and landscape media (a video feed) can turn the phone to match each one. The phone clips onto the turning dial through a Quad Lock compatible head; an ESP32 in the base drives the servo, and the app talks to it over Bluetooth Low Energy ([protocol](https://github.com/abernier/integral/blob/main/phone-stand/protocol.md); why: [ADR 0001](https://github.com/abernier/integral/blob/main/docs/adr/0001-phone-stand-web-bluetooth.md)). The model is Rhino's, not code: [`phone-stand.rhino.step`](https://github.com/abernier/integral/blob/main/phone-stand/phone-stand.rhino.step), ten named solids in mm, is its master geometry, written by the parametric Rhino script [`phone-stand.rhino.py`](https://github.com/abernier/integral/blob/main/phone-stand/phone-stand.rhino.py), and the build imports it as it is. No configurator: to change the stand, edit the script's parameters and run it again.

It is drawn after the Braun product language of the 1960s and 70s (Dieter Rams, Dietrich Lubs): circles and cylinders only, one body colour, and one accent on the one detail that does something, as the hand of Lubs' AB 1 alarm clock. A low disc base, a slim column with a flat back, and a drum that hides the servo; the turning plate is a dial set flush in the drum's face behind a 0.75 mm shadow gap, its orange index pointing at one of two notches in the rim, portrait or landscape. The proportions are simple ones: the base is φ times the drum (Ø 142 to Ø 88), the support under the drum one drum's diameter tall (88), the socket collar half one wide (44), and the column a drum's diameter over π (28). No fastener shows from the front or the sides; the one control, the joint's knob, and the one cable, 5 V on USB-C, are at the back.

The drum sits on a ball joint, so the screen can be aimed: tilted back or forward, swivelled left or right, then locked with one knob. The joint is under the servo, between the column and the drum, and nowhere else: the whole drum (servo, dial, head and phone) moves on the ball, so the servo still turns the phone about the axis through its screen's centre, wherever it points. A joint between the dial and the head would put the phone's quarter turn on a tilted head and swing it off-axis between portrait and landscape. The ball hangs from the drum's belly on a short neck; the column's collar is the socket; the knob at the back pushes a printed shoe onto the ball. The servo's lead runs down through the hollow ball.

**Status: modelled only.** Nothing has been printed or checked on the bench: read [Verify before printing](#verify-before-printing) first. The firmware and the app side do not exist yet.

</Intro>

[![Open in Buerligons](https://img.shields.io/badge/Open_in-Buerligons-c4553e)](https://buerligons.io/editor/?url=https://abernier.github.io/integral/phone-stand/phone-stand.ofb) [![download .ofb](https://img.shields.io/badge/download-.ofb-1f6feb)](https://abernier.github.io/integral/phone-stand/phone-stand.ofb) [![download STEP](https://img.shields.io/badge/download-STEP-238636)](https://abernier.github.io/integral/phone-stand/phone-stand.step) [![download GLB](https://img.shields.io/badge/download-GLB-8957e5)](https://abernier.github.io/integral/phone-stand/phone-stand.glb)

![Phone stand, from behind](https://abernier.github.io/integral/phone-stand/phone-stand.png)

| | |
|---|---|
| Material | PETG, 0.2 mm layers, no supports |
| Colour | warm white (every part, the head too) and orange (the index alone) |
| Size | Ø 142 × 198 mm; the phone sweeps a circle of R 86 about an axis 154 mm above the desk |
| Travel | 0 to 90 degrees, hard stops 5 degrees beyond each end |
| Aim | ball joint under the drum: tilt to 31 degrees in any direction (stopped by the neck on the socket's rim), swivel free all round, one knob locks all three axes |
| Parts | base, column, drum, ball, shoe, knob, plate, index, head, lid |
| Model | ClassCAD part imported from Rhino's STEP, 10 named bodies |
| Source | [`phone-stand.rhino.py`](https://github.com/abernier/integral/blob/main/phone-stand/phone-stand.rhino.py), Rhino 8 or 9, writes [`phone-stand.rhino.step`](https://github.com/abernier/integral/blob/main/phone-stand/phone-stand.rhino.step) |
| Engine | ClassCAD WASM 21.2, free plan (non-commercial) |

## Parts

| Part | What |
|---|---|
| Base | Low disc, Ø 142 × 22: electronics bay at the back (open to the bottom), the USB-C port, a round ballast cavity, 1/4"-20 tripod nut trap, rubber feet recesses, and the socket the column stands in |
| Lid | Round, closes the ballast cavity from below (4 × M3) |
| Column | The D-section column and the socket collar (Ø 44) on its top, in one piece: spherical socket, the lead's cone and channel down to the bay, the knob's M4 insert and the shoe's bore at the back; screwed onto the base from inside the bay (3 × M3) |
| Drum | Ø 88 × 58: the servo goes in from the front and screws by its flange onto a bulkhead inside; carries the stop block; a round recess in its belly takes the ball's flange (2 × M3 from below) |
| Ball | Hollow ball Ø 24 (bore Ø 10.5) on a Ø 14 neck, with a flange that screws under the drum; its bottom cut flat to print upright |
| Shoe | The pad between the knob's screw and the ball, its face the socket's sphere; set above the ball's equator, it also keeps the ball in the socket when the knob is loose |
| Knob | Ø 12 knurled knob at the back of the collar, an M4 × 6 hex head pressed into it |
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
| 9 | M3 heat-set inserts (Ø 4 hole, 6 deep) | 3 in the column foot, 4 around the lid, 2 in the drum's belly |
| 9 | M3 screws | 3 base to column (from inside the bay), 4 lid, 2 × M3 × 8 socket head ball flange to drum (from below) |
| 1 | M4 heat-set insert (Ø 5.6 hole, 5 deep) | In the collar's back wall, for the knob |
| 1 | M4 × 6 hex head screw (ISO 4017) | Pressed head first into the knob; pushes the shoe |
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
| Column | Upside down, the collar's top face on the bed: the socket narrows away from the bed at 45 degrees at most, the lead's cone widens away from it |
| Drum | On its flat back face |
| Ball | Upright, on its flat bottom: the flat is cut where the sphere would overhang past 45 degrees, and the flange rises from the neck on a 45 degree cone. 100 % infill or 4+ walls: it takes the clamp |
| Shoe | On its flat back, concave face up |
| Knob | On its back face, hex pocket up |
| Plate | Dial face down |
| Index | On its side |
| Head | Lug face down: the vendor's print-in-place orientation, the only one the sleeve prints in without support |
| Lid | Flat |

Every part in warm white PETG (the head too, so it reads as part of the dial; the ball and the knob too), the index alone in orange.

The head's sliding sleeve must come off the bed free: check that it moves before assembly.

## Assembly

1. Press the M3 heat-set inserts into the column foot (3), around the base's lid recess (4) and into the drum's belly (2), the M4 insert into the collar's back wall, and the index into the dial.
2. Push the 1/4"-20 nut sideways into its trap, from the ballast cavity.
3. Fill the ballast cavity, then screw the lid on (4 × M3).
4. Stick the rubber feet into their recesses.
5. Screw the ball's flange into the recess in the drum's belly (2 × M3 × 8, from below).
6. Feed the servo's lead, plug first, into the drum's pocket, down the hole in its belly and through the hollow ball, then slide the servo in from the front, shaft up and forward, and screw its flange onto the bulkhead (4 × M4 self-tapping).
7. Put the M3 button-head screw through the plate from the back, engage the head's two pins in the plate's holes, and screw the head on (thread-forming into its Ø 2.8 hole).
8. Screw the round horn onto the plate's back, in its recess, over that screw head (4 screws through the horn's holes into the blind pilots on the Ø 14 circle).
9. Drive the servo to 0 degrees (portrait), then press the plate and horn onto the spline with the index at the top notch, between the stop block's two sides.
10. Press the M4 × 6 screw head first into the knob's hex pocket. Drop the shoe into its bore from inside the socket, concave face toward the centre, and run the knob into the insert from the back until the screw's tip just reaches the shoe.
11. Thread the lead down through the socket, its cone and the column's channel, set the ball into the socket, and turn the knob finger-tight.
12. Stand the column in its socket on the base and screw it from inside the bay (3 × M3 into the inserts).
13. Fit the USB-C breakout behind the back port and the ESP32 across the bay, and wire them (see [Wiring](#wiring)).
14. Sweep the full travel by hand, then by command: the tabs must stop on the block 5 degrees beyond each end, the dial must turn free in its shadow gap, and the phone must clear the base. Then, knob loose, aim the drum through its whole cone and all round: the lead must slide free in the ball, and the neck must stop on the rim before anything else touches.

## Regenerating

`phone-stand.rhino.py` builds every part from its `P` parameters, every path relative to its own folder. In Rhino 8 or 9:

```
RunPythonScript <repository>/phone-stand/phone-stand.rhino.py
```

It writes `phone-stand.rhino.step` (the ten parts alone, the servo and phone envelopes left out, turned half a turn about Z so the phone faces -Y, the repository's front) and `stl/`; `EXPORT=False` rebuilds the model without writing files. It prints a report and ends with `checks: all passed` or the list of what failed: solids' validity, the phone's clearance, the proportions, the servo against the drum and through the bore, the stops and the whole dial against the drum over the travel and beyond it, the ESP32 in the bay, the index and the head, the ball joint (parts apart at rest, the tilt stop in every direction, the drum clear of the column and the knob up to the stop, the phone's swept disc above the base over the whole cone, the servo lead's path unpinched), the holding torque, the centre of mass over every aim and the tripod nut's position, every print under 220 mm. Then `nr build:parts` imports the new STEP, and `pnpm render phone-stand` draws it again.

<details>
<summary>Key figures</summary>

In the script's frame: mm, Z up, desk at Z = 0, phone facing +Y, rotation axis along Y at Z = 154 (132 above the base top), ball centre at Y = 23, Z = 86.

| Y (mm) | What |
|---|---|
| -9.0 to 0.0 | Knob, its axis 1.5 above the ball centre |
| -1.0 to 141.0 | Base, a disc of Ø 142 centred at Y = 70 |
| 1.0 to 45.0 | Socket collar, Ø 44 about the ball centre |
| 8.0 | Drum back, and the column's flat back |
| 38.0 | Bulkhead front, servo flange seat |
| 53.9 | Servo top face |
| 60.4 to 66.4 | Plate (horn top at 61.9, seated in a 1.5 mm recess), its face flush with the drum's |
| 89.4 | Head front (lug face, 23 mm head) |
| 89.4 to 101.4 | Phone with case |

- Drum Ø 88, bore Ø 80; the servo flange's corner is at R 38.9, 1.1 mm inside the bore, so the servo goes in from the front.
- Dial Ø 78.5 in the bore: 0.75 mm shadow gap all round; the column stands in its socket with the same gap.
- Swept radius of the phone: 86.1 mm (half the diagonal of 155 × 75).
- Ball joint: ball Ø 24 in a Ø 24.3 socket, bore Ø 10.5, neck Ø 14, centre 24 below the drum; the rim stands 6.6 above the centre, so the neck stops the tilt at 31 degrees in any direction (required: 15 forward, 30 back). Swivel: free all round (required ±45).
- Swept circle to the base top: 45.9 at rest; 26.2 tilted 15 forward, 81.5 tilted 30 back; 8.1 at worst, tilted the full 31 forward (8 required).
- Gravity moment on the ball (phone 250 g, drum side about 530 g in all): 0.28 N m at most over the required range, 0.33 N m over the whole cone; a 3 N tap on the phone's top edge adds 0.50 N m.
- Holding torque, estimated: a finger-tight 0.25 N m on the knob gives the M4 screw about 310 N (nut factor 0.2); the shoe and the socket's front each press the ball with it, so μ × 2F × R = 0.3 × 620 N × 12 mm ≈ 2.2 N m: 6.8 times the worst gravity moment, 4.5 times a tap.
- Tip-over (150 g ballast, 780 g in all): over the required range (pitch -15 to +30, swivel ±45) the centre of mass stays 45 mm inside the base's rim at worst, and 17 mm inside the feet's square. Turned all the way round (swivel 180, the phone behind, tilted 31) it is still 5 mm inside the rim, but outside the feet past about ±75 degrees of swivel: the stand rocks onto its rim there.
- Centre of mass at rest: 74 mm from the base's back reference, 96 mm up, over the tripod nut.

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
- [ ] **Ball friction**: the holding torque assumes μ 0.3 PETG on PETG and a 0.25 N m finger turn; check that the drum holds the phone tilted 31 degrees forward, and against a tap, without creeping overnight (PETG creeps under a steady clamp; a thin TPU or cork liner in the socket is the fallback).
- [ ] **Ball and socket fit** (0.15 mm on the radius): check that the printed ball turns free with the knob loose, the seam and the flat bottom included, and that it does not rattle.
- [ ] **Shoe**: check that it slides in its bore, and that above the ball's equator it keeps the ball in when the stand is lifted by the drum with the knob loose.
- [ ] **M4 insert in the collar's back wall** (5 deep, 9.9 mm of wall behind the socket): check that it takes the knob's torque without spinning, and that the M4 × 6 screw's tip reaches the shoe before the knob reaches the collar (1 mm gap).
- [ ] **Servo lead through the ball**: check that the JR plug goes through the Ø 10.5 bore and that the lead slides free over the whole cone (modelled as a Ø 4 envelope); it flexes by up to 31 degrees at the ball's exit at every aim.
- [ ] **Ball flange under the drum** (2 × M3 into inserts in the belly): check that it holds the drum's moment without the inserts pulling out.
- [ ] **Stability turned round**: the centre of mass stays over the feet up to about ±75 degrees of swivel at any tilt, and only over the rim beyond; check it on the desk, and add ballast if it rocks.
- [ ] **Direction**: the stops allow a counter-clockwise quarter turn from portrait, as seen by the user (the protocol's 0 to 90 degrees); the firmware maps the angle to the servo's pulse, so check the servo's sense once wired.

## Credits and licensing

The head is "Quadlock Mount (Locking Mechanism)" by **jimmysinkers**, [Thingiverse thing:3870880](https://www.thingiverse.com/thing:3870880), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). It remixes "Male Quad Lock Interface w/ Inventor File" by ryan_slam ([thing:2122826](https://www.thingiverse.com/thing:2122826)) and "Ortho-Planar Spring" by BYU_CMR ([thing:3007261](https://www.thingiverse.com/thing:3007261)). Its STEP is kept unmodified in [`vendor/quadlock-jimmysinkers/`](https://github.com/abernier/integral/tree/main/phone-stand/vendor/quadlock-jimmysinkers), with its licence notice; the Rhino script only imports it, places it and adds the two pins.

Quad Lock is a trademark of its owner; this head is a third-party compatible interface, not an official product. The Quad Lock interface is covered by patent US 9,243,739 B2 (Annex Products), with an estimated expiry in 2033: the printed head is meant for personal use, and anything commercial should use an official Quad Lock mount. This is not legal advice.
