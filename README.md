# integral

Parametric furniture parts in ClassCAD.

<Intro>

Each part is a [ClassCAD](https://classcad.ch) model with its history: open it in [Buerligons](https://buerligons.io), change a dimension, it rebuilds.

</Intro>

## Parts

| | Part | Files |
|---|---|---|
| <a href="https://abernier.github.io/integral/zigzag-chair/introduction"><img src="https://abernier.github.io/integral/zigzag-chair/zigzag-chair.png" alt="Zigzag chair" width="160" /></a> | **[Zigzag chair](https://abernier.github.io/integral/zigzag-chair/introduction)**: Rietveld's 1934 Zig-Zag chair, parametric, in cherry. | [![Open in Buerligons](https://img.shields.io/badge/Open_in-Buerligons-c4553e)](https://buerligons.io/editor/?url=https://abernier.github.io/integral/zigzag-chair/zigzag-chair.ofb) [![download .ofb](https://img.shields.io/badge/download-.ofb-1f6feb)](https://abernier.github.io/integral/zigzag-chair/zigzag-chair.ofb) [![download STEP](https://img.shields.io/badge/download-STEP-238636)](https://abernier.github.io/integral/zigzag-chair/zigzag-chair.step) [![download GLB](https://img.shields.io/badge/download-GLB-8957e5)](https://abernier.github.io/integral/zigzag-chair/zigzag-chair.glb) |

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
- Engine key: local ClassCAD sign-in; in CI, the `CLASSCAD_TOKEN` secret
- Deploy: every push to `main`, GitHub Pages
