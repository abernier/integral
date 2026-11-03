# CAM

ShopBot files from Fusion, from the command line.

<Intro>

`pnpm cam <model>` makes the ShopBot OpenSBP files (`.sbp`) of a model with Fusion's CAM, driven through Fusion's local MCP server: no clicks. One file per sheet, into `.docs/<model>/cam/`, out of git, with a record of the run, `cam.json`.

</Intro>

Fusion decides what it can: how each part lies and where on the sheet (Arrange), the pockets (recognition), the toolpaths, what the main tool leaves (rest machining), the feeds and stepdowns (its tool library's presets). The code only groups the parts by material and thickness, turns each part's grain along the sheet, picks the tool, passes the values, and keeps the wedge setups Arrange cannot do.

**Simulate every `.sbp` before cutting** (Fusion, ShopBot Previewer), air-cut it first, check units, zero and tool against the machine.

## Prerequisites

- [ ] Fusion desktop (macOS or Windows), signed in. Fusion for Personal Use is enough (it posts ShopBot OpenSBP; its rapids run at the cutting feed, as the `.sbp` header says; it posts no tool change, so each tool has its own file). Each run records the Fusion version in `cam.json`.
- [ ] Preferences > General > API > *Fusion MCP Server (runs locally on this device)* on (another port: set `FUSION_MCP_URL`). Check: `pnpm cam --list-tools`.
- [ ] No command dialog open in Fusion during a run. Documents already open are not touched.
- [ ] The model's STEP, `.docs/<model>/<model>.step`, an assembly with one component per part: `nr build:parts`, or `--step`.
- [ ] The tools of [`tools.json`](https://github.com/abernier/integral/blob/main/scripts/cam/tools.json) match the cutters on your ShopBot, their presets your wood.

## Run

```sh
pnpm cam --help                        # every flag, its default
pnpm cam --list-tools                  # what Fusion's MCP server offers
pnpm cam zigzag-chair --dry-run        # the plan, nothing sent
pnpm cam zigzag-chair --force --keep   # then Simulate the setups in Fusion
pnpm cam --force                       # every model, every file made again
```

Or ask an agent: "make the ShopBot files of the zigzag chair" (skill `cam`).

One small Python step per MCP call ([`fusion-job.py`](https://github.com/abernier/integral/blob/main/scripts/cam/fusion-job.py)): import the STEP into a new unsaved document; each part's thickness (across its largest planar face); per material and thickness, an Arrange feature per sheet (what does not fit goes on the next); per sheet a setup, its toolpaths, the posts; per wedge setup the same; the document closed unsaved (also on Ctrl-C; `--keep` leaves it open). Files already there: nothing done (`--force` makes them all again, the old ones removed first; with `--only`, only the sheets of those parts, under the same names).

No file, reported: a part without a planar face, a thickness no tool cuts through, a part larger than the sheet.

The files cut 2.5D, from the top only: vertical walls, inside corners at the tool's radius. Bevels, sloped walls, square corners, and what the rest pass leaves below its depth are hand work, listed on each model's page; check them with `pnpm cam <model> --only <part> --keep` and Fusion's Simulate.

## Parameters

Strongest first: CLI flag (`pnpm cam --help`), manifest `defaults`, the defaults of [`machining.ts`](https://github.com/abernier/integral/blob/main/scripts/cam/machining.ts) (`MACHINING_DEFAULTS`, each value documented on `MachiningOptions`). Same inputs and Fusion version: same bytes.

The tool, per sheet: the narrowest of `tools.json` whose flutes reach the sheet's thickness, `overcut` below it, and `reach` to spare; or `--tool <number>`. Tabs: `height` is the wood a tab leaves (Fusion is given `height + overcut`, from the cut's bottom); `false`: none.

Fixed: parts laid largest planar face down (manifest `flip`: up), part-in-part off; stock = the sheet, its bottom on the parts', its material Fusion's library one (`materials.json` `stock`); WCS at the sheet's top, x-min y-min corner; a 2D pocket on the pockets Fusion recognises (holes the tool fits in), to size, inside corners at the tool's radius, with Fusion's finishing pass on the walls; a 2D contour outside each part's silhouette, through; then the same contour with Fusion's rest machining (what a tool of the main one's diameter leaves) and the narrowest tool, down to its flutes less `reach`, in its own file; feeds, speeds, stepdown, stepover from the tool's preset for the material, in even passes; all else Fusion's defaults.

Grain: a material with grain keeps each part's grain along its length, the sheet's x: Fusion's Arrange is given each part's rotation (from its zero direction to its longest side, as Fusion's smallest box around it finds it) and may only turn it 180°. Fusion's own grain direction (the envelope's) needs the Manufacturing Extension, so it is not used. Manifest `grain`: degrees more, per part, so a near-square part or a loose tenon gets its grain across its joint. A material without grain: any rotation.

## Catalogs

- [`tools.json`](https://github.com/abernier/integral/blob/main/scripts/cam/tools.json): the cutters, their sizes and feed presets per material (each tool's and preset's `description` says what it is and where its values come from). A Fusion tool library, in Fusion's own JSON, sent as is; the code reads only each tool's number, diameter and flute length, to pick one. The post writes one feed per operation (`MS`): ramps and lead-ins run at the cutting feed, whatever the preset's ramp feed. **Adjust by the chips and burn marks.**
- [`materials.json`](https://github.com/abernier/integral/blob/main/scripts/cam/materials.json): per material, `grain` (parts keep it along their length), `preset` (the tool presets' name), `stock` (Fusion's library stock material, if any). A model's material: manifest `defaults.material`, a part's own: `parts[].material`; one sheet per material and thickness.

To edit `tools.json`, in Fusion:

1. Manufacture > Manage > Tool Library: right-click a local folder, Import, `tools.json`.
2. Edit the tools and their presets (one per material, named as in `materials.json`).
3. Right-click the library, Export, over `tools.json` (JSON).

## The manifest

`<model>/cam.config.json`, hand-written, optional (`.docs/<model>/<model>.cam.json` first, if a build ever generates one). Unknown keys are errors. Its keys are documented at the top of [`manifest.ts`](https://github.com/abernier/integral/blob/main/scripts/cam/manifest.ts); a part's `note` says why it is skipped, turned or set up on a wedge. Examples: [zigzag chair](https://github.com/abernier/integral/blob/main/zigzag-chair/cam.config.json), [compass armchair](https://github.com/abernier/integral/blob/main/compass-armchair/cam.config.json).

## The record: `cam.json`

Generated by each run beside the files, out of git. Per file: its sha256; for a sheet, its material, thickness, number, parts, their grain turn, where they lie (`partsBox` and per part `boxes`, mm from the corner), size, spacing, frame; for a wedge setup, its turn, depth, margin; the tool and every value given to Fusion; for a `_rest` file, its tool and depth; the deepest cut; the post and its version; the Fusion version; the sha256 of the inputs (STEP, manifest, `tools.json`, `materials.json`, `fusion-job.py`, `machining.ts`, `cam.ts`). What a model's files are, which tool, which parts on which sheet: read it there.

## In the workshop

- A sheet is one stock board clamped on the ShopBot, of one material and thickness (its size: `cam.json`), its grain along its length (x).
- One `.sbp` per sheet: every part of that material and thickness, nested by Fusion. `<model>_<material>_<thickness>mm_<n>.sbp`: `n` is the next sheet when one is full.
- Then, if there is one, `…_rest.sbp` on the same sheet, same zero, after changing to its tool (the narrowest): the sockets and corners the first tool was too wide for. Below its depth, by hand (the model's page lists it).
- Zero: the top of the sheet, at its front-left corner (x-min, y-min).
- Parts stay held by tabs (the wood they leave: `tabs.height`): cut them free, sand the stubs.
- A wedge file (`<Part>_<setup>.sbp`) is a second pass on a part already cut from its sheet, laid on its wedge; its zero: the top of the part as it lies on the wedge, `margin` out from the front-left corner of its box.
- Simulate, then air-cut, before cutting wood.
