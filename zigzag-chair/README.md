# Zigzag chair

Rietveld's 1934 Zig-Zag chair, parametric, in cherry.

<Intro>

Four boards in a Z: seat, slant and base mitred at 45° on glued cleats, the back dovetailed through the seat. Every dimension below is a parameter: change one in Buerligons, the chair rebuilds.

</Intro>

[![Open in Buerligons](https://img.shields.io/badge/Open_in-Buerligons-c4553e)](https://buerligons.io/editor/?url=https://abernier.github.io/integral/zigzag-chair/zigzag-chair.ofb) [![download .ofb](https://img.shields.io/badge/download-.ofb-1f6feb)](https://abernier.github.io/integral/zigzag-chair/zigzag-chair.ofb) [![download STEP](https://img.shields.io/badge/download-STEP-238636)](https://abernier.github.io/integral/zigzag-chair/zigzag-chair.step) [![download GLB](https://img.shields.io/badge/download-GLB-8957e5)](https://abernier.github.io/integral/zigzag-chair/zigzag-chair.glb)

![Zigzag chair, from behind](https://abernier.github.io/integral/zigzag-chair/zigzag-chair.png)

| | |
|---|---|
| Wood | cherry, 19 mm boards |
| Size | 370 × 480 × 742.6 mm |
| Joints | 45° mitres with glued cleats; 6 through dovetails |
| Model | ClassCAD part, 6 named bodies |
| Engine | ClassCAD WASM 21.2, free plan (non-commercial) |

## Parameters

In the part's Expressions panel (`fx`), mm. Change one, press Enter: the whole chair rebuilds.

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

## ShopBot files

```sh
pnpm cam zigzag-chair --force
```

How it works, in the workshop: [CAM](https://abernier.github.io/integral/integral/cam). What is cut how, per part (skips, grain, the Seat's wedge pass): `CAM` in [zigzag-chair.ts](https://github.com/abernier/integral/blob/main/zigzag-chair/zigzag-chair.ts). The files and what each holds: `.docs/zigzag-chair/cam/cam.json`, out of git.

By hand (the files cut square, from the top):

- the mitres, the Seat's nose, the Slant's two ends, the Base's foot, and the Base's planed sides: saw or plane to the line;
- the Back's bottom edge, 8° to its faces, and its tails' flanks, 1 in 6 through the board, left at their widest: pare to the line;
- the inside corners at the tool's radius: the roots of the Back's tails and of the Seat's sockets: chisel square.
