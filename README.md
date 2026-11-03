# integral

Tangible objects, made by integrating technologies.

<Intro>

Real objects, designed and made with whatever tools fit: CAD, code, machines.

</Intro>

## Parts

| | Part |
|---|---|
| <a href="https://abernier.github.io/integral/zigzag-chair/readme"><img src="https://abernier.github.io/integral/zigzag-chair/zigzag-chair.png" alt="Zigzag chair" width="160" /></a> | **[Zigzag chair](https://abernier.github.io/integral/zigzag-chair/readme)**: Rietveld's 1934 Zig-Zag chair, parametric, in cherry. |

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
