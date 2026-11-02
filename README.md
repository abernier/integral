# integral

Parametric furniture parts, modeled in [ClassCAD](https://classcad.ch): each part is a
history-based `.ofb` that opens in [Buerligons](https://buerligons.io), where its dimensions can
be changed and the model rebuilds. The site is at https://abernier.github.io/integral.

| Part | Files |
|---|---|
| [Zigzag chair](https://abernier.github.io/integral/zigzag-chair/introduction) ([open in Buerligons](https://buerligons.io/editor/?url=https://abernier.github.io/integral/zigzag-chair/zigzag-chair.ofb)) | [`.ofb`](https://abernier.github.io/integral/zigzag-chair/zigzag-chair.ofb), [STEP](https://abernier.github.io/integral/zigzag-chair/zigzag-chair.step), [render](https://abernier.github.io/integral/zigzag-chair/zigzag-chair.png); parameters and a comparison with smlibpy on its page |

A part is a folder holding a TypeScript module (`<folder>/<folder>.ts`, whose default export builds the part
given the ClassCAD script API, typed by `@classcad/api-js`) and a README. Only those are in git: the `.ofb`,
STEP and render are built.

## Build

Node 24 and pnpm; `nr` is [antfu's ni](https://github.com/antfu-collective/ni) (`pnpm run` works as well).

```sh
pnpm install
nr build        # every part with ClassCAD, then the site into dist/
nr build:parts  # the parts alone, into .docs/
nr typecheck    # tsc --noEmit, the parts against the ClassCAD API types
nr dev          # the site on http://localhost:3000, live: a README or a part's script changes, it follows
```

The parts are built on ClassCAD's WASM engine, headless, in this process. The engine needs a key:

- locally, from this machine's ClassCAD sign-in (`~/.classcad-mcp/auth.json`, made by the ClassCAD MCP's `login`);
- in CI, from a `CLASSCAD_TOKEN` repository secret: a secret access token (`ccsk_...`) made at
  [classcad.ch/account](https://classcad.ch/account).

The site is made by [`@pmndrs/docs`](https://docs.pmnd.rs) from the READMEs, and deployed to GitHub Pages
on every push to `main` (`.github/workflows/pages.yml`).

The ClassCAD MCP (`@classcad/mcp`) is also enabled here as a Claude Code plugin (`.claude/settings.json`),
for modeling a part interactively.
