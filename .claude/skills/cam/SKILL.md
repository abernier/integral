---
name: cam
description: Make, check and explain the ShopBot .sbp files of this repo's models with `pnpm cam` (Fusion desktop's local MCP server). Use when asked to generate, regenerate, verify or fix ShopBot/CAM/toolpath/.sbp files, or to change how a board is milled (setups, wedges, tools, feeds, tabs).
---

# CAM: ShopBot files

Everything about the tool is in `scripts/cam/README.md` (prerequisites, parameters, tools, manifest, `cam.json`). Read it first; this skill is how to drive it.

## Run

1. `pnpm cam --list-tools`. No answer: Fusion is closed, or its MCP server is off (Preferences > General > API > Fusion MCP Server); ask the user to fix it, that is theirs.
2. `pnpm cam <model> --force` (no model: every model). `--only <Part>` for one board, `--keep` to leave the document open in Fusion.
3. Read the output: a board that no tool reaches through has no file; `not reachable from the top` lists faces left for hand work or another setup. Report both.

## Check, before saying a file is good

- `.docs/<model>/cam/cam.json`: tool, values, rotation per file.
- Each `.sbp`: lowest Z = -(thickness + overcut); cutting moves around the part, tool radius outside it; tabs on the last pass; nothing below the tool's flute length.
- Anything rotated or `cut: squared`: open it with `--keep`, screenshot it (`fusion_mcp_read` screenshot), look at it.
- Say what was not simulated. Never claim a file is safe to cut.

## Change how a board is milled

Edit `<model>/cam.config.json` (setups, `wcs.rotate`, `cut: "squared"`, per-part values), or `scripts/cam/tools.json` for cutters. Values are resolved in `scripts/cam.ts` / `machining.ts`; `fusion-job.py` only applies them. Rerun, compare `cam.json`; unchanged inputs give byte-identical files.

## Rules

- Fusion steps go one small Python script per MCP call. Never wait or loop inside Fusion (no `doEvents`, no sleep): it crashed Fusion. Poll from Node.
- Never touch a Fusion document the run did not create; close yours unsaved.
- Keep the model page's "ShopBot files" section in step with its manifest.
