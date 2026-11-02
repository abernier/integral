# Zigzag chair

<Intro>

A chair of four boards in a Z, after Rietveld's 1934 Zig-Zag: seat, slant and base mitred at 45°, the back dovetailed through the seat.

</Intro>

**[Open in Buerligons](https://buerligons.io/editor/?url=https://abernier.github.io/integral/zigzag-chair/zigzag-chair.ofb)** (classcad.ch sign-in) · [`.ofb`](https://abernier.github.io/integral/zigzag-chair/zigzag-chair.ofb) · [STEP](https://abernier.github.io/integral/zigzag-chair/zigzag-chair.step) · [GLB](https://abernier.github.io/integral/zigzag-chair/zigzag-chair.glb) · [source](https://github.com/abernier/integral/blob/main/zigzag-chair/zigzag-chair.ts)

![Zigzag chair, from behind](https://abernier.github.io/integral/zigzag-chair/zigzag-chair.png)

| | |
|---|---|
| Wood | cherry, 19 mm boards |
| Size | 370 × 480 × 742.6 mm |
| Joints | 45° mitres with glued cleats; 6 through dovetails |
| Model | ClassCAD assembly, 6 parts |
| Engine | ClassCAD WASM 21.2, free plan (non-commercial) |

## Parameters

In the `Params` part, mm. Edit, then recalculate.

| Name | Default | Meaning |
|---|---|---|
| `T` | 19 | Board thickness |
| `W_NOSE` | 370 | Width at the nose |
| `W_FOOT` | 330 | Width at the foot (taper) |
| `W_BASE_FRONT` | 300 | Base top, front edge |
| `SEAT_TOP` | 430 | Seat height |
| `SEAT_LEN` | 436.43 | Seat, nose to back's rear face |
| `BACK_H` | 313.04 | Back above the seat |
| `BACK_LEAN` | 8 | Back lean, degrees |
| `BASE_LENGTH` | 418 | Base underside |
| `CLEAT` | 30 | Cleat legs |
| `TAILS` | 6 | Dovetail count |
| `SLOPE` | 1/6 | Dovetail slope |
| `PIN`, `HALF_PIN` | 20, 20 | Pins at the rear face |
| `GRIP`, `GRIP_HIGH`, `GRIP_DEEP`, `GRIP_BELOW` | 140, 20, 10, 20 | Grip pocket |

## Build

```sh
nr build:parts  # .ofb, STEP, GLB, PNG into .docs/zigzag-chair/
nr dev          # live: saving zigzag-chair.ts rebuilds it
```
