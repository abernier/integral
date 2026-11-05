# Compass armchair

A cane armchair on compass legs, after the 1955 Chandigarh office chair, parametric, in teak.

<Intro>

Each side is two tapered boards in a V and an armrest on edge, one plane, one thickness. The seat frame takes the boards on loose tenons, its cross rails are dovetailed through. The arched back hangs between the armrests, on one loose tenon a post. Every dimension is a parameter: change one in the model or in Buerligons, the chair rebuilds.

</Intro>

[![Open in Buerligons](https://img.shields.io/badge/Open_in-Buerligons-c4553e)](https://buerligons.io/editor/?url=https://abernier.github.io/integral/compass-armchair/compass-armchair.ofb) [![download .ofb](https://img.shields.io/badge/download-.ofb-1f6feb)](https://abernier.github.io/integral/compass-armchair/compass-armchair.ofb) [![download STEP](https://img.shields.io/badge/download-STEP-238636)](https://abernier.github.io/integral/compass-armchair/compass-armchair.step) [![download GLB](https://img.shields.io/badge/download-GLB-8957e5)](https://abernier.github.io/integral/compass-armchair/compass-armchair.glb)

![Compass armchair, from behind](https://abernier.github.io/integral/compass-armchair/compass-armchair.png)

| | |
|---|---|
| Wood | teak, 30 mm boards; cane seat and back |
| Size | 480 × 553.1 × 794.7 mm |
| Joints | 6 loose tenons; 8 through dovetails |
| Model | ClassCAD part, 24 named bodies; the site also runs it in the browser (smlibwasm) |
| Source | [smlibpy's `compass_armchair.py`](https://github.com/abernier/smlibpy/pull/11) |
| Engine | ClassCAD WASM 21.2, free plan (non-commercial) |

## ShopBot files

```sh
pnpm cam compass-armchair --force
```

How it works, in the workshop: [CAM](https://abernier.github.io/integral/integral/cam). What is cut how, per part (skips, the loose tenons' grain): `CAM` in [compass-armchair.ts](https://github.com/abernier/integral/blob/main/compass-armchair/compass-armchair.ts). The files and what each holds: `.docs/compass-armchair/cam/cam.json`, out of git.

By hand (the files cut square, from the top):

- the inside corners at the tool's radius: the mortises', the shoulders' of the rails and back posts: chisel square, or round the tenons;
- the dovetail sockets' walls in the SideRails and BackPosts, 9° through the board, not cut: pare to the line;
- below the rest pass's depth: the sockets between the FrontRail's and RearRail's twin tails, and the shoulders' corners below it: saw and chisel.

## References

![A cane office chair in teak](https://abernier.github.io/integral/compass-armchair/references/cane.webp)
![The chair at a desk, with a seat cushion](https://abernier.github.io/integral/compass-armchair/references/desk.webp)
![The Chandigarh armchair, drawn](https://abernier.github.io/integral/compass-armchair/references/drawing.jpg)
![Pierre Jeanneret, and the chair's drawings](https://abernier.github.io/integral/compass-armchair/references/plans.jpg)
![Reading in the chair, Chandigarh, 1950s](https://abernier.github.io/integral/compass-armchair/references/chandigarh.webp)
![Le Corbusier and Pierre Jeanneret in Chandigarh](https://abernier.github.io/integral/compass-armchair/references/jeanneret.jpg)
![A leather-upholstered one](https://abernier.github.io/integral/compass-armchair/references/leather.webp)
