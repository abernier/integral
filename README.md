# integral

Parametric furniture parts in ClassCAD.

<Intro>

Each part is a [ClassCAD](https://classcad.ch) model with its history: open it in [Buerligons](https://buerligons.io), change a dimension, it rebuilds.

</Intro>

## Parts

<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
<div>
<a href="https://abernier.github.io/integral/zigzag-chair/introduction"><img src="https://abernier.github.io/integral/zigzag-chair/zigzag-chair.png" alt="Zigzag chair" width="320" /></a>
<p><strong>Zigzag chair</strong>: cherry, 370 × 480 × 742.6 mm</p>
</div>
</div>

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
