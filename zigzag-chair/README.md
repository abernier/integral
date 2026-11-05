# Zigzag chair

Rietveld's 1934 Zig-Zag chair, parametric, in cherry.

![Zigzag chair, three-quarter front](https://abernier.github.io/integral/zigzag-chair/renders/zigzag-chair.three-quarter.webp)
![Zigzag chair, front](https://abernier.github.io/integral/zigzag-chair/renders/zigzag-chair.front.webp)
![Zigzag chair, side](https://abernier.github.io/integral/zigzag-chair/renders/zigzag-chair.side.webp)
![Zigzag chair, three-quarter back](https://abernier.github.io/integral/zigzag-chair/renders/zigzag-chair.back.webp)

<Intro>

Four boards in a Z: seat, slant and base mitred at 45° on glued cleats, the back dovetailed through the seat. Every dimension is a parameter: change one in the model or in Buerligons, the chair rebuilds.

</Intro>

[![Open in Buerligons](https://img.shields.io/badge/Open_in-Buerligons-c4553e)](https://buerligons.io/editor/?url=https://abernier.github.io/integral/zigzag-chair/zigzag-chair.ofb) [![download .ofb](https://img.shields.io/badge/download-.ofb-1f6feb)](https://abernier.github.io/integral/zigzag-chair/zigzag-chair.ofb) [![download STEP](https://img.shields.io/badge/download-STEP-238636)](https://abernier.github.io/integral/zigzag-chair/zigzag-chair.step) [![download GLB](https://img.shields.io/badge/download-GLB-8957e5)](https://abernier.github.io/integral/zigzag-chair/zigzag-chair.glb)

![Zigzag chair, from behind](https://abernier.github.io/integral/zigzag-chair/zigzag-chair.png)

| | |
|---|---|
| Wood | cherry, 19 mm boards |
| Size | 370 × 480 × 742.6 mm |
| Joints | 45° mitres with glued cleats; 6 through dovetails |
| Model | ClassCAD part, 6 named bodies; the site also runs it in the browser (smlibwasm) |
| Engine | ClassCAD WASM 21.2, free plan (non-commercial) |

## ShopBot files

```sh
pnpm cam zigzag-chair --force
```

How it works, in the workshop: [CAM](https://abernier.github.io/integral/integral/cam). What is cut how, per part (skips, grain, the Seat's wedge pass): `CAM` in [zigzag-chair.ts](https://github.com/abernier/integral/blob/main/zigzag-chair/zigzag-chair.ts). The files and what each holds: `.docs/zigzag-chair/cam/cam.json`, out of git.

By hand (the files cut square, from the top):

- the mitres, the Seat's nose, the Slant's two ends, the Base's foot, and the Base's planed sides: saw or plane to the line;
- the Back's bottom edge, 8° to its faces, and its tails' flanks, 1 in 6 through the board, left at their widest: pare to the line;
- the inside corners at the tool's radius: the roots of the Back's tails and of the Seat's sockets: chisel square.

## References

![A Zig-Zag chair in cherry, beside a glass table](https://abernier.github.io/integral/zigzag-chair/references/studio.webp)
![A Zig-Zag chair at a hotel room's desk](https://abernier.github.io/integral/zigzag-chair/references/hotel-room.jpg)
![A Zig-Zag chair on a rug, books under the seat](https://abernier.github.io/integral/zigzag-chair/references/rug.jpg)
