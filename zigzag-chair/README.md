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

Or ask an agent: "make the ShopBot files of the zigzag chair" (skill `cam`). Prerequisites, parameters, tools: [scripts/cam](https://github.com/abernier/integral/tree/main/scripts/cam). Files and the run's record (`cam.json`: every value used, Fusion version, input hashes) in `.docs/zigzag-chair/cam/`, out of git. Simulate before cutting.

| File | Tool | How the board lies |
|---|---|---|
| `Seat_main.sbp` | 6 mm | flat; outline and tails, 4 tabs |
| `Seat_wedge8.sbp` | 6 mm | on an 8° wedge under its rear; only the tails and rear end (`cut: squared`), 22 mm deep, no tabs |
| `Back_main.sbp` | 6 mm | turned −82° about x, rear face up |
| `Slant_main.sbp` | 6 mm | turned 45° about x, front face up |
| `Base_main.sbp` | 6 mm | flat |

Cleats: sawn, not milled. Model values: margin 5 mm, post `shopbot`; the rest are the defaults. Manifest: [cam.config.json](https://github.com/abernier/integral/blob/main/zigzag-chair/cam.config.json).
