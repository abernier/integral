---
name: cam
description: Make, check and explain the ShopBot .sbp files of this repo's models with `pnpm cam` (Fusion desktop's local MCP server). Use when asked to generate, regenerate, verify or fix ShopBot/CAM/toolpath/.sbp files, or to change how parts are milled (sheets, wedges, tools, feeds, tabs).
---

# CAM: ShopBot files

The tool is documented on the site page `docs/cam.md` (prerequisites, run, parameters, catalogs, config, `cam.json`, in the workshop). Read it first, and explain the files from its "In the workshop"; this skill is only how an agent drives it.

Fusion decides how parts lie and nest (Arrange), the pockets, the toolpaths, the rest machining, the feeds (its tool library's presets). Do not add orientation, nesting or feed logic: change a value, the model's `CAM` config, `tools.json` or `materials.json`.

## Run

1. `pnpm cam --list-tools`. No answer: Fusion is closed, or its MCP server is off; ask the user to fix it, that is theirs.
2. `pnpm cam <model> --force` (no model: every model). `--only <Part>` for some parts (into `.docs/<model>/cam/only/`, the full run's files untouched), `--keep` to leave the document open in Fusion.
3. Read the output: `no file for:` lists parts without a file; `nothing to cut for Pockets` is normal on a sheet without pockets. Report both. `toolpaths with warnings`: Fusion's own, report them as they are; never hide one.

## Check, before saying a file is good

- `.docs/<model>/cam/cam.json` (`cam/only/cam.json` after `--only`): per file, its parts, material, thickness, tool, values.
- Each sheet `.sbp`: lowest Z = -(thickness + overcut); moves within the sheet; tabs (wood left = tab height); nothing below the tool's flute length (the run checks it). A `_rest.sbp`: the narrowest tool, no deeper than its flutes less `reach`, nor its stickout less `nutClearance`.
- Grain: in `cam.json` `boxes`, each part of a material with grain is longer along x than y (unless its config turns it). The grain must cross every joint edge (tails, fingers, a loose tenon's length): a near-square part or a tenon needs a `grain` in the config.
- A part whose pockets are missing may lie the wrong face up: `flip: true` in the model's `CAM` config, rerun.
- Anything on a wedge: open it with `--keep`, screenshot it (`fusion_mcp_read` screenshot), look at it.
- Hand work (bevels, sloped walls, square corners, below the rest pass): check with `--only <part> --keep` and Fusion's Simulate; keep the model page's "By hand" list in step.
- Say what was not simulated. Never claim a file is safe to cut.

## Change how parts are milled

Edit the `CAM` export of `<model>/<model>.ts` (typed `CamConfig`, `scripts/cam/config.ts`), `scripts/cam/materials.json`, or `scripts/cam/tools.json` (through Fusion, as the page says; never by hand). Values are resolved in `scripts/cam.ts` / `machining.ts`; `fusion-job.py` only applies them. Rerun, compare `cam.json`; unchanged inputs give byte-identical files.

## Rules

- One home per fact: a skip, turn, wedge or material's reason goes in a comment on its `CAM` entry, a value in `CAM`, a catalog JSON or `machining.ts`; a value the model's `MASTERS` holds is used from there, never copied. A model page names the command and links its `.ts`; it keeps only its hand-work list. Never copy files, tools, sheets or values onto a page.
- Fusion steps go one small Python script per MCP call. Never wait or loop inside Fusion (no `doEvents`, no sleep): it crashed Fusion. Poll from Node.
- Never touch a Fusion document the run did not create; close yours unsaved.
