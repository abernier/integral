# CAM: ShopBot files from Fusion, from the command line

`pnpm cam <model>` makes the ShopBot OpenSBP files (`.sbp`) of a model with Fusion's CAM, driven through Fusion's local MCP server: no clicks. One file per sheet: `.docs/<model>/cam/<model>_<material>_<thickness>mm_<n>.sbp`, and `…_rest.sbp` when the narrowest tool has rest to take, out of git, with a record of the run, `cam.json`.

Fusion decides what it can: how each part lies and where on the sheet (Arrange), the pockets (recognition), the toolpaths, what the main tool leaves (rest machining), the feeds and stepdowns (its tool library's presets). The code only groups the parts by material and thickness, turns each part's grain along the sheet, picks the tool, passes the values, and keeps the wedge setups Arrange cannot do.

**Simulate every `.sbp` before cutting** (Fusion, ShopBot Previewer), air-cut it first, check units, zero and tool against the machine.

## Prerequisites

- [ ] Fusion desktop (macOS or Windows), signed in. Fusion for Personal Use is enough (it posts ShopBot OpenSBP; its rapids run at the cutting feed, as the `.sbp` header says; it posts no tool change, so each tool has its own file). Tested: 2706.1.17 (each run records it in `cam.json`).
- [ ] Preferences > General > API > *Fusion MCP Server (runs locally on this device)* on, port 27182 (else set `FUSION_MCP_URL`). Check: `pnpm cam --list-tools`.
- [ ] No command dialog open in Fusion during a run. Documents already open are not touched.
- [ ] The model's STEP, `.docs/<model>/<model>.step`, an assembly with one component per part: `nr build:parts`, or `--step`.
- [ ] The tools of [`tools.json`](tools.json) match the cutters on your ShopBot, their presets your wood.

## Run

```sh
pnpm cam --list-tools                  # what Fusion's MCP server offers
pnpm cam zigzag-chair --dry-run        # the plan, nothing sent
pnpm cam zigzag-chair --force --keep   # then Simulate the setups in Fusion
pnpm cam --force                       # every model, every file made again
```

One small Python step per MCP call ([`fusion-job.py`](fusion-job.py)): import the STEP into a new unsaved document; each part's thickness (across its largest planar face, to 0.1 mm); per material and thickness, an Arrange feature per sheet (what does not fit goes on the next); per sheet a setup, its toolpaths, the posts; per wedge setup the same; the document closed unsaved (also on Ctrl-C; `--keep` leaves it open). Files already there: nothing done (`--force` makes them all again, the old ones removed first; with `--only`, only the sheets of those parts, under the same names).

No file, reported: a part without a planar face, a thickness no tool cuts through, a part larger than the sheet.

The files cut 2.5D, from the top only: vertical walls, inside corners at the tool's radius. Bevels, sloped walls, square corners, and what the rest pass leaves below its depth are hand work, listed on each model's page; check them with `pnpm cam <model> --only <part> --keep` and Fusion's Simulate.

## Parameters

Strongest first: CLI flag, manifest `defaults`, the default here. Same inputs and Fusion version: same bytes (checked: two runs, same hashes).

| Parameter | Default | CLI | What it does |
|---|---|---|---|
| STEP | `.docs/<model>/<model>.step` | `--step` | the parts' shapes and names |
| parts | all of the STEP | `--only A,B` | manifest `skip` leaves a part out |
| post | `shopbot` | `--post` | the Fusion library post whose vendor or description contains it, the shortest such (ShopBot OpenSBP) |
| sheet | `[2440, 1220]` | `--sheet 2440x1220` | the stock board, mm |
| spacing | 12 | `--spacing` | between two parts on a sheet; per sheet at least its tool's diameter + 4, so the outline passes between them |
| frame | 20 | | kept free along the sheet's edges, the outline's lead-in within it |
| material | `hardwood` | | a material of [`materials.json`](materials.json): its grain, its tool preset |
| tool | the narrowest of `tools.json` whose flutes reach `thickness + overcut + reach` | `--tool <number>` | the cutter, per sheet |
| reach | 1 | | flute length to spare when choosing the tool |
| overcut | 0.3 | | how far the outline cuts below the sheet, into the spoilboard |
| tabs | `{ count: 4, width: 6, height: 3 }` | | rectangular, per contour; `height`: the wood a tab leaves (Fusion is given `height + overcut`, from the cut's bottom); `false`: none |
| margin | 5 | | stock around a part in its own (wedge) setup |

Fixed: parts laid largest planar face down (manifest `flip`: up), part-in-part off; stock = the sheet, its bottom on the parts', its material Fusion's library one (`materials.json` `stock`); WCS at the sheet's top, x-min y-min corner; a 2D pocket on the pockets Fusion recognises (holes the tool fits in), to size, inside corners at the tool's radius, with Fusion's finishing pass on the walls; a 2D contour outside each part's silhouette, through; then the same contour with Fusion's rest machining (what a tool of the main one's diameter leaves) and the narrowest tool, down to its flutes less `reach`, in its own file; feeds, speeds, stepdown, stepover from the tool's preset for the material, in even passes; all else Fusion's defaults.

Grain: a material with grain (`materials.json`) keeps each part's grain along its length, the sheet's x: Fusion's Arrange is given each part's rotation (from its zero direction to its longest side, as Fusion's smallest box around it finds it) and may only turn it 180°. Fusion's own grain direction (the envelope's) needs the Manufacturing Extension, so it is not used. Manifest `grain`: degrees more, per part: a near-square part (the zigzag's Back) or a loose tenon whose longest side runs along its joint needs it, so its grain crosses its joint. A material without grain: any rotation.

## Tools

[`tools.json`](tools.json): a Fusion tool library, in Fusion's own JSON, sent as is (`ToolLibrary.createFromJson`); the code reads only each tool's number, diameter and flute length, to pick one. To edit it in Fusion:

1. Manufacture > Manage > Tool Library: right-click a local folder, Import, `tools.json`.
2. Edit the tools and their presets.
3. Right-click the library, Export, over `tools.json` (JSON).

CMT 191 upcut spirals, 2 flutes. Preset `Hardwood`: Onsrud/Amana hardwood chip loads at ShopBot's 12000-18000 rpm; stepdown 1 x Ø (10 at most), stepover 0.4 Ø. The post writes one feed per operation (`MS`): ramps and lead-ins run at the cutting feed, whatever the preset's ramp feed. **Adjust by the chips and burn marks.** Presets `Plywood` and `MDF`: the same values, unsourced defaults.

| # | Ø x flutes x overall, mm | shank | rpm | feed mm/min | plunge mm/min | stepdown | stepover |
|---|---|---|---|---|---|---|---|
| 1 | 6 x 27 x 70 | 6 | 16000 | 4200 | 1000 | 6 | 2.4 |
| 2 | 8 x 32 x 80 | 8 | 16000 | 4500 | 1200 | 8 | 3.2 |
| 3 | 8 x 42 x 90 | 8 | 16000 | 4500 | 1200 | 8 | 3.2 |
| 4 | 12 x 52 x 100 | 12 | 14000 | 5000 | 1500 | 10 | 4.8 |

## Materials

[`materials.json`](materials.json): per material, `grain` (parts keep it along their length), `preset` (the tool presets' name), `stock` (Fusion's library stock material, if any). `hardwood`, `cherry`, `teak`: grain, `Hardwood`. `plywood` (cross-plied: as strong any way in the sheet, so free rotation; the face veneer's look is not kept), `mdf`: no grain, `Plywood`, `MDF`. A model's material: manifest `defaults.material`, a part's own: `parts[].material`; one sheet per material and thickness.

## The manifest

`.docs/<model>/<model>.cam.json` (generated by the build, not yet), else `<model>/cam.config.json`. Optional. Unknown keys are errors.

```json
{
  "version": 1,
  "defaults": { "post": "shopbot", "material": "cherry", "sheet": [2440, 1220], "tabs": { "count": 4 } },
  "parts": [
    { "part": "SeatCleat", "skip": true, "note": "the table saw" },
    { "part": "Back", "flip": true },
    { "part": "Slant", "material": "plywood", "grain": 90 },
    { "part": "Seat", "setups": [{ "name": "wedge8", "wedge": 8, "rotate": [8, 0, 0], "cut": "squared" }] }
  ]
}
```

| Key | |
|---|---|
| `defaults` | `post` and the parameters above, `material` among them |
| `parts[].part` | the STEP component's name |
| `parts[].skip`, `note` | no file for this part; why |
| `parts[].flip` | laid largest planar face up instead of down |
| `parts[].material` | this part's material, its own sheets |
| `parts[].grain` | degrees between its grain and its length (default 0), for a material with grain |
| `parts[].setups` | setups of the part alone, one file each, `<Part>_<name>.sbp`, beside its sheet |
| `setups[].rotate` | `[x, y, z]` degrees, in that order, about the part's box centre |
| `setups[].wedge` | the wedge's angle, for the maker |
| `setups[].cut` | `"squared"`: one 2D contour along the bottom edges of the faces upright as turned but not as modelled (the part must be modelled flat), on the waste side, to `overcut` below their lowest point, no tabs; the tool chosen for that depth. Else pockets and outline |

## The record: `cam.json`

Per file: its sha256; for a sheet, its material, thickness, number, parts, their grain turn, where they lie (`partsBox` and per part `boxes`, mm from the corner), size, spacing, frame; for a wedge setup, its turn, depth, margin; the tool and every value given to Fusion; for a `_rest` file, its tool and depth; the deepest cut; the post and its version; the Fusion version; the sha256 of the inputs (STEP, manifest, `tools.json`, `materials.json`, `fusion-job.py`, `machining.ts`, `cam.ts`).

## In the workshop

- A sheet is one stock board clamped on the ShopBot, by default 2440 x 1220 mm, of one material and thickness, its grain along its length (x).
- One `.sbp` per sheet: every part of that material and thickness, nested by Fusion. `<model>_<material>_<thickness>mm_<n>.sbp`: `n` is the next sheet when one is full.
- Then, if there is one, `…_rest.sbp` on the same sheet, same zero, after changing to its tool (the narrowest): the sockets and corners the first tool was too wide for. Below its depth, by hand (the model's page lists it).
- Zero: the top of the sheet, at its front-left corner (x-min, y-min).
- Parts stay held by tabs, 3 mm of wood: cut them free, sand the stubs.
- A wedge file (`<Part>_<setup>.sbp`) is a second pass on a part already cut from its sheet, laid on its wedge; its zero: the top of the part as it lies on the wedge, 5 mm (`margin`) out from the front-left corner of its box.
- Simulate, then air-cut, before cutting wood.
