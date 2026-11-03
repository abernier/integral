---
name: cam
description: Make, check and explain the ShopBot .sbp files of this repo's models with `pnpm cam` (Fusion desktop's local MCP server). Use when asked to generate, regenerate, verify or fix ShopBot/CAM/toolpath/.sbp files, or to change how parts are milled (sheets, wedges, tools, feeds, tabs).
---

# CAM: ShopBot files

Everything about the tool is in `scripts/cam/README.md` (prerequisites, parameters, tools, manifest, `cam.json`). Read it first; this skill is how to drive it.

Fusion decides how parts lie and nest (Arrange), the pockets and the toolpaths; the code groups parts by thickness, picks the tool and keeps the wedge setups. Do not add orientation or nesting logic: change a value or the manifest.

## Run

1. `pnpm cam --list-tools`. No answer: Fusion is closed, or its MCP server is off (Preferences > General > API > Fusion MCP Server); ask the user to fix it, that is theirs.
2. `pnpm cam <model> --force` (no model: every model). `--only <Part>` for some parts, `--keep` to leave the document open in Fusion.
3. Read the output: `no file for:` lists parts without a file (not a sheet part, no tool reaching, larger than the sheet); `nothing to cut for Pockets` is normal on a sheet without pockets. Report both.

## Check, before saying a file is good

- `.docs/<model>/cam/cam.json`: per file, its parts, thickness, tool, values.
- Each sheet `.sbp`: lowest Z = -(thickness + overcut); moves within the sheet; tabs (moves at -(thickness + overcut) + tab height); nothing below the tool's flute length (the run checks it).
- A part whose pockets are missing may lie the wrong face up: `"flip": true` in the manifest, rerun.
- Anything on a wedge: open it with `--keep`, screenshot it (`fusion_mcp_read` screenshot), look at it.
- Say what was not simulated. Never claim a file is safe to cut.

## In the workshop

How to explain the files to someone at the machine, in plain words:

- A sheet is one stock board clamped on the ShopBot, by default 2440 x 1220 mm, of one thickness.
- One `.sbp` per sheet, with every part of that thickness nested by Fusion: `<model>_<thickness>mm_<n>.sbp`, `n` the next sheet when one is full.
- Zero: the top of the sheet at its front-left corner.
- Parts stay held by tabs: cut them free, sand the stubs.
- A wedge file (`<Part>_<setup>.sbp`) is a second pass on a part already cut from its sheet, laid on its wedge; its zero is the top of the part as it lies there, 5 mm out from the front-left corner of its box.
- Simulate, then air-cut, before cutting wood.

## Change how parts are milled

Edit `<model>/cam.config.json` (`skip`, `flip`, wedge `setups`, `defaults`: sheet, spacing, tabs, ...) or `scripts/cam/tools.json` for cutters. Values are resolved in `scripts/cam.ts` / `machining.ts`; `fusion-job.py` only applies them. Rerun, compare `cam.json`; unchanged inputs give byte-identical files.

## Rules

- Fusion steps go one small Python script per MCP call. Never wait or loop inside Fusion (no `doEvents`, no sleep): it crashed Fusion. Poll from Node.
- Never touch a Fusion document the run did not create; close yours unsaved.
- Keep the model page's "ShopBot files" section in step with its manifest.
