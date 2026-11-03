---
name: cam
description: Make, check and simulate this repo's ShopBot `.sbp` files with `pnpm cam` and the Fusion desktop app (its local MCP server, its UI). Use when asked to generate or regenerate CAM files, check a toolpath, simulate a sheet or a wedge in Fusion (with or without the ShopBot), change how parts are milled (sheets, wedges, tools, feeds, tabs), or set up the machine.
---

# CAM

`docs/cam.md` is the overview: what Fusion decides, what the code prepares, the flags' spirit, `cam.json`, the files, the ShopBot's Fusion setup. Read it first. `pnpm cam --help` holds the flags; `scripts/cam/fusion-job.py`'s header lists the steps sent to Fusion. This skill is how an agent drives all of it; [FUSION.md](FUSION.md) is how to act in Fusion itself.

Fusion decides how parts lie and nest (Arrange), the pockets, the toolpaths, the rest machining, the feeds (its tool library's presets). A change in how parts are milled is a value: the model's `CAM` config, `tools.json`, `materials.json`, or `machining.ts`.

## Run

1. `pnpm cam --list-tools`. An answer means Fusion and its MCP server are up. The agent reaches the same server as the `fusion` MCP of `.mcp.json` (its `fusion_mcp_*` tools). No answer: Fusion is closed, its MCP server is off, or a dialog is open; [FUSION.md](FUSION.md) says which you can fix.
2. `pnpm cam <model> --force`, for the model the user named; none named, ask which (checking and simulating go model by model). `pnpm cam --force` with no model remakes every model: only after a change shared by all (`tools.json`, `materials.json`, `machining.ts`, `fusion-job.py`, `cam.ts`). Then, with `--keep` when anything is to be simulated, `--only <Part>` for some parts (into `cam/only/`). Long runs go in the background.
3. Read the whole output. `no file for:` lists parts without a file; `nothing to cut for Pockets` is normal on a sheet without pockets; `toolpaths with warnings` are Fusion's own. Report each as it is.

Done when every part of the model has a file or is named in `no file for:`.

## Check

Before calling a file good, each of these, against `.docs/<model>/cam/cam.json` (`cam/only/cam.json` after `--only`):

- Depth: a sheet's `deepest` is its thickness plus the overcut; nothing below the tool's flutes (the run checks it). A `_rest` file: the narrowest tool, no deeper than its flutes less `reach`, nor its stickout less `nutClearance`.
- Grain: in `boxes`, each part of a material with grain is longer along x than y, unless its config turns it. The grain crosses every joint edge (tails, fingers, a loose tenon's length): a near-square part or a tenon needs a `grain`.
- Pockets missing on a part: it may lie the wrong face up; `flip: true` in the `CAM` config, rerun.
- Simulate: every sheet with `--keep` in Fusion, with the ShopBot on the setup, and read its collisions ([FUSION.md](FUSION.md)). A wedge and any hand work: look at it in Simulate, keep the model page's "By hand" list in step.

Report what was simulated and what was not. The user decides a file is safe to cut, after an air cut.

## Change how parts are milled

Edit the `CAM` export of `<model>/<model>.ts` (typed `CamConfig` in `scripts/cam/config.ts`), `materials.json`, or `tools.json` (exported from Fusion's Tool Library, as the page says). Values resolve in `scripts/cam.ts` and `machining.ts`; `fusion-job.py` applies them. Rerun and compare `cam.json`: unchanged inputs give byte-identical files.

## Rules

- One home per fact: a skip, turn, wedge or material's reason is a comment on its `CAM` entry; a value lives in `CAM`, a catalog JSON or `machining.ts`; a value the model's `MASTERS` holds is read from there. A model page names the command, links its `.ts`, and keeps its hand-work list only.
- Fusion steps go one small Python script per MCP call, and Node polls between them. Fusion stays idle while it generates: a wait or a loop inside a script (`doEvents`, sleep) crashed it.
- The run's documents are yours, closed unsaved or left open with `--keep`. Every other Fusion document is the user's: read it, change nothing in it.
