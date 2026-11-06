# Desk

A mid-century writing desk, a three-drawer pedestal on turned legs, modelled in Rhino, in oak.

![Desk, three-quarter front](https://abernier.github.io/integral/desk/renders/desk.three-quarter.webp)
![Desk, front](https://abernier.github.io/integral/desk/renders/desk.front.webp)
![Desk, side](https://abernier.github.io/integral/desk/renders/desk.side.webp)
![Desk, three-quarter back](https://abernier.github.io/integral/desk/renders/desk.back.webp)

<Intro>

An oak top on a light frame: at the left a leg cleat and an apron, on two long turned legs; at the right a birch plywood pedestal of three drawers, on two short ones. The legs' tenons go through the cleat and the pedestal's bottom. The model is Rhino's, not code: [`desk.rhino.step`](https://github.com/abernier/integral/blob/main/desk/desk.rhino.step), exported from Rhino 9 in mm, is its master geometry, joinery and roundovers cut in, and the build imports it as it is. No parameters, no configurator: to change the desk, edit the Rhino model and export it again over that file.

</Intro>

[![Open in Buerligons](https://img.shields.io/badge/Open_in-Buerligons-c4553e)](https://buerligons.io/editor/?url=https://abernier.github.io/integral/desk/desk.ofb) [![download .ofb](https://img.shields.io/badge/download-.ofb-1f6feb)](https://abernier.github.io/integral/desk/desk.ofb) [![download STEP](https://img.shields.io/badge/download-STEP-238636)](https://abernier.github.io/integral/desk/desk.step) [![download GLB](https://img.shields.io/badge/download-GLB-8957e5)](https://abernier.github.io/integral/desk/desk.glb)

![Desk, from behind](https://abernier.github.io/integral/desk/desk.png)

| | |
|---|---|
| Wood | oak, 30 mm (top, leg cleat, leg blocks) and 18 mm (apron, drawer fronts); birch plywood, 18 mm (the pedestal, veneered), 12 mm (drawer boxes), 6 mm (drawer bottoms); turned oak legs |
| Size | 1400 × 650 × 750 mm |
| Joints | 13 fluted 8 mm dowels; rabbets and grooves; 4 legs on 20 mm round tenons; 3 drawers on 550 mm side-mount slides |
| Model | ClassCAD part imported from Rhino's STEP, 33 named bodies |
| Source | [`desk.rhino.step`](https://github.com/abernier/integral/blob/main/desk/desk.rhino.step), exported from Rhino 9 |
| Engine | ClassCAD WASM 21.2, free plan (non-commercial) |

## ShopBot files

```sh
pnpm cam desk --force
```

How it works, in the workshop: [CAM](https://abernier.github.io/integral/integral/cam). What is cut how, per part (oak or plywood, the pedestal sides' grain, the legs skipped): `CAM` in [desk.ts](https://github.com/abernier/integral/blob/main/desk/desk.ts). The files and what each holds: `.docs/desk/cam/cam.json`, out of git.

By hand (the files cut from the top, square):

- the four legs, on the lathe, from 35 mm square oak: tapered from Ø 35 at the shoulder to Ø 25 at the foot, a 1.5 mm chamfer at the foot, a Ø 20 × 30 mm tenon; two 720 mm long, two 300 mm;
- the roundovers, on the cut parts, with a router and a round-over bit: the top's 6 mm, top and bottom edges, and the drawer fronts' 1.5 mm. The STEP `pnpm cam` reads has them (an imported part has no masters to build it without them, so no `desk.cam.step`): the outline follows each part's silhouette, square;
- the drawer fronts' finger pulls, a 16 mm cove 8 mm deep: a router and a 16 mm core-box bit, along a fence;
- the dowel holes in edges and ends (the apron's, the pedestal rails', the leg cleat's): a dowelling jig;
- what lies on the face down: the left pedestal side's apron dowel, on its outer face, and the drawer fronts' screw pilots, on their back: drill;
- holes and slots narrower than the sheet's tool: the 3 to 5 mm pilot and clearance holes, the 6 mm screw slots of the leg cleat and the back rail, the drawer boxes' 6 mm bottom grooves: drill, or the table saw.

## References

![The desk in a bedroom, with a cane armchair](https://abernier.github.io/integral/desk/references/bedroom.webp)
