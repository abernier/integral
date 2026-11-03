# integral

We integrate others' work into things.

<Intro>

Real objects, designed and made with whatever tools fit: CAD, code, machines.

</Intro>

## Parts

| | Part |
|---|---|
| <a href="https://abernier.github.io/integral/things/compass-armchair"><img src="https://abernier.github.io/integral/compass-armchair/compass-armchair.png" alt="Compass armchair" width="72" /></a> | **[Compass armchair](https://abernier.github.io/integral/things/compass-armchair)**: A cane armchair on compass legs, after the 1955 Chandigarh office chair, parametric, in teak. |
| <a href="https://abernier.github.io/integral/things/zigzag-chair"><img src="https://abernier.github.io/integral/zigzag-chair/zigzag-chair.png" alt="Zigzag chair" width="72" /></a> | **[Zigzag chair](https://abernier.github.io/integral/things/zigzag-chair)**: Rietveld's 1934 Zig-Zag chair, parametric, in cherry. |

## Build

<Steps>

<Step>Install</Step>

```sh
pnpm install
```

<Step>Work on the site, live</Step>

```sh
nr dev        # localhost:3000; saving a part's .ts rebuilds it
```

<Step>Check and build</Step>

```sh
nr typecheck  # tsc --noEmit
nr build      # parts + site into dist/
```

</Steps>

- Part: `<folder>/<folder>.ts` + `README.md`; generated files stay out of git
- Configurator: `configurator/` (Vite + r3f + leva, the "Model" tab; `nr dev:configurator` runs it alone, `nr test` checks each model's defaults against the part's `MASTERS`); a part adds `<folder>/<folder>.model.ts` (`schema`, `build`) and registers it in `configurator/src/models.ts`
- Engine key: local ClassCAD sign-in; in CI, the `CLASSCAD_TOKEN` secret
- Deploy: every push to `main`, GitHub Pages; every pull request, a Vercel preview (`vercel.json`, the engine key in its `CLASSCAD_TOKEN` variable)
