# Phone stand

A motorized desk stand that turns a phone between portrait and landscape, aimed on a lockable ball joint, after Braun's product language, modelled in Rhino, printed in PETG.

![Phone stand, three-quarter front](https://abernier.github.io/integral/phone-stand/renders/phone-stand.three-quarter.webp)
![Phone stand, front](https://abernier.github.io/integral/phone-stand/renders/phone-stand.front.webp)
![Phone stand, side](https://abernier.github.io/integral/phone-stand/renders/phone-stand.side.webp)
![Phone stand, three-quarter back](https://abernier.github.io/integral/phone-stand/renders/phone-stand.back.webp)

<Intro>

A servo turns the phone a quarter turn about the axis through its screen's center, so that an app playing portrait and landscape media (a video feed) can turn the phone to match each one. The phone clips onto the turning dial through a Quad Lock compatible head; an ESP32 in the base drives the servo, and the app talks to it over Bluetooth Low Energy ([protocol](https://github.com/abernier/integral/blob/main/phone-stand/protocol.md); why: [ADR 0001](https://github.com/abernier/integral/blob/main/docs/adr/0001-phone-stand-web-bluetooth.md)). The model is Rhino's, not code: [`phone-stand.rhino.step`](https://github.com/abernier/integral/blob/main/phone-stand/phone-stand.rhino.step), ten named solids in mm, is its master geometry, written by the parametric Rhino script [`phone-stand.rhino.py`](https://github.com/abernier/integral/blob/main/phone-stand/phone-stand.rhino.py), and the build imports it as it is. No configurator: to change the stand, edit the script's parameters and run it again.

It is drawn after the Braun product language of the 1960s and 70s (Dieter Rams, Dietrich Lubs): circles and cylinders only, one body colour, and one accent on the one detail that does something, as the hand of Lubs' AB 1 alarm clock. Three primitives: a low disc base, a column, and a drum that hides the servo; the turning plate is a dial set flush in the drum's face behind a 0.75 mm shadow gap, its orange index pointing at one of two notches in the rim, portrait or landscape. The column is the ball's socket: one plain cylinder from the base to the rim, no collar, no step. The same 0.75 mm shadow gap rings the dial in the drum, the column in the base and the ball's flange in the drum's belly. The proportions follow one rule each: the base is φ times the drum (Ø 142 to Ø 88), the column half the drum (Ø 44, as wide as the socket, the shoe and the knob's insert need), and the height is not chosen but found: the lowest axis that keeps the phone 8 mm above the base at the forward stop, 181 mm overall, which lands on √φ times the base. No fastener shows from the front or the sides; the one control, the joint's knob, its top in line with the column's, and the one cable, 5 V on USB-C, are at the back.

The drum sits on a ball joint, so the screen can be aimed: tilted back or forward, swivelled left or right, then locked with one knob. The joint is under the servo, between the column and the drum, and nowhere else: the whole drum (servo, dial, head and phone) moves on the ball, so the servo still turns the phone about the axis through its screen's centre, wherever it points. A joint between the dial and the head would put the phone's quarter turn on a tilted head and swing it off-axis between portrait and landscape. The ball hangs from the drum's belly on a short neck; the column's top is the socket; the knob at the back pushes a printed shoe onto the ball. The tilt stop is asymmetric: the neck sits 1.6 mm ahead of the ball's centre, so its front meets the socket's rim at 15.5 degrees forward and its back at 31 degrees back. A symmetric stop wide enough for the back tilt would let the phone swing as far forward, and the axis would have to rise 17 mm to keep the phone off the base: that is the height this design wins back. The offset turns with the drum, so the stops hold at any swivel. The servo's lead runs down through the hollow ball.

**Status: modelled only.** Nothing has been printed or checked on the bench: read [Verify before printing](#verify-before-printing) first. The firmware and the app side do not exist yet.

</Intro>

[![Open in Buerligons](https://img.shields.io/badge/Open_in-Buerligons-c4553e)](https://buerligons.io/editor/?url=https://abernier.github.io/integral/phone-stand/phone-stand.ofb) [![download .ofb](https://img.shields.io/badge/download-.ofb-1f6feb)](https://abernier.github.io/integral/phone-stand/phone-stand.ofb) [![download STEP](https://img.shields.io/badge/download-STEP-238636)](https://abernier.github.io/integral/phone-stand/phone-stand.step) [![download GLB](https://img.shields.io/badge/download-GLB-8957e5)](https://abernier.github.io/integral/phone-stand/phone-stand.glb)

![Phone stand, from behind](https://abernier.github.io/integral/phone-stand/phone-stand.png)

| | |
|---|---|
| Material | PETG, 0.2 mm layers, no supports |
| Colour | warm white (every part, the head too) and orange (the index alone) |
| Size | Ø 142 × 181 mm; the phone sweeps a circle of R 86 about an axis 137 mm above the desk |
| Travel | 0 to 90 degrees, hard stops 5 degrees beyond each end |
| Aim | ball joint under the drum: tilt 31 degrees back, 15.5 forward, 22 sideways (stopped by the off-centre neck on the socket's rim), swivel free all round, one knob locks all three axes |
| Parts | base, column, drum, ball, shoe, knob, plate, index, head, lid |
| Model | ClassCAD part imported from Rhino's STEP, 10 named bodies |
| Source | [`phone-stand.rhino.py`](https://github.com/abernier/integral/blob/main/phone-stand/phone-stand.rhino.py), Rhino 8 or 9, writes [`phone-stand.rhino.step`](https://github.com/abernier/integral/blob/main/phone-stand/phone-stand.rhino.step) |
| Engine | ClassCAD WASM 21.2, free plan (non-commercial) |

## Parts

| Part | What |
|---|---|
| Base | Low disc, Ø 142 × 22: electronics bay at the back (open to the bottom), the USB-C port, a round ballast cavity, 1/4"-20 tripod nut trap, rubber feet recesses, and the socket the column stands in |
| Lid | Round, closes the ballast cavity from below (4 × M3) |
| Column | Ø 44 cylinder, the ball's socket sunk in its top: spherical socket, the lead's cone and channel down its axis to the bay, the knob's M4 insert and the shoe's bore at the back; screwed onto the base from inside the bay (3 × M3) |
| Drum | Ø 88 × 58: the servo goes in from the front and screws by its flange onto a bulkhead inside; carries the stop block; a round recess in its belly takes the ball's flange (2 × M3 from below) |
| Ball | Hollow ball Ø 24 on a Ø 16 neck set 1.6 mm ahead of its centre (the bore, Ø 10.5, and the flange on the neck's axis), the flange screwing under the drum; its bottom cut flat to print upright |
| Shoe | The pad between the knob's screw and the ball, its face the socket's sphere; set above the ball's equator, it also keeps the ball in the socket when the knob is loose |
| Knob | Ø 16 × 6 fluted knob at the back of the column, its top in line with the column's, an M4 × 6 hex head pressed into it |
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
| 1 | M4 heat-set insert (Ø 5.6 hole, 5 deep) | In the column's back wall, for the knob |
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
| Column | Upside down, its top face on the bed: the socket narrows away from the bed at 45 degrees at most, the lead's cone widens away from it |
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

1. Press the M3 heat-set inserts into the column foot (3), around the base's lid recess (4) and into the drum's belly (2), the M4 insert into the column's back wall, and the index into the dial.
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
14. Sweep the full travel by hand, then by command: the tabs must stop on the block 5 degrees beyond each end, the dial must turn free in its shadow gap, and the phone must clear the base. Then, knob loose, aim the drum through its whole range and all round: the lead must slide free in the ball, and the neck must stop on the rim, 31 degrees back and 15.5 forward, before anything else touches.

## Regenerating

`phone-stand.rhino.py` builds every part from its `P` parameters, every path relative to its own folder. In Rhino 8 or 9:

```
RunPythonScript <repository>/phone-stand/phone-stand.rhino.py
```

It writes `phone-stand.rhino.step` (the ten parts alone, the servo and phone envelopes left out, turned half a turn about Z so the phone faces -Y, the repository's front) and `stl/`; `EXPORT=False` rebuilds the model without writing files. It prints a report and ends with `checks: all passed` or the list of what failed: solids' validity, the phone's clearance, the proportions, the servo against the drum and through the bore, the stops and the whole dial against the drum over the travel and beyond it, the ESP32 in the bay, the index and the head, the ball joint (parts apart at rest, the stops where designed and beyond the required tilt, the tilt stop in every direction and at every swivel against the shoe, the drum clear of the column and the knob up to the stop at every swivel, the phone's swept disc above the base over the whole range, the servo lead's path unpinched), the holding torque, the centre of mass over every aim and the tripod nut's position, every print under 220 mm. Then `nr build:parts` imports the new STEP, and `pnpm render phone-stand` draws it again.

<details>
<summary>Key figures</summary>

In the script's frame: mm, Z up, desk at Z = 0, phone facing +Y, rotation axis along Y at Z = 137 (115 above the base top), ball centre at Y = 22, Z = 69.

| Y (mm) | What |
|---|---|
| -7.0 to -1.0 | Knob, its axis 1.5 above the ball centre, its top at the column's top (Z 78.5) |
| -5.0 to 137.0 | Base, a disc of Ø 142 centred at Y = 66 |
| 0.0 to 44.0 | Column, Ø 44 about the ball centre, Z 21 to 78.5 |
| 8.0 | Drum back |
| 38.0 | Bulkhead front, servo flange seat |
| 53.9 | Servo top face |
| 60.4 to 66.4 | Plate (horn top at 61.9, seated in a 1.5 mm recess), its face flush with the drum's |
| 89.4 | Head front (lug face, 23 mm head) |
| 89.4 to 101.4 | Phone with case |

- Drum Ø 88, bore Ø 80; the servo flange's corner is at R 38.9, 1.1 mm inside the bore, so the servo goes in from the front.
- Dial Ø 78.5 in the bore: 0.75 mm shadow gap all round; the column stands in its socket in the base, and the ball's flange in its recess in the drum's belly, behind the same gap.
- Swept radius of the phone: 86.1 mm (half the diagonal of 155 × 75).
- Proportions: base Ø 142 = φ × drum Ø 88; column Ø 44 = drum Ø / 2; height 181 ≈ √φ × base Ø (180.6), found, not chosen. The column shows 56.5 above the base, and 14.5 of neck between its top and the drum.
- Ball joint: ball Ø 24 in a Ø 24.3 socket, centre 24 below the drum; neck Ø 16, its axis (and the bore's, Ø 10.5) 1.62 ahead of the ball's centre; the rim stands 7.83 above the centre. The neck's front meets the rim at 15.5 degrees forward, its back at 31 back, its side at 22.3 sideways (required: 15 forward, 30 back). Swivel: free all round (required ±45). The pivot stays behind the bulkhead: the ball's flange needs the drum's solid back to screw into, the bore below the servo leaves a 4 mm wall.
- Why 137: tilted forward, the phone's swept disc drops by its offset ahead of the ball (79 mm) times the sine of the tilt, so the forward stop, not the back one, sets the height. At 15.5 forward the disc stays 8.3 above the base (8 required); 9.0 at the required 15; 65.0 tilted 30 back; 28.9 at rest. A symmetric 31 degree stop would need the axis at 154.
- Gravity moment on the ball (phone 250 g, drum side about 530 g in all): 0.28 N m at most over the required range and over the whole physical range; a 3 N tap on the phone's top edge adds 0.50 N m.
- Holding torque, estimated: a finger-tight 0.25 N m on the knob gives the M4 screw about 310 N (nut factor 0.2); the shoe and the socket's front each press the ball with it, so μ × 2F × R = 0.3 × 620 N × 12 mm ≈ 2.2 N m: 8.0 times the worst gravity moment, 4.5 times a tap.
- Tip-over (150 g ballast, 790 g in all): over the required range (pitch -15 to +30, swivel ±45) the centre of mass stays 45 mm inside the base's rim at worst, and 17 mm inside the feet's square. Turned all the way round (swivel 180, the phone behind, tilted to the stop) it is still 14 mm inside the rim, but outside the feet's square: the stand rocks onto its rim there.
- Centre of mass at rest: 72 mm from the base's back reference, 85 mm up, over the tripod nut (Y 74).

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
- [ ] **Ball friction**: the holding torque assumes μ 0.3 PETG on PETG and a 0.25 N m finger turn; check that the drum holds the phone tilted 15.5 degrees forward and 31 back, and against a tap, without creeping overnight (PETG creeps under a steady clamp; a thin TPU or cork liner in the socket is the fallback).
- [ ] **Ball and socket fit** (0.15 mm on the radius): check that the printed ball turns free with the knob loose, the seam and the flat bottom included, and that it does not rattle.
- [ ] **Shoe**: check that it slides in its bore, and that above the ball's equator it keeps the ball in when the stand is lifted by the drum with the knob loose.
- [ ] **M4 insert in the column's back wall** (5 deep, 9.9 mm of wall behind the socket): check that it takes the knob's torque without spinning, and that the M4 × 6 screw's tip reaches the shoe before the knob reaches the column (1 mm gap).
- [ ] **Servo lead through the ball**: check that the JR plug goes through the Ø 10.5 bore and that the lead slides free over the whole range (modelled as a Ø 4 envelope); it flexes by up to 31 degrees at the ball's exit.
- [ ] **Ball flange under the drum** (2 × M3 into inserts in the belly): check that it holds the drum's moment without the inserts pulling out.
- [ ] **Stability turned round**: inside the required range the centre of mass stays over the feet; turned all the way round it is only over the rim; check it on the desk, and add ballast if it rocks.
- [ ] **Asymmetric stop**: the neck's 1.6 mm offset sets the forward stop at 15.5 degrees with 0.3 mm of clearance under the phone to spare (8.3 for 8); check the printed neck and rim (a fat seam on the neck's front stops it sooner, which is safe; a thin one later, which costs clearance), and that the phone's corner never touches the base tilted fully forward mid-turn.
- [ ] **Direction**: the stops allow a counter-clockwise quarter turn from portrait, as seen by the user (the protocol's 0 to 90 degrees); the firmware maps the angle to the servo's pulse, so check the servo's sense once wired.

## Credits and licensing

The head is "Quadlock Mount (Locking Mechanism)" by **jimmysinkers**, [Thingiverse thing:3870880](https://www.thingiverse.com/thing:3870880), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). It remixes "Male Quad Lock Interface w/ Inventor File" by ryan_slam ([thing:2122826](https://www.thingiverse.com/thing:2122826)) and "Ortho-Planar Spring" by BYU_CMR ([thing:3007261](https://www.thingiverse.com/thing:3007261)). Its STEP is kept unmodified in [`vendor/quadlock-jimmysinkers/`](https://github.com/abernier/integral/tree/main/phone-stand/vendor/quadlock-jimmysinkers), with its licence notice; the Rhino script only imports it, places it and adds the two pins.

Quad Lock is a trademark of its owner; this head is a third-party compatible interface, not an official product. The Quad Lock interface is covered by patent US 9,243,739 B2 (Annex Products), with an estimated expiry in 2033: the printed head is meant for personal use, and anything commercial should use an official Quad Lock mount. This is not legal advice.
