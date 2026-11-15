# Pan-tilt phone stand

The phone stand with its ball joint replaced by two serial bus servos: it aims the phone left and right, back and forward, and still turns it between portrait and landscape, after Braun's product language, modelled in Rhino, printed in PETG.

![Pan-tilt phone stand, three-quarter front](https://abernier.github.io/integral/phone-stand-pan-tilt/renders/phone-stand-pan-tilt.three-quarter.webp)
![Pan-tilt phone stand, front](https://abernier.github.io/integral/phone-stand-pan-tilt/renders/phone-stand-pan-tilt.front.webp)
![Pan-tilt phone stand, side](https://abernier.github.io/integral/phone-stand-pan-tilt/renders/phone-stand-pan-tilt.side.webp)
![Pan-tilt phone stand, three-quarter back](https://abernier.github.io/integral/phone-stand-pan-tilt/renders/phone-stand-pan-tilt.back.webp)

<Intro>

A variant of the [phone stand](https://abernier.github.io/integral/things/phone-stand), whose manual ball joint it replaces with two Feetech STS3215 serial bus servos: one turns the stand about a vertical axis (pan), one leans the drum back and forward (tilt), and the base stand's MG996R still turns the phone a quarter turn about the axis through its screen, between portrait and landscape. An app aims the phone and turns it over Bluetooth Low Energy ([protocol 2](https://github.com/abernier/integral/blob/main/phone-stand/protocol.md#protocol-2-pan-and-tilt), backward compatible with the base stand's; why servos: [ADR 0002](https://github.com/abernier/integral/blob/main/docs/adr/0002-phone-stand-pan-tilt.md)). It can also be taught: torque off, the aim set by hand, the servos' encoders read back and stored as presets. The model is Rhino's, not code: [`phone-stand-pan-tilt.rhino.step`](https://github.com/abernier/integral/blob/main/phone-stand-pan-tilt/phone-stand-pan-tilt.rhino.step), thirteen named solids in mm, written by [`phone-stand-pan-tilt.rhino.py`](https://github.com/abernier/integral/blob/main/phone-stand-pan-tilt/phone-stand-pan-tilt.rhino.py), which runs the base stand's script as a library: the drum, the dial, its stops, the index, the head, the base and the lid are the base stand's builders, called with the few parameters the variant changes.

The silhouette changes on purpose. A ball is the one shape that aims in every direction; two servos aim about two axes, and a fork shows them. The drum hangs between two arms on a horizontal axis, a lamp on its stirrup, and the fork turns on a short column over the base. The tilt axis runs through the drum's sides as close to the centre of mass of everything that tilts (drum, roll servo, dial, head, phone) as the drum allows: 15 mm behind it, so the tilt servo holds 0.07 N m at most against gravity, and the drum, nearly balanced, stays where a hand leaves it in teach mode. The roll and tilt axes meet; the pan axis sits 24 mm behind them, because tilted forward the phone's lower edge swings back under the drum, where a bar under the tilt axis would be: the arms lean back 15.6 degrees to meet it. One section everywhere in the fork: the arms are 44 deep and 44 thick, the bar and the column 44 across, half the drum, as the base stand's column. The rest is the base stand's language: circles and cylinders, warm white, the orange index on the dial the one accent, 0.75 mm shadow gaps where parts meet (the column over the base, the covers on the arms, the bar's two halves), no fastener seen from the front or the sides: the covers screw from inside the bar, the bar's one screw hides under a flush plug, the servos behind the covers and under the column.

**Status: modelled only.** Nothing has been printed, wired or checked on the bench: read [Verify before printing](#verify-before-printing) first. The firmware and the app side do not exist yet.

</Intro>

[![Open in Buerligons](https://img.shields.io/badge/Open_in-Buerligons-c4553e)](https://buerligons.io/editor/?url=https://abernier.github.io/integral/phone-stand-pan-tilt/phone-stand-pan-tilt.ofb) [![download .ofb](https://img.shields.io/badge/download-.ofb-1f6feb)](https://abernier.github.io/integral/phone-stand-pan-tilt/phone-stand-pan-tilt.ofb) [![download STEP](https://img.shields.io/badge/download-STEP-238636)](https://abernier.github.io/integral/phone-stand-pan-tilt/phone-stand-pan-tilt.step) [![download GLB](https://img.shields.io/badge/download-GLB-8957e5)](https://abernier.github.io/integral/phone-stand-pan-tilt/phone-stand-pan-tilt.glb)

![Pan-tilt phone stand, from behind](https://abernier.github.io/integral/phone-stand-pan-tilt/phone-stand-pan-tilt.png)

| | |
|---|---|
| Material | PETG, 0.2 mm layers, no supports |
| Colour | warm white (every part) and orange (the index alone) |
| Size | 179 wide (the fork), Ø 142 base, 203 to the drum's top; the roll and tilt axes 159 above the desk |
| Pan | ±135 degrees (required ±90), STS3215 in the base, limited by its angle registers and the cable's loop |
| Tilt | -15 to +30 degrees (+ leans the screen back), STS3215 in the left arm; the fork stays clear to -20 and +35 |
| Roll | 0 to 90 degrees, the base stand's MG996R, dial and hard stops |
| Parts | base, lid, column, two yoke halves, two covers, plug, drum, axle, plate, index, head |
| Model | ClassCAD part imported from Rhino's STEP, 13 named bodies |
| Source | [`phone-stand-pan-tilt.rhino.py`](https://github.com/abernier/integral/blob/main/phone-stand-pan-tilt/phone-stand-pan-tilt.rhino.py), Rhino 8 or 9, runs [`phone-stand.rhino.py`](https://github.com/abernier/integral/blob/main/phone-stand/phone-stand.rhino.py) as a library |
| Engine | ClassCAD WASM 21.2, free plan (non-commercial) |

## Parts

| Part | What |
|---|---|
| Base | Low disc, Ø 142 × 40, centred on the pan axis: the pan servo hangs under its 2 mm top skin (4 × M2 from above, under the column), its horn through the skin; the bay at the back (open to the bottom) for the ESP32, the power board and the USB-C PD trigger behind the back port; the ballast cavity and tripod nut in front; rubber feet. The base stand's builder, reshaped by parameters |
| Lid | Closes the ballast cavity from below (4 × M3), the base stand's |
| Column | Ø 44, turns on the pan servo's horn (4 × M3 from inside), floating 0.75 mm over the base; an arc slot in its floor lets the cable through over ±135 degrees; its top is a cradle for the bar |
| YokeLeft | One arm and half the bar: the tilt servo in a pocket open toward the cover, leaning with the arm, its horn on the axis behind a round hole; the bar's bore and a channel up the arm for the bus cable |
| YokeRight | The other arm and half the bar: a 6802 bearing behind a lip, the roll servo's lead down a channel to the bar |
| CoverLeft, CoverRight | The arms' outer faces, behind a 0.75 mm shadow gap; each screwed from inside the bar's bore (2 × M3 into inserts); the left one holds the servo's case end |
| Plug | Flush with the bar's top, over the head of the one M4 that clamps both bar halves into the column |
| Drum | The base stand's drum (the MG996R, its bulkhead and stop block, the dial's bore) without the ball's belly, with a trunnion on each side: round on top, a 45 degree roof underneath so the drum still prints on its back; the left one screwed to the tilt horn, the right one holds the axle |
| Axle | Ø 15 tube in the bearing, pressed and glued into the drum's right trunnion; the roll servo's lead runs through its Ø 10 bore, on the tilt axis |
| Plate, Index, Head | The base stand's dial, orange index and Quad Lock compatible head, unchanged |

## Bill of materials

| Qty | Item | Note |
|---|---|---|
| 2 | Feetech STS3215 serial bus servo, 7.4 V, 1:345, with its metal horn | Pan (ID 1) and tilt (ID 2); 45.2 × 24.7 × 35 mm, 19.5 kg cm (1.9 N m) stall, 12-bit magnetic encoder |
| 1 | MG996R-class metal-gear servo, with round horn | Roll, as on the base stand |
| 1 | ESP32 DevKit | In the bay, slot 56 × 29 × 15 mm |
| 1 | 74HC126 quad buffer, 1 kΩ and 10 kΩ resistors, perfboard | The bus's half-duplex interface, on the power board |
| 2 | Adjustable step-down modules, 5 A, about 23 × 17 mm | Set to 7.4 V (the bus) and 6.0 V (the MG996R and the ESP32's VIN), on the power board |
| 1 | USB-C PD trigger board, set to 9 V | Behind the back port; any 27 W (9 V 3 A) USB-C PD charger |
| 1 | 6802-2RS bearing, 15 × 24 × 5 | The right trunnion |
| 1 | 5-conductor flexible cable, about Ø 5, 200 mm | Bus (7.4 V, GND, data) and the MG996R's 6 V and PWM, up through the column's loop to the bar |
| 1 | 1/4"-20 hex nut | Tripod mount, as on the base stand |
| 1 | M4 heat-set insert (Ø 5.6, 4.5 deep) + M4 × 45 socket head | The bar's halves into the column's floor |
| 4 | M3 heat-set inserts (Ø 4, 6 deep) + 4 × M3 × 30 | Covers to the arms, from inside the bar's bore |
| 4 | M3 heat-set inserts + 4 × M3 screws | The lid |
| 4 | M3 screws (the horn's) | The pan horn to the column's floor |
| 4 | M3 × 6 (the horn's) | The tilt horn to the left trunnion |
| 4 | M2 × 6 countersunk | The pan servo to the base's top skin |
| 4 | Small self-tapping screws, M4 self-tapping, M3 button head | The roll servo, its horn and the head, as on the base stand |
| 4 | Self-adhesive rubber feet, Ø 10 | |
| - | Ballast, about 100 g | The centre-of-mass estimate assumes 100 g |
| 1 | Quad Lock case (or adapter) on the phone | Phone with case modelled at 155 × 75 × 12 mm |
| 2 | Electrolytic capacitors, 470 µF, 16 V | One on each rail, at the servos' connectors |

## Electronics and wiring

- **Bus interface: a 74HC126, not a ready-made driver board.** It fits on the power board beside the bucks, costs nothing, and the ESP32's UART drives it in its RS485 half-duplex mode, RTS as the direction line; a Waveshare bus servo board would bring a second MCU or a USB bridge the stand does not need.
- **Power: a USB-C PD trigger at 9 V and two bucks, not a 2S battery.** The stand lives on a desk next to a charger: no cell to charge, balance or protect, and 9 V is the lowest PD level above the bus's 7.4 V. The MG996R is rated to 7.2 V, so it gets its own 6 V rail, which also feeds the ESP32's VIN. A charger that cannot do 9 V leaves the trigger at 5 V: the firmware reads the bus voltage from the servos and keeps their torque off below 6.5 V.
- **Current**: two STS3215 can stall at about 2.7 A each; the firmware sets their torque limit (register 48) so that the bus stays under 3 A, and their own overload protection stays on.

```
USB-C PD trigger 9 V ──┬── buck A 7.4 V ──┬─ 470 µF ─┬── bus V+ ── pan STS3215 ══ tilt STS3215 (daisy chain)
                       │                  │          │
                       └── buck B 6.0 V ──┼─ 470 µF ─┼── MG996R V+ (red)
                                          │          └── ESP32 VIN
GND ──────────────────────────────────────┴──────────── bus GND, MG996R GND (brown), ESP32 GND

ESP32 TX  ── 74HC126 A1 ── Y1 ──┬── bus data            (74HC126 at 3.3 V; OE1 = RTS: high while sending)
ESP32 RTS ── 74HC126 OE1        ├── 10 kΩ ── 3.3 V      (the line idles high)
ESP32 RX  ── 1 kΩ ──────────────┘                        (the ESP32 hears its own frames: the firmware drops the echo)
ESP32 GPIO (LEDC) ──────────────────────────────── MG996R signal (orange)
```

- The cable through the pan axis has five conductors: the bus's three and the MG996R's 6 V and signal (the grounds are shared). It rises from the bay through a hole behind the pan axis, through the arc slot in the column's floor, loops once in the column's Ø 38 bore (about 75 mm of slack for 270 degrees of travel), and enters the bar's bore. The bus goes up the left arm's channel to the tilt servo; the MG996R's three wires go up the right arm's channel and through the axle's bore on the tilt axis, where they twist and never bend.
- The pan servo is ID 1, the tilt servo ID 2, set once each on the bench before assembly. Their angle limit registers hold the pan within ±135 and the tilt within -15 and +30 degrees, so that a firmware bug cannot drive the phone into the fork or wind the cable up.

## Printing

PETG, 0.2 mm layers, no supports. `phone-stand-pan-tilt.rhino.py` writes one STL per part into `phone-stand-pan-tilt/stl/`, in print orientation (generated, out of git), and checks every one: no part over 220 mm, and no downward face steeper than 45 degrees off the bed wider than a 26 mm bridge (the head excepted, the vendor's own print-in-place orientation).

| Part | On the bed |
|---|---|
| Base | Upside down, top face on the bed |
| Lid | Flat |
| Column | Upright: the horn's recess is a 22.5 mm bridge |
| YokeLeft, YokeRight | On the seam face, the bar up: the servo's pocket opens on the bed, its ceiling a 25.2 mm bridge |
| CoverLeft, CoverRight | On the outer face |
| Plug | Upright, on its flat bottom |
| Drum | On its flat back face: the trunnions' 45 degree roofs face the bed |
| Axle | Upright |
| Plate, Index, Head | As on the base stand |

Every part in warm white PETG, the index alone in orange. The yoke halves take the drum's weight and the servo's torque: 4 walls or more.

## Assembly

1. Set the servos' IDs (pan 1, tilt 2), their angle limits and torque limit on the bench, over the bus.
2. Press the inserts: the column's floor (M4), the covers (2 × M3 each), around the lid (4 × M3); the index into the dial; the 1/4"-20 nut into its trap; fill the ballast cavity and screw the lid on.
3. Screw the pan servo under the base's top skin (4 × M2 countersunk from above), shaft up through the skin; fit the PD trigger, the power board and the ESP32 in the bay and wire them (see [Electronics and wiring](#electronics-and-wiring)); thread the cable up through the hole behind the pan axis.
4. Screw the pan horn under the column's floor (4 screws from inside the column); thread the cable through the floor's arc slot, the column at pan 0, and press the column onto the pan servo's spline.
5. Build the drum as on the base stand (roll servo, plate, head, steps 6 to 9 of its assembly), but feed the MG996R's lead out through the right trunnion's hole instead of the belly. Press and glue the axle into the right trunnion. Screw the tilt horn onto the left trunnion (4 × M3 × 6 from the horn's side).
6. Press the bearing into the right yoke half from its cavity side, against the lip, and screw its cover on (2 × M3 × 30 from inside the bar's bore, a long driver in from the half's open middle end).
7. Drop the tilt servo into the left half's pocket, shaft toward the drum, its bus cable down the arm's channel into the bar's bore, and screw the left cover on the same way, over the servo's case end.
8. Slide the right half onto the axle, the MG996R's lead through the axle's bore and down the arm's channel; slide the left half onto the drum so the servo's spline enters the horn, and drive the horn's centre screw from inside the drum's bore with a short hex key, before the dial goes on.
9. Join the cables in the bar, lower both halves into the column's cradle, drive the M4 × 45 down the pan axis through both halves into the column's insert, and press the plug over its head.
10. Sweep each axis slowly by command: pan to ±135 (the cable must slide free in the slot and the column), tilt to -15 and +30 (the drum must clear the bar and the phone the fork), roll between its stops.

## Regenerating

`phone-stand-pan-tilt.rhino.py` builds every part from its `P` parameters and the base stand's, every path relative to its own folder. In Rhino 8 or 9:

```
RunPythonScript <repository>/phone-stand-pan-tilt/phone-stand-pan-tilt.rhino.py
```

It runs `../phone-stand/phone-stand.rhino.py` as a library (that script builds nothing when `PHONE_STAND_LIBRARY` is set, and takes `PHONE_STAND_OVERRIDES` over its own parameters; run alone, it is unchanged), then writes `phone-stand-pan-tilt.rhino.step` (the thirteen parts alone, turned half a turn about Z so the phone faces -Y) and `stl/`; `EXPORT=False` builds without writing; `POSE_DIR` writes posed meshes (neutral, tilted, panned, exploded, a section) for renders. It ends with `checks: all passed` or the list of what failed: the solids, the base stand's roll stops and dial in the new drum, the parts apart at rest and the servos and bearing clear of their seats, the electronics in the bay, the drum, axle, dial, head and phone clear of the fork and the column over tilt -20 to +35 and the whole roll, the phone 8 mm above the base, the drum clear of the bar, the torque margins, the centre of mass over every aim and against a tap, the cable free in the slot over the pan limits, its plug through the axle, every print under 220 mm and without support. Then `nr build:parts` imports the new STEP, and `pnpm render phone-stand-pan-tilt` draws it again.

<details>
<summary>Key figures</summary>

In the script's frame: mm, Z up, desk at Z = 0, phone facing +Y; the roll axis along Y at Z = 158.75 (118.75 above the base's top), the tilt axis along X at Y = 54, the pan axis vertical at Y = 30.

- Height: drum's top 202.8; the axes 158.75: the bar's axis is 86 under the tilt axis, the lowest that keeps the drum's back edge 2 mm over the bar tilted 35 back, and the column shows 10 mm between the base and the bar.
- Width: the drum Ø 88, a 1.5 mm gap, each arm 44 (36 of yoke, 0.75 of seam, 7.6 of cover): 179 in all. Tilt servo case X 52 to 87, its horn at 48 to 51.
- Tilting mass 452 g (phone 250), its centre of mass Y 69.4, Z 157.9: 15.4 mm ahead of the tilt axis, 0.8 below. The trunnions cannot go further forward: at Y 54 their front edge (Y 65) already overlaps the dial's depth, and they start in the drum's wall, outside the dial's Ø 78.5.
- Tilt: gravity 0.068 N m at most, a 3 N tap at the phone's top adds 0.233: 0.30 N m against the STS3215's 1.9 N m stall, ×6.3.
- Pan: no gravity on a vertical axis; a 3 N tap at a landscape end, 0.233 N m: ×8.2. The pan servo's output carries 780 g, 7.6 N, axially.
- Roll: the phone turns about its own centre; a tap along a landscape end, 0.233 N m against the MG996R's 0.94 N m at 6 V: ×4.0.
- The phone stays 23.3 mm above the base's top at worst over the required range (tilt -15, mid-turn), 21.6 at -20; 8 required.
- Mass 1.68 kg with 100 g of ballast; centre of mass at rest X 2.5, Y 51.2, Z 93.8. Over every pan within ±135 and tilt -20 to +35 it stays 49.6 mm inside the base's rim and 21.1 inside the feet's square; a 3 N tap at the phone's top would need ×1.86 more to tip it over the rim.
- Cable: the floor's slot spans ±(135 + 9 + 3) degrees about the cable's hole: the cable would meet its end at 139 degrees.

</details>

## Verify before printing

- [ ] **STS3215 shaft position** (`STS_SHAFT_FROM_END` 11.5 mm), **horn** (Ø 22 × 3, 4 × M3 on Ø 14) and **case screw holes** (the pan servo's 4 × M2 pattern) are guesses: measure the servos bought and set the parameters.
- [ ] **Teach mode with torque off**: the drum is 0.07 N m out of balance at worst; check that the tilt servo's gearbox holds it without torque, or use the soft teach mode (a low torque limit) of the protocol.
- [ ] **Pan servo's output bearing**: it carries the whole fork and drum, 780 g, axially; check for wobble at the drum, and add a thrust washer under the column if there is any.
- [ ] **Axle press fit** (0.05 mm a side, 4.5 mm deep, glued): check that it holds the drum's side.
- [ ] **Tilt horn's centre screw** driven from inside the drum's bore with a short hex key: check the reach before printing the drum.
- [ ] **Cable loop** in the column: check that 75 mm of slack coils and uncoils in the Ø 38 bore over ±135 degrees without catching on the horn's screws.
- [ ] **Bucks and PD trigger** (sizes, the 9 V setting, 5 A rating) and **the 74HC126 circuit's levels** (the STS3215's data line at 3.3 V): check against the parts bought, on the bench, before closing the base.
- [ ] **Current**: check that two STS3215 with their torque limit set stay under the 7.4 V buck's rating at stall.
- [ ] **Trunnion roofs** (45 degrees, toward the drum's back): check that they print clean and turn free in the arm's hole (0.75 mm gap).
- [ ] **Arm's shadow gap** (1.5 mm between the drum and the arms): check that the drum turns free with the yoke flexing under load.
- [ ] Everything on the base stand's own list about the drum, the dial, the head and the roll servo.

## Credits and licensing

The head is the base stand's: "Quadlock Mount (Locking Mechanism)" by **jimmysinkers**, [Thingiverse thing:3870880](https://www.thingiverse.com/thing:3870880), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); see the [phone stand's credits](https://github.com/abernier/integral/blob/main/phone-stand/README.md#credits-and-licensing) for its sources, its unmodified STEP and the Quad Lock trademark and patent notice, which apply here too.
