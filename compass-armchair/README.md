# Compass armchair

A cane armchair on compass legs, after the 1955 Chandigarh office chair, parametric, in teak.

<Intro>

Each side is two tapered boards in a V and an armrest on edge, one plane, one thickness. The seat frame takes the boards on loose tenons, its cross rails are dovetailed through. The arched back hangs between the armrests, on one loose tenon a post. Every dimension below is a parameter: change one in Buerligons, the chair rebuilds.

</Intro>

[![Open in Buerligons](https://img.shields.io/badge/Open_in-Buerligons-c4553e)](https://buerligons.io/editor/?url=https://abernier.github.io/integral/compass-armchair/compass-armchair.ofb) [![download .ofb](https://img.shields.io/badge/download-.ofb-1f6feb)](https://abernier.github.io/integral/compass-armchair/compass-armchair.ofb) [![download STEP](https://img.shields.io/badge/download-STEP-238636)](https://abernier.github.io/integral/compass-armchair/compass-armchair.step) [![download GLB](https://img.shields.io/badge/download-GLB-8957e5)](https://abernier.github.io/integral/compass-armchair/compass-armchair.glb)

![Compass armchair, from behind](https://abernier.github.io/integral/compass-armchair/compass-armchair.png)

| | |
|---|---|
| Wood | teak, 30 mm boards; cane seat and back |
| Size | 480 × 553.1 × 794.7 mm |
| Joints | 6 loose tenons; 8 through dovetails |
| Model | ClassCAD part, 24 named bodies |
| Source | [smlibpy's `compass_armchair.py`](https://github.com/abernier/smlibpy/pull/11) |
| Engine | ClassCAD WASM 21.2, free plan (non-commercial) |

## Parameters

In the part's Expressions panel (`fx`), mm. Change one, press Enter: the whole chair rebuilds.

| Name | Default | Meaning |
|---|---|---|
| `W`, `LEG_T` | 480, 30 | Width over the boards; their thickness |
| `FRONT_FOOT_FRONT`, `FRONT_FOOT_BACK` | −181, −139 | Front foot on the floor |
| `REAR_FOOT_FRONT`, `REAR_FOOT_BACK` | 139, 181 | Rear foot |
| `NOTCH_Z` | 400 | Where the boards part, on the seam |
| `ARM_EDGE_FRONT`, `ARM_EDGE_REAR` | −70, 70 | Boards' edges under the armrest |
| `SPLINE_W`, `SPLINE_T`, `SPLINE_Z`, `SPLINE_IN_ARM` | 20, 16, 457, 40 | Seam tenon |
| `ARM_TOP`, `ARM_FRONT` | 645, −235 | Armrest top, nose |
| `ARM_NOSE_H`, `ARM_BACK_Y`, `ARM_BACK_H` | 60, 280, 95 | Armrest height, nose and back |
| `ARM_BEHIND` | 40 | Armrest behind the back |
| `SEAT_TOP`, `RAIL_H`, `RAIL_T`, `CANE_T` | 437, 60, 25, 8 | Seat frame |
| `SEAT_FRONT`, `SEAT_BACK` | −229, 240 | Side rails |
| `FRONT_RAIL_T`, `REAR_RAIL_T` | 30, 40 | Cross rails |
| `TENON_LEN`, `TENON_T`, `TENON_H`, `TENON_Y`, `TENON_IN_RAIL` | 20, 10, 40, 55, 15 | Side rail tenons |
| `BACK_TILT` | 15 | Back lean, degrees |
| `POST_W`, `POST_D`, `POST_Y_AT_ARM` | 30, 40, 260 | Posts |
| `BOW` | 10 | Back's arc, behind the posts between them |
| `LOW_RAIL_BOTTOM`, `LOW_RAIL_TOP` | 65, 100 | Lower back rail, along the posts |
| `HIGH_RAIL_BOTTOM`, `HIGH_RAIL_TOP` | 330, 365 | Upper back rail |
| `ARM_TENON`, `ARM_TENON_DEPTH`, `ARM_TENON_MARGIN` | 12, 15, 8 | Post tenons |
| `SEAT_TAILS` | 2 | Dovetails per seat corner |
| `SLOPE` | 1/6 | Dovetail slope |
| `SEAT_PIN_EDGE`, `SEAT_PIN_MID`, `BACK_TAIL_SHOULDER` | 6, 6, 12 | Pins, shoulder |

## ShopBot files

```sh
pnpm cam compass-armchair --force
```

How it works, in the workshop: [CAM](https://abernier.github.io/integral/integral/cam). What is cut how, per part (skips, the loose tenons' grain): `CAM` in [compass-armchair.ts](https://github.com/abernier/integral/blob/main/compass-armchair/compass-armchair.ts). The files and what each holds: `.docs/compass-armchair/cam/cam.json`, out of git.

By hand (the files cut square, from the top):

- the inside corners at the tool's radius: the mortises', the shoulders' of the rails and back posts: chisel square, or round the tenons;
- the dovetail sockets' walls in the SideRails and BackPosts, 9° through the board, not cut: pare to the line;
- below the rest pass's depth: the sockets between the FrontRail's and RearRail's twin tails, and the shoulders' corners below it: saw and chisel.
