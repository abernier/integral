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
| Model | ClassCAD assembly, 6 parts, after smlibpy's [`zigzag_chair.py`](https://github.com/abernier/smlibpy/blob/main/examples/zigzag_chair.py) |
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

## Volumes

mm³, per board:

| Board | ClassCAD | smlibpy | Diff |
|---|---|---|---|
| Seat | 2 725 472.074 | 2 725 472.074 | under 1e-6 |
| Back | 2 082 435.575 | 2 082 462.542 | -26.97 |
| Slant | 3 865 257.798 | 3 865 257.798 | under 1e-6 |
| Base | 2 356 487.869 | 2 356 487.869 | under 1e-8 |
| Seat cleat | 164 539.686 | 164 539.686 | under 1e-8 |
| Foot cleat | 150 176.501 | 150 176.501 | under 1e-8 |

> [!NOTE]
> Back: ClassCAD's volume of curved faces (the grip) is approximate; the geometry is exact.

## ClassCAD vs smlibpy

> [!TIP]
> - Live history: rebuilds in 0.5 s (`T` 22, `TAILS` 5: all volumes match)
> - Expressions in planes, csys, sizes, pattern count
> - Planar volumes exact
> - STEP export on the free plan

> [!CAUTION]
> - No expressions on assemblies: a `Params` part, 52 mirrors per board, `recalc()` to refresh
> - Silent no-op API calls; STEP export reports an error on a good file
> - Curved volumes approximate
> - No checks like smlibpy's `check()`
> - Long trees: one plane and one slice per cut
> - Buerligons needs a sign-in
