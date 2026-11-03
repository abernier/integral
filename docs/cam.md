# CAM

Computer-aided manufacturing: the CNC files of a model, made by Fusion from the command line.

<Intro>

`pnpm cam <model>` makes the ShopBot files (`.sbp`) of a model. It drives Fusion's CAM through Fusion's local MCP server, with no clicking. It writes one file per sheet into `.docs/<model>/cam/`, outside git, with a record of the run in `cam.json`.

</Intro>

Fusion does the CAM work: it lays the parts out on the sheet (Arrange), finds the pockets, computes the toolpaths, works out what the main tool leaves behind (rest machining), and takes the feeds and stepdowns from its tool library.

The code only prepares Fusion's job. It groups the parts by material and thickness, turns each part so its grain runs along the sheet, picks the tool, passes the values, and adds the wedge setups that Arrange cannot do. Each step is one small script sent to Fusion, [`fusion-job.py`](https://github.com/abernier/integral/blob/main/scripts/cam/fusion-job.py); its header lists them.

**Simulate every `.sbp` before cutting**, in Fusion or the ShopBot Previewer. Air-cut it first. Check the units, the zero and the tool against the machine.

## Prerequisites

- [ ] Fusion desktop (macOS or Windows), signed in. Fusion for Personal Use is enough: it posts ShopBot OpenSBP, but its rapids run at the cutting feed, and with no tool change each tool gets its own file.
- [ ] Fusion's MCP server on: Preferences > General > API > *Fusion MCP Server (runs locally on this device)*. On another port, set `FUSION_MCP_URL`. `pnpm cam --list-tools` checks the connection.
- [ ] No command dialog open in Fusion during a run.
- [ ] The model's STEP at `.docs/<model>/<model>.step`, one component per part: `nr build:parts` makes it.
- [ ] The tools of [`tools.json`](https://github.com/abernier/integral/blob/main/scripts/cam/tools.json) match the cutters on your ShopBot, and their presets match your wood.

## Run

```sh
pnpm cam --help                        # every flag, its default
pnpm cam --list-tools                  # what Fusion's MCP server offers
pnpm cam zigzag-chair --dry-run        # the plan, nothing sent
pnpm cam zigzag-chair --force --keep   # then Simulate the setups in Fusion
pnpm cam --force                       # every model, every file made again
```

With `--keep`, the document stays open in Fusion: select a setup, Actions > Simulate, and watch the stock go.

![Fusion's Simulate on the zigzag chair's Seat_wedge8 setup: the seat on its wedge, the stock transparent, the tool cutting the dovetails' walls](https://abernier.github.io/integral/integral/cam/simulate.png)

Files that already exist are left alone, so a run is cheap to repeat. To work on one part, `--only <part>` writes to a folder of its own.

A part with no flat face, too thick for every tool, or larger than the sheet gets no file, and the run says so. A toolpath Fusion warns about fails the run.

The files cut in 2.5D, from the top only: vertical walls, inside corners rounded to the tool's radius. Bevels, sloped walls, square corners, and whatever the rest pass cannot reach are hand work. Each model's page lists them; `--only <part> --keep` lets you Simulate one in Fusion.

## Machining values

The CLI flag wins, then the model's `CAM.defaults`, then the defaults of [`machining.ts`](https://github.com/abernier/integral/blob/main/scripts/cam/machining.ts), where `MachiningOptions` documents each value. Same inputs and Fusion version, same bytes.

**The tool** is picked per sheet: the narrowest one in `tools.json` long enough for the sheet, or `--tool <number>`.

**Tabs** hold the parts in the sheet; `tabs.height` is the wood they leave, `false` means none.

**Grain.** In a material with grain, each part's grain runs along its length, which is the sheet's x; Arrange may only turn a part by 180°. A part's `grain` adds degrees, for a near-square part or a loose tenon whose grain should cross its joint.

Everything else is fixed by [`fusion-job.py`](https://github.com/abernier/integral/blob/main/scripts/cam/fusion-job.py): parts lie largest face down (a part's `flip` turns it up), pockets first, then the outline with tabs, then a rest pass with the narrowest tool in its own file.

## Catalogs

| File | What it holds | Edited |
| --- | --- | --- |
| [`tools.json`](https://github.com/abernier/integral/blob/main/scripts/cam/tools.json) | The cutters and their feed presets per material: a Fusion tool library | In Fusion's Tool Library, exported as JSON |
| [`materials.json`](https://github.com/abernier/integral/blob/main/scripts/cam/materials.json) | Each material: whether it has grain, the name of its tool presets, its Fusion stock material | By hand |

**Adjust the feeds by the chips and the burn marks.**

## Config

What Fusion cannot know from the STEP (parts to skip, grain turns, flips, wedge setups, the model's material and post) is the optional `CAM` export of the model's module, typed `CamConfig` in [`config.ts`](https://github.com/abernier/integral/blob/main/scripts/cam/config.ts). Examples: [zigzag chair](https://github.com/abernier/integral/blob/main/zigzag-chair/zigzag-chair.ts), [compass armchair](https://github.com/abernier/integral/blob/main/compass-armchair/compass-armchair.ts).

## The record: `cam.json`

Each run writes it beside the files. It says what each file is, which tool it uses, which parts lie where on which sheet, every value given to Fusion, and the hash of every input, so a file can be made again the same (`CamRecord` in [`cam.ts`](https://github.com/abernier/integral/blob/main/scripts/cam.ts)).

## Cutting the files

A sheet is one board clamped on the ShopBot, of one material and thickness (its size is in `cam.json`), its grain along its length, the x axis. Its zero is its top, at the front-left corner (x-min, y-min).

```text
.docs/<model>/cam/
├── cam.json                      # the record of the run
├── <model>_oak_18mm_1.sbp        # every 18 mm oak part that fits on sheet 1, with the sheet's tool
├── <model>_oak_18mm_1_rest.sbp   # the same sheet, same zero, with the narrowest tool: what the first was too wide for
├── <model>_oak_18mm_2.sbp        # the rest of the 18 mm oak parts, on sheet 2
├── Leg_wedge10.sbp               # a second pass on the Leg, cut out and laid on its wedge
└── only/                         # --only runs
```

A wedge file's zero is the top of the part on its wedge, `margin` out from the front-left corner of its box.

What the rest pass cannot reach below its depth is hand work. The parts stay held by their tabs: cut them free and sand the stubs.

Simulate, then air-cut, before cutting wood.
