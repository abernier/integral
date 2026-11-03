# CAM: ShopBot files from Fusion, from the command line

`pnpm cam <model>` makes a ShopBot OpenSBP file (`.sbp`) for every board of a model with Fusion's CAM, driven through Fusion's local MCP server: no clicks. Files: `.docs/<model>/cam/<Board>_<setup>.sbp`, out of git, with a record of the run, `cam.json`.

**Simulate every `.sbp` before cutting** (Fusion, ShopBot Previewer), air-cut it first, check units, zero and tool against the machine.

## Prerequisites

- [ ] Fusion desktop (macOS or Windows), signed in. Fusion for Personal Use is enough (it posts ShopBot OpenSBP; its rapids run at the cutting feed, as the `.sbp` header says). Tested: 2706.1.17 (Help > About, or `app.version`; each run records it in `cam.json`).
- [ ] Preferences > General > API > *Fusion MCP Server (runs locally on this device)* on, port 27182 (else set `FUSION_MCP_URL`). Check: `pnpm cam --list-tools`.
- [ ] No command dialog open in Fusion while a run makes its setups. Documents already open are not touched.
- [ ] Node 24+, pnpm, `pnpm install`.
- [ ] The model's STEP, `.docs/<model>/<model>.step`: `nr build:parts` (ClassCAD sign-in, see the root README), or `--step`.
- [ ] The tools of [`tools.json`](tools.json) match the cutters on your ShopBot (only the 6 mm one is checked; the 8 and 12 mm presets are defaults to check).
- Nothing else: no Autodesk cloud, APS or sign-in for the script itself, no CI (Fusion runs on this machine).

## Run

```sh
pnpm cam --list-tools                          # what Fusion's MCP server offers
pnpm cam zigzag-chair --dry-run                # the plan, nothing sent
pnpm cam zigzag-chair
pnpm cam zigzag-chair --only Seat --force --keep   # then Simulate the setups in Fusion
pnpm cam --force                               # every model, every file made again
```

Per board and setup, one small Python step per call ([`fusion-job.py`](fusion-job.py)): the STEP imported into a new unsaved document (bodies named by their boxes); how the board lies, how high, the faces out of reach; the tool chosen; a milling setup with its operations; toolpaths waited for; posted to `.docs/<model>/cam/`; the document closed unsaved (also on Ctrl-C; `--keep` leaves it open). A file already there is kept (`--force` makes it again).

A board no tool reaches through fails, with no file. A file that does not cut its whole board is reported: `not reachable from the top: N faces (kind, where)`.

## Parameters

Every value the job uses. Strongest first: CLI flag, `parts[]`, `defaults`, the default here. The `.sbp` is set by these, the inputs hashed in `cam.json` and the Fusion version: the same give the same bytes.

| Parameter | Default | Manifest | CLI | What it does |
|---|---|---|---|---|
| STEP | `.docs/<model>/<model>.step` | | `--step` | the boards' shapes |
| boards | all of the STEP | `parts[].skip` | `--only A,B` | which boards get files |
| post | `shopbot` | `defaults.post` | `--post` | the Fusion library post whose vendor or description contains it, the shortest such (ShopBot OpenSBP) |
| tool | the narrowest of `tools.json` whose flute length reaches `height + overcut + reach`; of two as narrow, the shorter | `defaults.tool`, `parts[].tool` | `--tool` | the cutter; a named tool that does not reach fails the board |
| reach | 1 mm | `defaults.reach`, `parts[].reach` | | flute length to spare when choosing the tool |
| margin | 5 mm | `defaults.margin`, `parts[].margin` | `--margin` | stock around the board's box, on its sides; none above |
| WCS | | | | the model's axes as the board lies, origin at the stock's top, x-min y-min corner |
| lie | laid flat | `setups[].wcs.rotate` | | without listed setups: the board turned so its largest planar face lies down (tool from the opposite face); faces as large: the lowest turn, then the fewest faces out of reach, then the face already down. Listed setups: `wcs.rotate`, else as modelled |
| rotate | | `setups[].wcs.rotate` | | `[x, y, z]` degrees, in that order, about the board's box centre |
| cut | pockets and outline | `setups[].cut` | | `"squared"`: only the faces this setup squares, see below |
| spindle speed, feeds | the tool's preset | | | rpm; cutting, plunge and ramp (= plunge) feeds, mm/min |
| stepdown | the tool's preset | `defaults.stepdown`, `parts[].stepdown` | | deepest pass, even passes, mm |
| stepover | the tool's preset | `defaults.stepover`, `parts[].stepover` | | widest step across a pocket, mm |
| pockets | | | | 2D pocket on the pockets Fusion recognises in the setup's model, holes included |
| min pocket hole diameter | tool diameter + 0.5 mm | | | smaller holes are not pocketed |
| pocket corner radius | 0 to 1000 mm | | | any corner is pocketed |
| pocketStockToLeave | 0.5 mm | `defaults.pocketStockToLeave`, `parts[].pocketStockToLeave` | | wood left on pocket walls and floors for a finishing pass; 0: cut to size |
| outline | | | | 2D contour on the setup model's outside silhouette, outside, from the stock top through, multiple depths, cut to size |
| overcut | 0.3 mm | `defaults.overcut`, `parts[].overcut` | | how far the outline goes below the stock bottom (and a squared contour below its faces) |
| tabs | 4 per contour, 6 mm wide, 3 mm high, rectangular | `defaults.tabs`, `parts[].tabs` (`{ count, width, height }`, in part; `false`: none) | | holding tabs on the outline |
| coolant | off | | | |
| all else | Fusion's defaults for a 2D pocket, a 2D contour | | | e.g. heights (clearance 15 mm above the stock top), lead-in/out; fixed by the Fusion version |

## Tools

[`tools.json`](tools.json): the tool, as Fusion's tool JSON is built from it ([`machining.ts`](machining.ts)), and its preset. Flat end mills. **Defaults: check them against your cutters, wood and machine.**

| id | Ø mm | flutes | flute length mm | tool # | rpm | cutting mm/min | plunge/ramp mm/min | stepdown mm | stepover mm |
|---|---|---|---|---|---|---|---|---|---|
| `flat-6-2f` | 6 | 2 | 25 | 1 | 18000 | 2500 | 800 | 6 | 2.4 |
| `flat-8-2f` | 8 | 2 | 35 | 2 | 18000 | 3000 | 900 | 8 | 3.2 |
| `flat-12-2f` | 12 | 2 | 50 | 3 | 16000 | 3500 | 1000 | 10 | 4.8 |

Ramp angle 2 degrees for all.

## The record: `cam.json`

Beside the files, per file: its sha256, the values above as resolved (tool, feeds, stepdown, stepover, tabs, overcut, margin, rotation, cut, …), the faces out of reach, the post (vendor, description, version), the Fusion version, and the sha256 of the inputs (STEP, manifest, `tools.json`, `fusion-job.py`, `machining.ts`, `cam.ts`).

## The manifest: setups, wedges, values

- `.docs/<model>/<model>.cam.json`, generated by the build (not yet), read first;
- else `<model>/cam.config.json`, by hand.

```json
{
  "version": 1,
  "defaults": { "post": "shopbot", "margin": 5, "tabs": { "count": 4 } },
  "parts": [
    {
      "body": "Seat",
      "thickness": 19,
      "tool": "flat-6-2f",
      "setups": [
        { "name": "main" },
        { "name": "wedge8", "wedge": 8, "wcs": { "rotate": [8, 0, 0] }, "cut": "squared" }
      ]
    },
    { "body": "SeatCleat", "skip": true, "note": "the table saw" }
  ]
}
```

| Key | |
|---|---|
| `defaults` | `post` and the machining values (`tool`, `margin`, `overcut`, `reach`, `stepdown`, `stepover`, `pocketStockToLeave`, `tabs`), for every board |
| `parts[].body` | the STEP body's name |
| `parts[].<machining value>` | for this board |
| `parts[].skip` | no file for this board |
| `parts[].thickness`, `grain`, `visibleFaces`, `note` | for the maker; not used yet |
| `setups[].name` | the file's suffix: `<Board>_<name>.sbp` |
| `setups[].wcs.rotate` | how the board lies, see Parameters |
| `setups[].wedge` | the wedge's angle under the board, for the maker |
| `setups[].cut` | `"squared"` or none |

Unknown keys are errors.

`"cut": "squared"` (never the first setup): one 2D contour along the bottom edges of the planar faces upright in this setup (normal level within 0.05 degrees) but not in the board's first setup, on the waste side, from the stock top to `overcut` below their lowest point, without tabs. The tool is chosen for that depth. No such face is an error. The zigzag seat's `wedge8` cuts its tails' flanks and ends, square to the back leaning 8 degrees.

Faces a squared setup cuts are not reported out of reach in the board's other setups. The zigzag chair's angles' signs are not checked: look at each setup in Fusion before posting.
