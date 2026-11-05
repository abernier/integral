# Compass armchair

A cane armchair on compass legs, after the 1955 Chandigarh office chair, parametric, in teak.

<Intro>

Each side is two tapered boards in a V and an armrest on edge, one plane, one thickness. The seat frame takes the boards on loose tenons, its cross rails are dovetailed through. The arched back hangs between the armrests, on one loose tenon a post. The sheet cane is pressed into a groove around each opening, on the seat's top and the back's front, and held by a glued rattan spline. Every dimension is a parameter: change one in the model or in Buerligons, the chair rebuilds.

</Intro>

[![Open in Buerligons](https://img.shields.io/badge/Open_in-Buerligons-c4553e)](https://buerligons.io/editor/?url=https://abernier.github.io/integral/compass-armchair/compass-armchair.ofb) [![download .ofb](https://img.shields.io/badge/download-.ofb-1f6feb)](https://abernier.github.io/integral/compass-armchair/compass-armchair.ofb) [![download STEP](https://img.shields.io/badge/download-STEP-238636)](https://abernier.github.io/integral/compass-armchair/compass-armchair.step) [![download GLB](https://img.shields.io/badge/download-GLB-8957e5)](https://abernier.github.io/integral/compass-armchair/compass-armchair.glb)

![Compass armchair, from behind](https://abernier.github.io/integral/compass-armchair/compass-armchair.png)

| | |
|---|---|
| Wood | teak, 30 mm boards; sheet cane seat and back, rattan splines (cane); a black leather cushion and back pad on plywood, teak cleats and fillets (leather) |
| Size | 480 × 553.1 × 794.7 mm |
| Joints | 6 loose tenons; 8 through dovetails; 2 cane grooves (cane) |
| Model | ClassCAD part, 26 named bodies (32 with leather); the site also runs it in the browser (smlibwasm) |
| Source | [smlibpy's `compass_armchair.py`](https://github.com/abernier/smlibpy/pull/11) |
| Engine | ClassCAD WASM 21.2, free plan (non-commercial) |

## Variants

- **Cane** (the default): the chair above, sheet cane on the seat and the back, in its groove.
- **Leather cushion**: a black leather cushion in the seat frame, a little proud of the rails, and an upholstered panel filling the back between posts and rails. No groove and no spline, with no cane to hold; the side rail tenons go back to the middle of the rail's height. The cushion lies on a plywood board, the board on four teak cleats glued and screwed to the seat rails' inner faces: the rails are cut flat from the top, and a rebate on their inner face would be a side-machining operation (or a rebating bit by hand after the dovetails), while the cleats are more flat parts; they also let the board be screwed from below and the cushion lifted out. The back's panel is a bending-plywood backer and its pad, screwed from behind into two curved teak fillets on the low rail and under the high one: arc bands, flat parts too. The pad, the cushion and both plywood boards are not milled (`pnpm cam compass-armchair --variant leather`).

[![download .ofb](https://img.shields.io/badge/download-.ofb-1f6feb)](https://abernier.github.io/integral/compass-armchair/compass-armchair.leather.ofb) [![download STEP](https://img.shields.io/badge/download-STEP-238636)](https://abernier.github.io/integral/compass-armchair/compass-armchair.leather.step) [![download GLB](https://img.shields.io/badge/download-GLB-8957e5)](https://abernier.github.io/integral/compass-armchair/compass-armchair.leather.glb) [![Open in the configurator](https://img.shields.io/badge/Open_in-configurator-c4553e)](https://abernier.github.io/integral/configurator/?part=compass-armchair&variant=leather)

![Compass armchair with a leather cushion, from behind](https://abernier.github.io/integral/compass-armchair/compass-armchair.leather.png)

## ShopBot files

```sh
pnpm cam compass-armchair --force                    # cane, the default
pnpm cam compass-armchair --variant leather --force  # leather cushion
```

How it works, in the workshop: [CAM](https://abernier.github.io/integral/integral/cam). What is cut how, per part (skips, the loose tenons' grain): `CAM` in [compass-armchair.ts](https://github.com/abernier/integral/blob/main/compass-armchair/compass-armchair.ts). The files and what each holds: `.docs/compass-armchair/cam/cam.json` (leather: `cam/leather/cam.json`), out of git.

By hand (the files cut square, from the top):

- the inside corners at the tool's radius: the mortises', the shoulders' of the rails and back posts: chisel square, or round the tenons;
- the dovetail sockets' walls in the SideRails and BackPosts, 9° through the board, not cut: pare to the line;
- below the rest pass's depth: the sockets between the FrontRail's and RearRail's twin tails, and the shoulders' corners below it: saw and chisel;
- the cane grooves, after glue-up, one loop across the joints: the seat rails lie on their side and the back's front is curved, so no file cuts them. A plunge router, a 6 mm straight bit and a guide bushing on a template (the ShopBot cuts it), the back's template bent to its arc; or the glued-up seat frame on the ShopBot, top up. `GROOVE` (1 on, 0 off) shows the chair without them, the cane flat on the frame and no splines, as the files cut it (its `cam` is 0); the side rail tenons stay under the groove's depth `GROOVE_D` either way;
- the rounds, on the cut parts, with a router and a round-over bit: the armrest noses at `ARM_NOSE_R`, every other outside arris of the assembled chair broken at `EDGE_BREAK`, as if broken after glue-up and flush-planing, the rounds running on across the joints: a back rail's tail rounded where it comes through its post, the post's round running on across it. A flush glued seam stays sharp on both members, the joint one surface but for a hairline, no V: the two boards' seam, the boards' tops under the armrest and the armrest's underside over them, a back post's inner face under the rails' ends, a side rail's inner bottom under the cross rails'. Square too are the arrises hidden once assembled, those in an inside corner, along a dovetail's joint lines, and those the cane laps. Square too are a side rail's outer arrises and a back post's where they lie against the side's boards and armrest, rounded beyond them. The model shows the rounds; the files cut square: `pnpm build:parts` builds their geometry without them, `compass-armchair.cam.step`, with the masters' `cam` values (`EDGE_BREAK`, `ARM_NOSE_R` and `GROOVE` at 0), and `pnpm cam` reads it.

## References

![A cane office chair in teak](https://abernier.github.io/integral/compass-armchair/references/cane.webp)
![The chair at a desk, with a seat cushion](https://abernier.github.io/integral/compass-armchair/references/desk.webp)
![The Chandigarh armchair, drawn](https://abernier.github.io/integral/compass-armchair/references/drawing.jpg)
![Pierre Jeanneret, and the chair's drawings](https://abernier.github.io/integral/compass-armchair/references/plans.jpg)
![Reading in the chair, Chandigarh, 1950s](https://abernier.github.io/integral/compass-armchair/references/chandigarh.webp)
![Le Corbusier and Pierre Jeanneret in Chandigarh](https://abernier.github.io/integral/compass-armchair/references/jeanneret.jpg)
![A leather-upholstered one](https://abernier.github.io/integral/compass-armchair/references/leather.webp)
